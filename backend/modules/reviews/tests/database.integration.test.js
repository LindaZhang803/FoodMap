const { test } = require('node:test');
const assert = require('node:assert/strict');
// Explicit opt-in only: unit tests and ordinary CI never use developer credentials.
test('MongoDB-backed review, photo, ownership and concurrent-like flow', { skip: process.env.RUN_REVIEW_DB_TESTS !== '1', timeout: 120000 }, async () => {
  require('dotenv').config({ quiet: true });
  const mongoose = require('mongoose');
  const express = require('express');
  const jwt = require('jsonwebtoken');
  const sharp = require('sharp');
  const crypto = require('crypto');
  const Restaurant = require('../../restaurants/models/Restaurant');
  const User = require('../../accounts/models/User');
  const { mountReviewModule } = require('../app');
  const ids = { restaurant: new mongoose.Types.ObjectId(), dish: new mongoose.Types.ObjectId(), users: [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()] };
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  let server, models;
  try {
    assert.ok(process.env.MONGO_URI, 'MONGO_URI must be set explicitly');
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
    const app = express(); app.use(express.json());
    models = mountReviewModule(app, { mongoose, Restaurant, authenticate: require('../../accounts/middleware/authMiddleware') });
    await Promise.all(Object.values(models).map(model => model.init()));
    await Restaurant.create({ _id: ids.restaurant, name: '[SYNTHETIC INTEGRATION TEST] Review Lab', description: 'Temporary generated test record', latitude: 0, longitude: 0 });
    await models.Dish.create({ _id: ids.dish, restaurantId: ids.restaurant, name: 'Synthetic test dish' });
    for (let i = 0; i < 2; i++) await User.create({ _id: ids.users[i], username: 'Synthetic integration user', email: `review-test-${ids.users[i]}@example.invalid`, passwordHash: crypto.randomBytes(32).toString('hex') });
    server = await new Promise((resolve, reject) => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); listener.once('error', reject); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const tokens = ids.users.map(id => jwt.sign({ id: String(id), tokenVersion: 0 }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' }));
    const call = (path, method = 'GET', body, user = 0) => fetch(origin + path, {
      method, headers: { ...(user === null ? {} : { Authorization: `Bearer ${tokens[user]}` }), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const image = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#e67e22' } }).png().toBuffer();
    async function upload(buffer, mime = 'image/png', user = 0) {
      const form = new FormData(); form.append('photo', new Blob([buffer], { type: mime }), 'synthetic.png');
      return fetch(origin + '/api/review-photos', { method: 'POST', headers: { Authorization: `Bearer ${tokens[user]}` }, body: form });
    }
    assert.equal((await upload(Buffer.from('broken'), 'image/png')).status, 400);
    assert.equal((await upload(image, 'text/plain')).status, 400);
    assert.equal((await upload(Buffer.alloc(5 * 1024 * 1024 + 1))).status, 400);
    const uploadResponse = await upload(image); assert.equal(uploadResponse.status, 201);
    const { photoUrl } = await uploadResponse.json();
    assert.equal((await call(photoUrl, 'GET', null, null)).status, 404, 'draft is private');
    assert.equal((await call(photoUrl)).status, 200, 'draft owner can preview');
    const payload = { restaurantId: String(ids.restaurant), dishId: String(ids.dish), reviewType: 'dish', rating: 5, comment: 'Synthetic integration review', photoUrls: [photoUrl] };
    assert.equal((await call('/api/reviews', 'POST', payload, null)).status, 401);
    assert.equal((await call('/api/reviews', 'POST', payload, 1)).status, 403, 'other user cannot attach photo');
    const createdResponse = await call('/api/reviews', 'POST', payload); assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json(), reviewId = created.review.id;
    assert.equal(created.statistics.averageRating, 5);
    assert.equal((await call('/api/reviews', 'POST', payload)).status, 400, 'attached photo cannot be reused');
    const published = await call(photoUrl, 'GET', null, null); assert.equal(published.status, 200); assert.match(published.headers.get('content-type'), /image\/jpeg/);
    assert.equal((await sharp(Buffer.from(await published.arrayBuffer())).metadata()).format, 'jpeg');
    assert.equal((await call(`/api/reviews/${reviewId}`, 'PUT', { rating: 1 }, 1)).status, 403);
    assert.equal((await call(`/api/reviews/${reviewId}`, 'DELETE', null, 1)).status, 403);
    const mine = await (await call('/api/reviews/mine')).json(); assert.ok(mine.reviews.some(review => review.id === reviewId));
    const concurrent = await Promise.all(Array.from({ length: 6 }, () => call(`/api/reviews/${reviewId}/like`, 'POST', null, 1)));
    assert.ok(concurrent.every(response => response.status === 200), 'concurrent duplicate likes are idempotent');
    assert.equal(await models.ReviewLike.countDocuments({ reviewId }), 1);
    assert.equal((await models.Review.findById(reviewId)).likeCount, 1);
    const edited = await (await call(`/api/reviews/${reviewId}`, 'PUT', { rating: 2, comment: 'Updated synthetic review', photoUrls: [] })).json();
    assert.equal(edited.statistics.averageRating, 2);
    assert.equal((await models.Dish.findById(ids.dish)).averageRating, 2);
    await mongoose.disconnect();
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
    assert.equal((await models.Dish.findById(ids.dish)).averageRating, 2, 'rating survives a new DB connection');
    assert.equal((await call(photoUrl, 'GET', null, null)).status, 404, 'removed photo is deleted');
    assert.equal((await call(`/api/reviews/${reviewId}/like`, 'DELETE', null, 1)).status, 200);
    await call(`/api/reviews/${reviewId}/like`, 'POST', null, 1);
    const restaurantPayload = { restaurantId: String(ids.restaurant), reviewType: 'restaurant', rating: 3, comment: 'Synthetic restaurant review', photoUrls: [] };
    assert.equal((await call('/api/reviews', 'POST', restaurantPayload)).status, 201);
    const list = await (await call(`/api/reviews?restaurantId=${ids.restaurant}&dishId=${ids.dish}&reviewType=dish&sort=mostLiked`)).json();
    assert.equal(list.statistics.reviewCount, 1); assert.equal(list.reviews[0].likedByMe, false);
    assert.equal((await call(`/api/dishes?restaurantId=${ids.restaurant}&sort=highestRated`)).status, 200);
    const deleted = await (await call(`/api/reviews/${reviewId}`, 'DELETE')).json();
    assert.deepEqual(deleted.statistics, { averageRating: null, reviewCount: 0 });
    assert.equal(await models.ReviewLike.countDocuments({ reviewId }), 0);
    const storedDish = await models.Dish.findById(ids.dish); assert.equal(storedDish.averageRating, null); assert.equal(storedDish.reviewCount, 0);
    console.log('Verified: real MongoDB CRUD, image decoding/privacy/attachment, ownership, concurrent likes and rating persistence.');
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.readyState === 1 && models) {
      // Delete only records created with this run's fresh IDs. Never drop collections/databases.
      const reviews = await models.Review.find({ userId: { $in: ids.users } }).select('_id').lean();
      await models.ReviewLike.deleteMany({ $or: [{ userId: { $in: ids.users } }, { reviewId: { $in: reviews.map(r => r._id) } }] });
      await models.ReviewPhoto.deleteMany({ userId: { $in: ids.users } });
      await models.Review.deleteMany({ userId: { $in: ids.users } });
      await models.Dish.deleteOne({ _id: ids.dish }); await Restaurant.deleteOne({ _id: ids.restaurant }); await User.deleteMany({ _id: { $in: ids.users } });
    }
    await mongoose.disconnect();
    if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret;
  }
});
