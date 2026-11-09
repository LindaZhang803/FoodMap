// Real Express + Mongoose + disposable MongoDB. Auth and catalog schemas below
// are synthetic test fixtures, not the unavailable teammates' implementation.
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createFavoritesModule, createCatalogReaders } = require('..');

const A = '100000000000000000000001';
const B = '100000000000000000000002';
const R1 = '200000000000000000000001';
const R2 = '200000000000000000000002';
const D1 = '300000000000000000000001';

function testAuthenticate(req, res, next) {
  const identities = { 'Bearer test-a': A, 'Bearer test-b': B };
  const userId = identities[req.get('Authorization')];
  if (!userId) return res.status(401).json({ message: 'Test session required' });
  req.user = { id: userId };
  next();
}

async function makeTestApp(connection) {
  const { Schema } = connection.base;
  // Minimal owning-model fixtures exercise the actual bulk Mongoose readers.
  const Restaurant = connection.models.TestRestaurant || connection.model('TestRestaurant',
    new Schema({ name: String, rating: Number, imageUrl: String, internalSecret: String }));
  const Dish = connection.models.TestDish || connection.model('TestDish', new Schema({
    name: String, restaurantId: Schema.Types.ObjectId, averageRating: Number,
    reviewCount: Number, imageUrl: String, internalSecret: String,
  }));
  const { router, Favorite } = await createFavoritesModule({
    connection, authenticate: testAuthenticate,
    readers: createCatalogReaders({ Restaurant, Dish }),
  });
  const app = express();
  app.use(express.json());
  app.use('/api/favorites', router);
  return { app, Favorite, Restaurant, Dish };
}

