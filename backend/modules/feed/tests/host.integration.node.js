const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const express = require('express');
const request = require('supertest');
const bcrypt = require('bcrypt');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../../accounts/models/User');
const Restaurant = require('../../restaurants/models/Restaurant');
const authenticate = require('../../accounts/middleware/authMiddleware');
const authRoutes = require('../../accounts/routes/authRoutes');
const { mountReviewModule } = require('../../reviews/app');
const connectDB = require('../../../database/connect');
const { mountFavoritesModule } = require('..');

// Use the owning models' actual Mongoose instance, never a second connection.
const mongoose = Restaurant.base;
const A = '100000000000000000000001';
const B = '100000000000000000000002';
const R = '200000000000000000000001';
const D = '300000000000000000000001';
const password = 'Member4-synthetic-password!';

function host() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  const { Dish } = mountReviewModule(app, { mongoose, Restaurant, authenticate });
  return { app, Dish, dependencies: { connection: mongoose.connection, authenticate, Restaurant, Dish } };
}

describe('Member 4 mount with real Accounts, Restaurants, Reviews and disposable MongoDB', () => {
  let database, context, Favorite, tokenA, tokenB, passwordHash;

  before(async () => {
    database = await MongoMemoryServer.create({
      instance: { ip: '127.0.0.1', dbName: 'member4_real_owner_test' },
      binary: { version: '7.0.24', downloadDir: path.join(os.tmpdir(), 'foodmap-member4-mongodb') },
    });
    // Assign only generated test settings before invoking the real connection
    // helper. This test never imports server.js or reads a .env/production URI.
    process.env.MONGO_URI = database.getUri();
    process.env.JWT_SECRET = 'member4-disposable-host-test-only';
    await connectDB();
    context = host();
    ({ Favorite } = await mountFavoritesModule(context.app, context.dependencies));
    passwordHash = await bcrypt.hash(password, 12);
  }, { timeout: 180000 });

  after(async () => {
    await mongoose.disconnect();
    if (database) await database.stop();
  });

  async function login(email) {
    const response = await request(context.app).post('/api/auth/login').send({ email, password }).expect(200);
    assert.equal(typeof response.body.token, 'string');
    return response.body.token;
  }

  beforeEach(async () => {
    await Promise.all([Favorite.deleteMany({}), User.deleteMany({}), Restaurant.deleteMany({}), context.Dish.deleteMany({})]);
    await User.create([
      { _id: A, username: 'Synthetic A', email: 'member4-a@example.test', passwordHash },
      { _id: B, username: 'Synthetic B', email: 'member4-b@example.test', passwordHash },
    ]);
    await Restaurant.create({ _id: R, name: 'Real schema synthetic restaurant', latitude: 34, longitude: -117 });
    await context.Dish.create({ _id: D, restaurantId: R, name: 'Real schema synthetic dish' });
    tokenA = await login('member4-a@example.test');
    tokenB = await login('member4-b@example.test');
  });

  it('shares the host connection and Dish model, creates its unique index, and mounts once concurrently', async () => {
    const fresh = host();
    const originalUse = fresh.app.use.bind(fresh.app);
    let mounts = 0;
    fresh.app.use = (...args) => {
      if (args[0] === '/api/favorites') mounts += 1;
      return originalUse(...args);
    };
    const [first, second] = await Promise.all([
      mountFavoritesModule(fresh.app, fresh.dependencies),
      mountFavoritesModule(fresh.app, fresh.dependencies),
    ]);
    assert.equal(first, second);
    assert.equal(mounts, 1);
    assert.equal(first.Favorite.db, mongoose.connection);
    assert.equal(fresh.Dish, context.Dish);
    const index = (await Favorite.collection.indexes()).find(item => item.name === 'favorite_owner_target_unique');
    assert.equal(index.unique, true);
  });

  it('requires the canonical account middleware for every Favorites method', async () => {
    await request(context.app).get('/api/favorites').expect(401);
    await request(context.app).put(`/api/favorites/restaurant/${R}`).expect(401);
    await request(context.app).delete(`/api/favorites/dish/${D}`).expect(401);
    const response = await request(context.app).get('/api/favorites').auth(tokenA, { type: 'bearer' }).expect(200);
    assert.deepEqual(response.body, { items: [] });
  });

  it('saves both real catalog types idempotently and reloads them through a fresh host', async () => {
    await Promise.all(Array.from({ length: 8 }, () =>
      request(context.app).put(`/api/favorites/restaurant/${R}`).auth(tokenA, { type: 'bearer' }).expect(200)));
    const dish = await request(context.app).put(`/api/favorites/dish/${D}`).auth(tokenA, { type: 'bearer' }).expect(200);
    assert.equal(dish.body.target.dishId, D);
    assert.equal(dish.body.target.restaurantId, R);
    assert.equal(await Favorite.countDocuments(), 2);
    const fresh = host();
    await mountFavoritesModule(fresh.app, fresh.dependencies);
    const response = await request(fresh.app).get('/api/favorites').auth(tokenA, { type: 'bearer' }).expect(200);
    assert.deepEqual(new Set(response.body.items.map(item => item.targetId)), new Set([R, D]));
    for (const [type, id] of [['restaurant', R], ['dish', D]]) {
      await request(fresh.app).delete(`/api/favorites/${type}/${id}`).auth(tokenA, { type: 'bearer' }).expect(204);
    }
    const empty = await request(context.app).get('/api/favorites').auth(tokenA, { type: 'bearer' }).expect(200);
    assert.deepEqual(empty.body.items, []);
  });

  it('derives ownership only from the authenticated account and isolates account B', async () => {
    await request(context.app).put(`/api/favorites/restaurant/${R}?userId=${B}`)
      .auth(tokenA, { type: 'bearer' }).send({ userId: B }).expect(200);
    await request(context.app).delete(`/api/favorites/restaurant/${R}`).auth(tokenB, { type: 'bearer' }).expect(204);
    const a = await request(context.app).get(`/api/favorites?userId=${B}`).auth(tokenA, { type: 'bearer' }).expect(200);
    const b = await request(context.app).get('/api/favorites').auth(tokenB, { type: 'bearer' }).expect(200);
    assert.equal(a.body.items.length, 1);
    assert.equal(b.body.items.length, 0);
    assert.equal((await Favorite.findOne().lean()).userId.toString(), A);
  });

  it('keeps deleted dish records removable with repeated deletion', async () => {
    await request(context.app).put(`/api/favorites/dish/${D}`).auth(tokenA, { type: 'bearer' }).expect(200);
    await context.Dish.deleteOne({ _id: D });
    const response = await request(context.app).get('/api/favorites').auth(tokenA, { type: 'bearer' }).expect(200);
    assert.equal(response.body.items[0].target, null);
    for (let i = 0; i < 2; i += 1) {
      await request(context.app).delete(`/api/favorites/dish/${D}`).auth(tokenA, { type: 'bearer' }).expect(204);
    }
    assert.equal(await Favorite.countDocuments(), 0);
  });

  it('rejects a revoked Accounts token while a fresh login retains the account saved records', async () => {
    await request(context.app).put(`/api/favorites/restaurant/${R}`).auth(tokenA, { type: 'bearer' }).expect(200);
    await request(context.app).post('/api/auth/logout').auth(tokenA, { type: 'bearer' }).expect(200);
    await request(context.app).get('/api/favorites').auth(tokenA, { type: 'bearer' }).expect(401);
    const freshToken = await login('member4-a@example.test');
    const response = await request(context.app).get('/api/favorites').auth(freshToken, { type: 'bearer' }).expect(200);
    assert.equal(response.body.items[0].targetId, R);
  });

  it('waits for indexing, leaves failed initialization unmounted, and permits a retry', async () => {
    const fresh = host();
    const createIndexes = Favorite.createIndexes;
    let release;
    Favorite.createIndexes = () => new Promise(resolve => { release = resolve; });
    try {
      const pending = mountFavoritesModule(fresh.app, fresh.dependencies);
      await request(fresh.app).get('/api/favorites').auth(tokenA, { type: 'bearer' }).expect(404);
      release();
      await pending;
      await request(fresh.app).get('/api/favorites').auth(tokenA, { type: 'bearer' }).expect(200);
      const failing = host();
      Favorite.createIndexes = async () => { throw new Error('Synthetic index failure'); };
      await assert.rejects(mountFavoritesModule(failing.app, failing.dependencies), /Synthetic index failure/);
      await request(failing.app).get('/api/favorites').auth(tokenA, { type: 'bearer' }).expect(404);
      Favorite.createIndexes = createIndexes;
      await mountFavoritesModule(failing.app, failing.dependencies);
      await request(failing.app).get('/api/favorites').auth(tokenA, { type: 'bearer' }).expect(200);
    } finally {
      Favorite.createIndexes = createIndexes;
    }
  });
});
