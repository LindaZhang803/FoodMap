const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const express = require('express');
const { createReviewService } = require('../services/review.service');
const { createReviewRouter } = require('../routes/review.routes');
const { createModels } = require('../models');
const { createReviewRepository } = require('../../../../Mobile/src/modules/reviews/services/reviewRepository');
const fixtures = require('../../../../Mobile/src/modules/reviews/mocks/fixtures.json');
const restaurantId = fixtures.dishes[0].restaurantId;
const dishId = fixtures.dishes[0].id;
const userId = fixtures.reviews[0].userId;
const payload = { restaurantId, dishId, reviewType: 'dish', rating: 5, comment: 'Excellent!', photoUrls: [] };

// Isolated transaction-aware store: never connects to or changes the team database.
function harness() {
  const state = { reviews: [], dishes: fixtures.dishes.map(d => ({ ...d, _id: d.id })), failUpdate: false };
  const session = { testSession: true };
  let sequence = 10;
  const query = getter => ({
    session(value) { assert.ok(value === session || value === null); return this; },
    lean: async () => getter()
  });
  const match = (row, filter) => Object.entries(filter).every(([key, value]) => String(row[key]) === String(value));
  const Review = {
    async create([input], options) {
      assert.equal(options.session, session);
      const doc = new (createModels(mongoose).Review)(input);
      await doc.validate();
      const record = { ...input, _id: new mongoose.Types.ObjectId((sequence++).toString(16).padStart(24, '0')), createdAt: new Date() };
      state.reviews.push(record);
      return [record];
    },
    aggregate(pipeline) { return { session: async () => {
      const rows = state.reviews.filter(r => match(r, pipeline[0].$match));
      return rows.length ? [{ averageRating: rows.reduce((sum, r) => sum + r.rating, 0) / rows.length, reviewCount: rows.length }] : [];
    } }; },
    find(filter) {
      let offset = 0, limit = 20;
      return { sort() { return this; }, skip(n) { offset = n; return this; }, limit(n) { limit = n; return this; }, lean: async () => state.reviews.filter(r => match(r, filter)).slice().reverse().slice(offset, offset + limit) };
    }
  };
  const Dish = {
    findById(id) { return query(() => state.dishes.find(d => d.id === id) || null); },
    async updateOne(filter, update, options) {
      assert.equal(options.session, session);
      if (state.failUpdate) throw new Error('Database failure containing private details');
      Object.assign(state.dishes.find(d => d.id === filter._id), update.$set);
    }
  };
  const Restaurant = { findById(id) { return query(() => id === restaurantId || id === fixtures.dishes[2].restaurantId ? { _id: id } : null); } };
  const fakeMongoose = { Types: mongoose.Types, connection: { async transaction(callback) {
    const originalReviews = state.reviews.slice();
    const originalDishes = state.dishes.map(d => ({ ...d }));
    try { return await callback(session); }
    catch (error) { state.reviews = originalReviews; state.dishes = originalDishes; throw error; }
  } } };
  return { state, service: createReviewService({ mongoose: fakeMongoose, Review, Dish, Restaurant }) };
}

