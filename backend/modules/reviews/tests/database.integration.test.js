const { test } = require('node:test');
const assert = require('node:assert/strict');

// Opt-in only. Use a separate test database, never the team's foodmap database.
test('MongoDB-backed review, photo, ownership and concurrent-like flow', {
  skip: process.env.RUN_REVIEW_DB_TESTS !== '1',
  timeout: 120000
}, async () => {
  const uri = process.env.MONGO_URI;
  assert.ok(
    typeof uri === 'string' &&
    /\/(foodmap_reviews_ci|foodmap_reviews_test)(\?|$)/.test(uri),
    'Set MONGO_URI explicitly to foodmap_reviews_ci or foodmap_reviews_test'
  );

  const mongoose = require('mongoose');
  const express = require('express');
  const jwt = require('jsonwebtoken');
  const sharp = require('sharp');
  const crypto = require('node:crypto');
  const Restaurant = require('../../restaurants/models/Restaurant');
  const User = require('../../accounts/models/User');
  const { mountReviewModule } = require('../app');

  const ids = {
    restaurant: new mongoose.Types.ObjectId(),
    dish: new mongoose.Types.ObjectId(),
    users: [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()]
  };

  const previousSecret = process.env.JWT_SECRET;
  const previousAdminKey = process.env.ADMIN_API_KEY;
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  process.env.ADMIN_API_KEY = crypto.randomBytes(32).toString('hex');

  let server;
  let models;

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
    const app = express();
    app.use(express.json());
    models = mountReviewModule(app, {
      mongoose,
      Restaurant,
      authenticate: require('../../accounts/middleware/authMiddleware')
    });
    await Promise.all(Object.values(models).map(model => model.init()));

    await Restaurant.create({
      _id: ids.restaurant,
      name: '[SYNTHETIC INTEGRATION TEST] Review Lab',
      description: 'Temporary generated test record',
      latitude: 0,
      longitude: 0
    });
    await models.Dish.create({
      _id: ids.dish,
      restaurantId: ids.restaurant,
      name: 'Synthetic test dish'
    });
    for (const id of ids.users) {
      await User.create({
        _id: id,
        username: 'Synthetic integration user',
        email: `review-test-${id}@example.invalid`,
        passwordHash: crypto.randomBytes(32).toString('hex')
      });
    }

    server = await new Promise((resolve, reject) => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
      listener.once('error', reject);
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const tokens = ids.users.map(id => jwt.sign(
      { id: String(id), tokenVersion: 0 },
      process.env.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '5m' }
    ));

    const call = (path, method = 'GET', body, user = 0) => fetch(origin + path, {
      method,
      headers: {
        ...(user === null ? {} : { Authorization: `Bearer ${tokens[user]}` }),
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const admin = (path, method = 'GET', body) => fetch(origin + path, {
      method,
      headers: {
        'x-admin-key': process.env.ADMIN_API_KEY,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });

    const image = await sharp({
      create: { width: 32, height: 32, channels: 3, background: '#e67e22' }
    }).png().toBuffer();

    async function upload(buffer, mime = 'image/png') {
      const form = new FormData();
      form.append('photo', new Blob([buffer], { type: mime }), 'synthetic.png');
      return fetch(origin + '/api/review-photos', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokens[0]}` },
        body: form
      });
    }

    assert.equal((await upload(Buffer.from('broken'))).status, 400);
    assert.equal((await upload(image, 'text/plain')).status, 400);
    assert.equal((await upload(Buffer.alloc(5 * 1024 * 1024 + 1))).status, 400);
    const uploaded = await upload(image);
    assert.equal(uploaded.status, 201);
    const { photoUrl, status } = await uploaded.json();
    assert.equal(status, 'pending');
    assert.equal((await call(photoUrl, 'GET', null, null)).status, 404);
    assert.equal((await call(photoUrl)).status, 200);

    const payload = {
      restaurantId: String(ids.restaurant),
      dishId: String(ids.dish),
      reviewType: 'dish',
      rating: 5,
      spicinessRating: 4,
      comment: 'Synthetic integration review',
      photoUrls: [photoUrl]
    };
    assert.equal((await call('/api/reviews', 'POST', payload, null)).status, 401);
    assert.equal((await call('/api/reviews', 'POST', payload, 1)).status, 403);
    const createdResponse = await call('/api/reviews', 'POST', payload);
    assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json();
    const reviewId = created.review.id;
    assert.equal(created.review.spicinessRating, 4);
    assert.equal(created.statistics.averageRating, 5);
    assert.equal(created.statistics.medianSpiciness, 4);
    assert.equal(created.statistics.spicinessDistribution.level4, 1);
    assert.equal((await call('/api/reviews', 'POST', payload)).status, 400);
    assert.equal((await call(photoUrl, 'GET', null, null)).status, 404);

    const photoId = photoUrl.split('/')[3];
    const moderationPath = `/api/review-photo-moderation/${photoId}`;
    assert.equal((await call(moderationPath + '/approve', 'PATCH')).status, 401);
    assert.equal((await admin(moderationPath + '/image')).status, 200);
    assert.equal((await admin(moderationPath + '/approve', 'PATCH')).status, 200);
    const published = await call(photoUrl, 'GET', null, null);
    assert.equal(published.status, 200);
    assert.match(published.headers.get('content-type'), /image\/jpeg/);
    assert.equal((await sharp(Buffer.from(await published.arrayBuffer())).metadata()).format, 'jpeg');
    assert.equal((await admin(moderationPath + '/reject', 'PATCH')).status, 200);
    assert.equal((await call(photoUrl, 'GET', null, null)).status, 404);
    assert.equal((await admin(moderationPath + '/approve', 'PATCH')).status, 200);

    const replyPath = `/api/reviews/${reviewId}/replies`;
    const replyResponse = await call(replyPath, 'POST', { comment: 'Synthetic reply' }, 1);
    assert.equal(replyResponse.status, 201);
    const reply = (await replyResponse.json()).reply;
    assert.equal((await call(`${replyPath}/${reply.id}`, 'DELETE')).status, 403);
    assert.equal((await (await call(replyPath)).json()).pagination.total, 1);

    const reportPath = `/api/reviews/${reviewId}/report`;
    const reportResponse = await call(reportPath, 'POST', { reason: 'Spam' }, 1);
    assert.equal(reportResponse.status, 201);
    const report = (await reportResponse.json()).report;
    assert.equal((await call(reportPath, 'POST', { reason: 'Spam' }, 1)).status, 409);
    assert.equal((await call('/api/review-reports')).status, 401);
    assert.equal((await admin('/api/review-reports')).status, 200);
    const processed = await admin(`/api/review-reports/${report.id}`, 'PATCH', { status: 'dismissed' });
    assert.equal(processed.status, 200);
    assert.equal((await processed.json()).report.status, 'dismissed');
    assert.ok(await models.Review.exists({ _id: reviewId }));

    assert.equal((await call(`/api/reviews/${reviewId}`, 'PUT', { rating: 1 }, 1)).status, 403);
    assert.equal((await call(`/api/reviews/${reviewId}`, 'DELETE', null, 1)).status, 403);
    const mine = await (await call('/api/reviews/mine')).json();
    assert.ok(mine.reviews.some(review => review.id === reviewId));
    const concurrent = await Promise.all(Array.from({ length: 6 }, () =>
      call(`/api/reviews/${reviewId}/like`, 'POST', null, 1)
    ));
    assert.ok(concurrent.every(response => response.status === 200));
    assert.equal(await models.ReviewLike.countDocuments({ reviewId }), 1);

    const editResponse = await call(`/api/reviews/${reviewId}`, 'PUT', {
      rating: 2,
      spicinessRating: 2,
      comment: 'Updated synthetic review',
      photoUrls: []
    });
    assert.equal(editResponse.status, 200);
    const edited = await editResponse.json();
    assert.equal(edited.statistics.averageRating, 2);
    assert.equal(edited.statistics.medianSpiciness, 2);
    assert.equal(edited.statistics.spicinessDistribution.level4, 0);

    await mongoose.disconnect();
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
    const storedDish = await models.Dish.findById(ids.dish);
    assert.equal(storedDish.averageRating, 2);
    assert.equal(storedDish.medianSpiciness, 2);
    assert.equal((await call(photoUrl, 'GET', null, null)).status, 404);
    const detail = await (await call(`/api/dishes/${ids.dish}`)).json();
    assert.equal(detail.reviews[0].spicinessRating, 2);

    const deletedResponse = await call(`/api/reviews/${reviewId}`, 'DELETE');
    assert.equal(deletedResponse.status, 200);
    assert.deepEqual((await deletedResponse.json()).statistics, {
      averageRating: null,
      reviewCount: 0,
      medianSpiciness: null,
      spicinessDistribution: { level1: 0, level2: 0, level3: 0, level4: 0, level5: 0 },
      spicinessRatingCount: 0
    });
    assert.equal(await models.ReviewLike.countDocuments({ reviewId }), 0);
    assert.equal(await models.ReviewReply.countDocuments({ reviewId }), 0);
    assert.equal(await models.ReviewReport.countDocuments({ reviewId }), 0);
    assert.equal((await models.Dish.findById(ids.dish)).medianSpiciness, null);
  } finally {
    try {
      if (server) await new Promise(resolve => server.close(resolve));
      if (mongoose.connection.readyState === 1 && models) {
        // Remove only this run's records. Never drop a collection or database.
        const reviews = await models.Review.find({ userId: { $in: ids.users } }).select('_id').lean();
        const reviewIds = reviews.map(review => review._id);
        await models.ReviewLike.deleteMany({ $or: [{ userId: { $in: ids.users } }, { reviewId: { $in: reviewIds } }] });
        await models.ReviewReply.deleteMany({ $or: [{ userId: { $in: ids.users } }, { reviewId: { $in: reviewIds } }] });
        await models.ReviewReport.deleteMany({ $or: [{ reportedBy: { $in: ids.users } }, { reviewId: { $in: reviewIds } }] });
        await models.ReviewPhoto.deleteMany({ userId: { $in: ids.users } });
        await models.Review.deleteMany({ userId: { $in: ids.users } });
        await models.Dish.deleteOne({ _id: ids.dish });
        await Restaurant.deleteOne({ _id: ids.restaurant });
        await User.deleteMany({ _id: { $in: ids.users } });
      }
    } finally {
      await mongoose.disconnect();
      if (previousSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousSecret;
      if (previousAdminKey === undefined) delete process.env.ADMIN_API_KEY;
      else process.env.ADMIN_API_KEY = previousAdminKey;
    }
  }
});