describe('real MongoDB Favorites persistence with synthetic auth/catalog fixtures', () => {
  let database;
  let connection;
  let context;

  before(async () => {
    // No production URI or .env is read. Always launch a temporary local server.
    database = await MongoMemoryServer.create({
      instance: { ip: '127.0.0.1', dbName: 'member4_favorites_test' },
      binary: {
        version: '7.0.24',
        downloadDir: path.join(os.tmpdir(), 'foodmap-member4-mongodb'),
      },
    });
    connection = await mongoose.createConnection(database.getUri()).asPromise();
    context = await makeTestApp(connection);
  }, { timeout: 180000 });

  after(async () => {
    if (connection) await connection.close();
    if (database) await database.stop();
  });

  beforeEach(async () => {
    await context.Favorite.deleteMany({});
    await context.Restaurant.deleteMany({});
    await context.Dish.deleteMany({});
    await context.Restaurant.create([
      { _id: R1, name: 'Synthetic One', rating: null, internalSecret: 'hidden' },
      { _id: R2, name: 'Synthetic Two', rating: 4 },
    ]);
    await context.Dish.create({
      _id: D1, restaurantId: R1, name: 'Synthetic Dish', averageRating: null,
      reviewCount: 0, imageUrl: 'https://images.example.test/dish.jpg',
    });
  });

  it('requires auth and returns an empty list for a new authenticated account', async () => {
    await request(context.app).get('/api/favorites').expect(401);
    const result = await request(context.app).get('/api/favorites')
      .set('Authorization', 'Bearer test-a').expect(200);
    assert.deepEqual(result.body, { items: [] });
  });

  it('enforces the actual compound unique index and stores Mongo ObjectIds', async () => {
    const key = { userId: A, targetType: 'restaurant', targetId: R1 };
    await context.Favorite.create(key);
    await assert.rejects(context.Favorite.create(key), error => error.code === 11000);
    const indexes = await context.Favorite.collection.indexes();
    const unique = indexes.find(index => index.name === 'favorite_owner_target_unique');
    assert.equal(unique.unique, true);
    assert.deepEqual(unique.key, { userId: 1, targetType: 1, targetId: 1 });
    const stored = await context.Favorite.findOne().lean();
    assert.ok(stored.userId instanceof mongoose.Types.ObjectId);
    assert.ok(stored.targetId instanceof mongoose.Types.ObjectId);
    await context.Favorite.create({ ...key, userId: B });
    await context.Favorite.create({ ...key, targetType: 'dish' });
    assert.equal(await context.Favorite.countDocuments(), 3);
  });

  it('20 concurrent PUTs and a retry create one record with the original timestamp', async () => {
    const responses = await Promise.all(Array.from({ length: 20 }, () =>
      request(context.app).put(`/api/favorites/dish/${D1}`)
        .set('Authorization', 'Bearer test-a').expect(200)));
    assert.equal(await context.Favorite.countDocuments(), 1);
    const first = responses[0].body;
    assert.equal(new Set(responses.map(response => response.body.createdAt)).size, 1);
    assert.equal(first.target.dishId, D1);
    assert.equal(first.target.restaurantId, R1);
    assert.equal(first.target.averageRating, null);
    const retry = await request(context.app).put(`/api/favorites/dish/${D1}`)
      .set('Authorization', 'Bearer test-a').expect(200);
    assert.deepEqual(retry.body, first);
  });

  it('isolates accounts and ignores client-supplied ownership', async () => {
    await request(context.app).put(`/api/favorites/restaurant/${R1}?userId=${B}`)
      .set('Authorization', 'Bearer test-a').send({ userId: B }).expect(200);
    await request(context.app).put(`/api/favorites/dish/${D1}`)
      .set('Authorization', 'Bearer test-b').expect(200);
    await request(context.app).delete(`/api/favorites/restaurant/${R1}`)
      .set('Authorization', 'Bearer test-b').expect(204);
    const a = await request(context.app).get(`/api/favorites?userId=${B}`)
      .set('Authorization', 'Bearer test-a').expect(200);
    const b = await request(context.app).get('/api/favorites')
      .set('Authorization', 'Bearer test-b').expect(200);
    assert.deepEqual(a.body.items.map(item => item.targetId), [R1]);
    assert.deepEqual(b.body.items.map(item => item.targetId), [D1]);
    assert.equal(a.body.items[0].target.internalSecret, undefined);
    assert.equal(a.body.items[0].userId, undefined);
  });

  it('sorts newest first and uses descending _id to break equal timestamps', async () => {
    const date = new Date('2026-01-01T00:00:00.000Z');
    await context.Favorite.create([
      { _id: '400000000000000000000001', userId: A, targetType: 'restaurant', targetId: R1, createdAt: date },
      { _id: '400000000000000000000002', userId: A, targetType: 'restaurant', targetId: R2, createdAt: date },
      { _id: '400000000000000000000000', userId: A, targetType: 'dish', targetId: D1,
        createdAt: new Date('2026-01-02T00:00:00.000Z') },
    ]);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await request(context.app).get('/api/favorites')
        .set('Authorization', 'Bearer test-a').expect(200);
      assert.deepEqual(result.body.items.map(item => item.targetId), [D1, R2, R1]);
    }
  });

  it('survives a fresh connection, model, service, router, and Express app', async () => {
    const saved = await request(context.app).put(`/api/favorites/restaurant/${R1}`)
      .set('Authorization', 'Bearer test-a').expect(200);
    const freshConnection = await mongoose.createConnection(database.getUri()).asPromise();
    try {
      const fresh = await makeTestApp(freshConnection);
      const result = await request(fresh.app).get('/api/favorites')
        .set('Authorization', 'Bearer test-a').expect(200);
      assert.deepEqual(result.body.items, [saved.body]);
    } finally {
      await freshConnection.close();
    }
  });

  it('hydrates deleted targets as null and permits repeated deletion afterwards', async () => {
    await request(context.app).put(`/api/favorites/dish/${D1}`)
      .set('Authorization', 'Bearer test-a').expect(200);
    await context.Dish.deleteOne({ _id: D1 });
    const result = await request(context.app).get('/api/favorites')
      .set('Authorization', 'Bearer test-a').expect(200);
    assert.equal(result.body.items[0].target, null);
    assert.equal(result.body.items[0].targetId, D1);
    await request(context.app).put(`/api/favorites/dish/${D1}`)
      .set('Authorization', 'Bearer test-a').expect(404);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await request(context.app).delete(`/api/favorites/dish/${D1}`)
        .set('Authorization', 'Bearer test-a').expect(204);
    }
    assert.equal(await context.Favorite.countDocuments(), 0);
  });
});