test('create review uses authenticated identity and updates dish statistics', async () => {
  const { service, state } = harness();
  await service.create({ ...payload, userId: 'spoofed', averageRating: 1, comment: '  Good  ' }, userId);
  await service.create({ ...payload, rating: 3 }, userId);
  assert.equal(String(state.reviews[0].userId), userId);
  assert.equal(state.reviews[0].comment, 'Good');
  assert.equal(state.dishes[0].averageRating, 4);
  assert.equal(state.dishes[0].reviewCount, 2);
});
test('restaurant and dish reviews are separated; public results omit userId', async () => {
  const { service } = harness();
  await service.create(payload, userId);
  await service.create({ ...payload, dishId: undefined, reviewType: 'restaurant', rating: 2 }, userId);
  const dishes = await service.list({ restaurantId, dishId, reviewType: 'dish' });
  const restaurant = await service.list({ restaurantId, reviewType: 'restaurant' });
  assert.equal(dishes.statistics.averageRating, 5);
  assert.equal(restaurant.statistics.averageRating, 2);
  assert.equal(restaurant.reviews.length, 1);
  assert.ok(!('userId' in restaurant.reviews[0]));
});
test('reject invalid stars, empty comments, photos, missing IDs and mismatched targets', async () => {
  const { service, state } = harness();
  for (const patch of [{ rating: 0 }, { rating: 6 }, { rating: 2.5 }, { comment: ' ' }, { comment: 'a'.repeat(2001) }, { photoUrls: ['file:///x'] }, { restaurantId: 'bad' }, { dishId: null }, { reviewType: 'restaurant' }]) {
    await assert.rejects(service.create({ ...payload, ...patch }, userId), error => error.status === 400);
  }
  await assert.rejects(service.create({ ...payload, restaurantId: fixtures.dishes[2].restaurantId }, userId), error => error.status === 400);
  await assert.rejects(service.create({ ...payload, dishId: '200000000000000000000099' }, userId), error => error.status === 404);
  await assert.rejects(service.create(payload, null), error => error.status === 401);
  await assert.rejects(service.create(null, userId), error => error.status === 400);
  assert.equal(state.reviews.length, 0);
});
test('statistics failure rolls back review creation in the transaction contract', async () => {
  const { service, state } = harness();
  state.failUpdate = true;
  await assert.rejects(service.create(payload, userId), /Database failure/);
  assert.equal(state.reviews.length, 0);
});
test('list pagination and empty statistics are explicit', async () => {
  const { service } = harness();
  assert.deepEqual((await service.list({ restaurantId, dishId, reviewType: 'dish' })).statistics, { averageRating: null, reviewCount: 0 });
  for (let n = 0; n < 21; n++) await service.create(payload, userId);
  const second = await service.list({ restaurantId, dishId, reviewType: 'dish', page: '2' });
  assert.equal(second.reviews.length, 1);
  assert.equal(second.pagination.total, 21);
  await assert.rejects(service.list({ restaurantId, reviewType: 'restaurant', page: '-1' }), error => error.status === 400);
});
test('demo repository submits reviews, updates mock ratings, and remains isolated', async () => {
  const copy = JSON.parse(JSON.stringify(fixtures));
  const repo = createReviewRepository({ fixtures: copy });
  const created = await repo.create(payload);
  assert.equal(created.statistics.averageRating, 4.5);
  assert.equal(copy.dishes[0].reviewCount, 2);
  assert.equal(fixtures.dishes[0].reviewCount, 1);
  assert.equal((await repo.list({ restaurantId, reviewType: 'restaurant' })).reviews.length, 1);
  await assert.rejects(repo.create({ ...payload, rating: 0 }), /1–5/);
});
test('live repository requires token, sends bearer header and excludes supplied userId', async () => {
  let request;
  const repo = createReviewRepository({ fetchImpl: async (url, options) => {
    request = { url, options }; return { ok: true, json: async () => ({ review: {}, statistics: {} }) };
  } });
  await assert.rejects(repo.create(payload), /Sign in/);
  await repo.create({ ...payload, userId: 'spoofed' }, 'test-token');
  assert.equal(request.options.headers.Authorization, 'Bearer test-token');
  assert.ok(!('userId' in JSON.parse(request.options.body)));
});
test('HTTP routes use actual Accounts JWT middleware and protect review writes', async () => {
  const User = require('../../accounts/models/User');
  const authenticate = require('../../accounts/middleware/authMiddleware');
  const originalFind = User.findById;
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'local-test-secret-not-a-production-credential';
  User.findById = async id => id === userId ? { _id: userId, username: 'Test' } : null;
  const { service, state } = harness();
  const app = express(); app.use(express.json());
  app.use('/api/reviews', createReviewRouter({ service, authenticate }));
  const server = await new Promise((resolve, reject) => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); listener.once('error', reject); });
  const url = `http://127.0.0.1:${server.address().port}/api/reviews`;
  try {
    for (const token of [null, 'invalid', jwt.sign({ id: userId }, 'wrong-secret')]) {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(payload) });
      assert.equal(response.status, 401);
    }
    const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1m' });
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ ...payload, userId: 'spoofed' }) });
    assert.equal(response.status, 201);
    assert.equal(String(state.reviews[0].userId), userId);
    const list = await fetch(`${url}?restaurantId=${restaurantId}&reviewType=dish&dishId=${dishId}`);
    assert.equal(list.status, 200); assert.equal((await list.json()).reviews.length, 1);
    const invalid = await fetch(`${url}?restaurantId=bad&reviewType=dish`);
    assert.equal(invalid.status, 400);
    state.failUpdate = true;
    const failed = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    assert.equal(failed.status, 500); assert.deepEqual(await failed.json(), { message: 'Review service unavailable' });
  } finally {
    User.findById = originalFind;
    if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret;
    await new Promise(resolve => server.close(resolve));
  }
});
