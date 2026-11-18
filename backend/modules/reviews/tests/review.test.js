const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const express = require('express');

const { createReviewService } = require('../services/review.service');
const { createReviewRouter } = require('../routes/review.routes');
const { createModels } = require('../models');
const {
  createReviewRepository
} = require('../../../../Mobile/src/modules/reviews/services/reviewRepository');
const fixtures = require('../../../../Mobile/src/modules/reviews/mocks/fixtures.json');

const restaurantId = fixtures.dishes[0].restaurantId;
const dishId = fixtures.dishes[0].id;
const userId = fixtures.reviews[0].userId;

const payload = {
  restaurantId,
  dishId,
  reviewType: 'dish',
  rating: 5,
  comment: 'Excellent!',
  photoUrls: []
};

const emptyStatistics = {
  averageRating: null,
  reviewCount: 0,
  medianSpiciness: null,
  spicinessDistribution: {
    level1: 0,
    level2: 0,
    level3: 0,
    level4: 0,
    level5: 0
  },
  spicinessRatingCount: 0
};

// This store never connects to the team database.
function harness() {
  const state = {
    reviews: [],
    likes: [],
    dishes: fixtures.dishes.map(dish => ({
      ...dish,
      _id: dish.id
    })),
    failUpdate: false
  };

  const session = { testSession: true };
  let sequence = 10;

  const query = getter => ({
    session(value) {
      assert.ok(value === session || value === null);
      return this;
    },
    lean: async () => {
      const row = getter();
      return row ? { ...row } : row;
    }
  });

  const match = (row, filter) =>
    Object.entries(filter).every(([key, value]) =>
      value && value.$in
        ? value.$in.some(id => String(row[key]) === String(id))
        : String(row[key]) === String(value)
    );

  const apply = (record, update) => {
    if (update.$set) {
      Object.assign(record, update.$set);
    }

    for (const [key, value] of Object.entries(update.$inc || {})) {
      record[key] = (record[key] || 0) + value;
    }
  };

  const count = getter => ({
    session: async () => getter(),
    then(resolve, reject) {
      return Promise.resolve(getter()).then(resolve, reject);
    }
  });

  const Review = {
    async create([input], options) {
      assert.equal(options.session, session);

      const doc = new (createModels(mongoose).Review)(input);
      await doc.validate();

      const record = {
        ...input,
        likeCount: 0,
        _id: new mongoose.Types.ObjectId(
          (sequence++).toString(16).padStart(24, '0')
        ),
        createdAt: new Date()
      };

      state.reviews.push(record);
      return [record];
    },

    findById(id) {
      return query(() =>
        state.reviews.find(row => String(row._id) === String(id)) || null
      );
    },

    async updateOne(filter, update) {
      const record = state.reviews.find(row => match(row, filter));
      if (record) apply(record, update);
    },

    async deleteOne(filter) {
      state.reviews = state.reviews.filter(row => !match(row, filter));
    },

    countDocuments(filter) {
      return count(() =>
        state.reviews.filter(row => match(row, filter)).length
      );
    },

    aggregate(pipeline) {
      return {
        session: async () => {
          const rows = state.reviews.filter(row =>
            match(row, pipeline[0].$match)
          );

          return rows.length ? [{
            averageRating:
              rows.reduce((sum, row) => sum + row.rating, 0) / rows.length,
            reviewCount: rows.length,
            spicinessRatings: rows.map(row => row.spicinessRating)
          }] : [];
        }
      };
    },

    find(filter) {
      let offset = 0;
      let limit = 20;
      let ordering = {};

      return {
        sort(value) {
          ordering = value;
          return this;
        },
        skip(value) {
          offset = value;
          return this;
        },
        limit(value) {
          limit = value;
          return this;
        },
        lean: async () =>
          state.reviews
            .filter(row => match(row, filter))
            .slice()
            .sort((a, b) => {
              for (const [key, direction] of Object.entries(ordering)) {
                const av = a[key] ?? 0;
                const bv = b[key] ?? 0;
                const difference = typeof av === 'number'
                  ? av - bv
                  : String(av).localeCompare(String(bv));

                if (difference) return difference * direction;
              }
              return 0;
            })
            .slice(offset, offset + limit)
            .map(row => ({ ...row }))
      };
    }
  };

  const ReviewLike = {
    find(filter) {
      return {
        lean: async () => state.likes
          .filter(like => match(like, filter))
          .map(like => ({ ...like }))
      };
    },

    async updateOne(filter, update, options) {
      assert.equal(options.session, session);

      if (!state.likes.some(like => match(like, filter))) {
        state.likes.push({ ...update.$setOnInsert });
      }
    },

    async deleteOne(filter) {
      state.likes = state.likes.filter(like => !match(like, filter));
    },

    async deleteMany(filter) {
      state.likes = state.likes.filter(like => !match(like, filter));
    },

    countDocuments(filter) {
      return count(() =>
        state.likes.filter(like => match(like, filter)).length
      );
    }
  };

  const Dish = {
    findById(id) {
      return query(() =>
        state.dishes.find(dish => dish.id === id) || null
      );
    },

    async updateOne(filter, update, options) {
      assert.equal(options.session, session);

      if (state.failUpdate) {
        throw new Error('Database failure containing private details');
      }

      Object.assign(
        state.dishes.find(dish => dish.id === filter._id),
        update.$set
      );
    }
  };

  const Restaurant = {
    findById(id) {
      return query(() =>
        id === restaurantId || id === fixtures.dishes[2].restaurantId
          ? { _id: id }
          : null
      );
    }
  };

  const fakeMongoose = {
    Types: mongoose.Types,
    connection: {
      async transaction(callback) {
        const originalReviews = state.reviews.map(row => ({ ...row }));
        const originalDishes = state.dishes.map(row => ({ ...row }));
        const originalLikes = state.likes.map(row => ({ ...row }));

        try {
          return await callback(session);
        } catch (error) {
          state.reviews = originalReviews;
          state.dishes = originalDishes;
          state.likes = originalLikes;
          throw error;
        }
      }
    }
  };

  return {
    state,
    service: createReviewService({
      mongoose: fakeMongoose,
      Review,
      ReviewLike,
      Dish,
      Restaurant
    })
  };
}

test('create review uses authenticated identity and updates dish statistics', async () => {
  const { service, state } = harness();

  await service.create({
    ...payload,
    userId: 'spoofed',
    averageRating: 1,
    comment: '  Good  '
  }, userId);

  await service.create({ ...payload, rating: 3 }, userId);

  assert.equal(String(state.reviews[0].userId), userId);
  assert.equal(state.reviews[0].comment, 'Good');
  assert.equal(state.dishes[0].averageRating, 4);
  assert.equal(state.dishes[0].reviewCount, 2);
});

test('restaurant and dish reviews are separated; public results omit userId', async () => {
  const { service } = harness();

  await service.create(payload, userId);
  await service.create({
    ...payload,
    dishId: undefined,
    reviewType: 'restaurant',
    rating: 2
  }, userId);

  const dishes = await service.list({
    restaurantId,
    dishId,
    reviewType: 'dish'
  });

  const restaurant = await service.list({
    restaurantId,
    reviewType: 'restaurant'
  });

  assert.equal(dishes.statistics.averageRating, 5);
  assert.equal(restaurant.statistics.averageRating, 2);
  assert.equal(restaurant.reviews.length, 1);
  assert.ok(!('userId' in restaurant.reviews[0]));
});

test('reject invalid stars, empty comments, photos, missing IDs and mismatched targets', async () => {
  const { service, state } = harness();

  const invalidInputs = [
    { rating: 0 },
    { rating: 6 },
    { rating: 2.5 },
    { comment: ' ' },
    { comment: 'a'.repeat(2001) },
    { photoUrls: ['file:///x'] },
    { restaurantId: 'bad' },
    { dishId: null },
    { reviewType: 'restaurant' },
    { spicinessRating: 0 },
    { spicinessRating: 6 },
    { spicinessRating: 2.5 },
    { spicinessRating: '3' }
  ];

  for (const patch of invalidInputs) {
    await assert.rejects(
      service.create({ ...payload, ...patch }, userId),
      error => error.status === 400
    );
  }

  await assert.rejects(
    service.create({
      ...payload,
      restaurantId: fixtures.dishes[2].restaurantId
    }, userId),
    error => error.status === 400
  );

  await assert.rejects(
    service.create({
      ...payload,
      dishId: '200000000000000000000099'
    }, userId),
    error => error.status === 404
  );

  await assert.rejects(
    service.create(payload, null),
    error => error.status === 401
  );

  await assert.rejects(
    service.create(null, userId),
    error => error.status === 400
  );

  assert.equal(state.reviews.length, 0);
});

test('statistics failure rolls back review creation in the transaction contract', async () => {
  const { service, state } = harness();
  state.failUpdate = true;

  await assert.rejects(
    service.create(payload, userId),
    /Database failure/
  );

  assert.equal(state.reviews.length, 0);
});

test('list pagination and empty statistics are explicit', async () => {
  const { service } = harness();

  const empty = await service.list({
    restaurantId,
    dishId,
    reviewType: 'dish'
  });

  assert.deepEqual(empty.statistics, emptyStatistics);

  for (let n = 0; n < 21; n++) {
    await service.create(payload, userId);
  }

  const second = await service.list({
    restaurantId,
    dishId,
    reviewType: 'dish',
    page: '2'
  });

  assert.equal(second.reviews.length, 1);
  assert.equal(second.pagination.total, 21);

  await assert.rejects(
    service.list({
      restaurantId,
      reviewType: 'restaurant',
      page: '-1'
    }),
    error => error.status === 400
  );
});

test('demo repository submits reviews, updates mock ratings, and remains isolated', async () => {
  const copy = JSON.parse(JSON.stringify(fixtures));
  const repo = createReviewRepository({ fixtures: copy });

  const created = await repo.create(payload);

  assert.equal(created.statistics.averageRating, 4.5);
  assert.equal(copy.dishes[0].reviewCount, 2);
  assert.equal(fixtures.dishes[0].reviewCount, 1);

  const list = await repo.list({
    restaurantId,
    reviewType: 'restaurant'
  });

  assert.equal(list.reviews.length, 1);
  await assert.rejects(repo.create({ ...payload, rating: 0 }), /1–5/);
});

test('live repository requires token, sends bearer header and excludes supplied userId', async () => {
  let request;

  const repo = createReviewRepository({
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        json: async () => ({ review: {}, statistics: {} })
      };
    }
  });

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

  User.findById = async id =>
    id === userId ? { _id: userId, username: 'Test' } : null;

  const { service, state } = harness();
  const app = express();
  app.use(express.json());
  app.use('/api/reviews', createReviewRouter({ service, authenticate }));

  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(
      0,
      '127.0.0.1',
      () => resolve(listener)
    );
    listener.once('error', reject);
  });

  const url = `http://127.0.0.1:${server.address().port}/api/reviews`;

  try {
    const invalidTokens = [
      null,
      'invalid',
      jwt.sign(
        { id: userId },
        process.env.JWT_SECRET,
        { algorithm: 'HS256' }
      ),
      jwt.sign(
        { id: userId, tokenVersion: 0 },
        'wrong-secret'
      )
    ];

    for (const token of invalidTokens) {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      assert.equal(response.status, 401);
    }

    const token = jwt.sign(
      { id: userId, tokenVersion: 0 },
      process.env.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1m' }
    );

    const authenticated = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: authenticated,
      body: JSON.stringify({ ...payload, userId: 'spoofed' })
    });

    assert.equal(response.status, 201);
    assert.equal(String(state.reviews[0].userId), userId);

    const list = await fetch(
      `${url}?restaurantId=${restaurantId}&reviewType=dish&dishId=${dishId}`
    );

    assert.equal(list.status, 200);
    assert.equal((await list.json()).reviews.length, 1);

    const invalid = await fetch(
      `${url}?restaurantId=bad&reviewType=dish`
    );
    assert.equal(invalid.status, 400);

    const reviewId = String(state.reviews[0]._id);

    assert.equal((await fetch(`${url}/${reviewId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: 2 })
    })).status, 401);

    assert.equal((await fetch(`${url}/${reviewId}`, {
      method: 'DELETE'
    })).status, 401);

    assert.equal((await fetch(`${url}/${reviewId}/like`, {
      method: 'POST'
    })).status, 401);

    assert.equal((await fetch(`${url}/mine`)).status, 401);

    const edited = await fetch(`${url}/${reviewId}`, {
      method: 'PUT',
      headers: authenticated,
      body: JSON.stringify({ rating: 2 })
    });

    assert.equal(edited.status, 200);
    assert.equal((await edited.json()).statistics.averageRating, 2);

    const liked = await fetch(`${url}/${reviewId}/like`, {
      method: 'POST',
      headers: authenticated
    });

    assert.deepEqual(await liked.json(), {
      likeCount: 1,
      likedByMe: true
    });

    const mine = await fetch(`${url}/mine`, {
      headers: authenticated
    });

    assert.equal((await mine.json()).reviews.length, 1);

    const unlike = await fetch(`${url}/${reviewId}/like`, {
      method: 'DELETE',
      headers: authenticated
    });

    assert.equal((await unlike.json()).likeCount, 0);

    const deleted = await fetch(`${url}/${reviewId}`, {
      method: 'DELETE',
      headers: authenticated
    });

    assert.equal((await deleted.json()).statistics.reviewCount, 0);

    state.failUpdate = true;

    const failed = await fetch(url, {
      method: 'POST',
      headers: authenticated,
      body: JSON.stringify(payload)
    });

    assert.equal(failed.status, 500);
    assert.deepEqual(await failed.json(), {
      message: 'Review service unavailable'
    });
  } finally {
    User.findById = originalFind;

    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }

    await new Promise(resolve => server.close(resolve));
  }
});

test('only owner can edit or delete; targets and author cannot be changed', async () => {
  const { service, state } = harness();
  const { review } = await service.create(payload, userId);
  const other = '400000000000000000000099';

  await assert.rejects(
    service.edit(review.id, { rating: 1 }, other),
    error => error.status === 403
  );

  await assert.rejects(
    service.remove(review.id, other),
    error => error.status === 403
  );

  const invalidChanges = [
    { userId: other },
    { restaurantId: other },
    { dishId: other },
    { rating: 0 },
    { rating: null },
    { comment: ' ' },
    {}
  ];

  for (const patch of invalidChanges) {
    await assert.rejects(
      service.edit(review.id, patch, userId),
      error => error.status === 400
    );
  }

  assert.equal(state.reviews[0].rating, 5);

  const edited = await service.edit(
    review.id,
    { rating: 2, comment: '  Revised  ' },
    userId
  );

  assert.equal(edited.statistics.averageRating, 2);
  assert.equal(state.dishes[0].averageRating, 2);
  assert.equal(edited.review.comment, 'Revised');

  const removed = await service.remove(review.id, userId);

  assert.deepEqual(removed.statistics, emptyStatistics);
  assert.equal(state.reviews.length, 0);
  assert.equal(state.dishes[0].averageRating, null);
});

test('edit and delete roll back when dish statistic update fails', async () => {
  const { service, state } = harness();
  const { review } = await service.create(payload, userId);

  await service.like(review.id, userId, true);
  state.failUpdate = true;

  await assert.rejects(service.edit(review.id, { rating: 1 }, userId));
  assert.equal(state.reviews[0].rating, 5);

  await assert.rejects(service.remove(review.id, userId));
  assert.equal(state.reviews.length, 1);
  assert.equal(state.likes.length, 1);
});

test('likes and unlikes are idempotent; most-liked sorting and cleanup work', async () => {
  const { service, state } = harness();
  const first = (await service.create(payload, userId)).review;

  await service.create(payload, userId);

  assert.deepEqual(
    await service.like(first.id, userId, true),
    { likeCount: 1, likedByMe: true }
  );

  await service.like(first.id, userId, true);
  assert.equal(state.likes.length, 1);

  const list = await service.list({
    restaurantId,
    dishId,
    reviewType: 'dish',
    sort: 'mostLiked'
  }, userId);

  assert.equal(list.reviews[0].id, first.id);
  assert.equal(list.reviews[0].likedByMe, true);
  assert.equal(list.reviews[0].isOwner, true);

  const publicList = await service.list({
    restaurantId,
    dishId,
    reviewType: 'dish'
  });

  assert.equal(publicList.reviews[0].isOwner, false);

  await service.like(first.id, userId, false);

  assert.deepEqual(
    await service.like(first.id, userId, false),
    { likeCount: 0, likedByMe: false }
  );

  await service.like(first.id, userId, true);
  await service.remove(first.id, userId);

  assert.equal(state.likes.length, 0);

  await assert.rejects(
    service.like(first.id, userId, true),
    error => error.status === 404
  );
});

test('my review history excludes other users and requires authentication', async () => {
  const { service } = harness();

  await service.create(payload, userId);
  await service.create(payload, '400000000000000000000099');

  const mine = await service.mine({}, userId);

  assert.equal(mine.reviews.length, 1);
  assert.equal(mine.pagination.total, 1);
  assert.equal(mine.reviews[0].isOwner, true);

  await assert.rejects(
    service.mine({}, null),
    error => error.status === 401
  );

  await assert.rejects(
    service.list({
      restaurantId,
      reviewType: 'restaurant',
      sort: 'invalid'
    }),
    error => error.status === 400
  );
});

test('demo editing, deletion, likes, sort and ownership match the API contract', async () => {
  const copy = JSON.parse(JSON.stringify(fixtures));
  const repo = createReviewRepository({ fixtures: copy });

  await assert.rejects(repo.edit(fixtures.reviews[0].id, { rating: 2 }), /own/);
  await assert.rejects(repo.remove(fixtures.reviews[0].id), /own/);

  const created = await repo.create(payload);
  const edited = await repo.edit(created.review.id, {
    rating: 2,
    comment: 'Changed'
  });

  assert.equal(edited.statistics.averageRating, 3);

  await repo.like(fixtures.reviews[0].id, true);
  await repo.like(fixtures.reviews[0].id, true);

  const list = await repo.list(
    { restaurantId, dishId, reviewType: 'dish' },
    1,
    'mostLiked'
  );

  assert.equal(list.reviews[0].id, fixtures.reviews[0].id);
  assert.equal(list.reviews[0].likeCount, 1);
  assert.equal((await repo.mine()).reviews.length, 1);

  await repo.remove(created.review.id);

  assert.equal(copy.dishes[0].averageRating, 4);
  assert.equal((await repo.mine()).reviews.length, 0);
});

test('create and list reviews preserve spiciness separately from overall rating', async () => {
  const { service } = harness();

  const created = await service.create({
    ...payload,
    rating: 5,
    spicinessRating: 2
  }, userId);

  assert.equal(created.review.rating, 5);
  assert.equal(created.review.spicinessRating, 2);

  const listed = await service.list({
    restaurantId,
    dishId,
    reviewType: 'dish'
  });

  assert.equal(listed.reviews[0].rating, 5);
  assert.equal(listed.reviews[0].spicinessRating, 2);
});

test('editing spiciness preserves overall rating and rejects invalid values', async () => {
  const { service } = harness();

  const created = await service.create({
    ...payload,
    rating: 5,
    spicinessRating: 2
  }, userId);

  const edited = await service.edit(
    created.review.id,
    { spicinessRating: 4 },
    userId
  );

  assert.equal(edited.review.rating, 5);
  assert.equal(edited.review.spicinessRating, 4);

  for (const spicinessRating of [0, 6, 2.5, '3']) {
    await assert.rejects(
      service.edit(created.review.id, { spicinessRating }, userId),
      error => error.status === 400
    );
  }
});

test('spiciness statistics update after creating, editing and deleting reviews', async () => {
  const { service, state } = harness();

  const first = await service.create({
    ...payload,
    spicinessRating: 1
  }, userId);

  const second = await service.create({
    ...payload,
    spicinessRating: 4
  }, userId);

  assert.equal(second.statistics.medianSpiciness, 2.5);
  assert.equal(second.statistics.spicinessRatingCount, 2);
  assert.equal(second.statistics.spicinessDistribution.level1, 1);
  assert.equal(second.statistics.spicinessDistribution.level4, 1);
  assert.equal(state.dishes[0].medianSpiciness, 2.5);

  const edited = await service.edit(
    first.review.id,
    { spicinessRating: 2 },
    userId
  );

  assert.equal(edited.statistics.medianSpiciness, 3);
  assert.equal(edited.statistics.spicinessDistribution.level1, 0);
  assert.equal(edited.statistics.spicinessDistribution.level2, 1);
  assert.equal(state.dishes[0].medianSpiciness, 3);

  const removed = await service.remove(second.review.id, userId);

  assert.equal(removed.statistics.medianSpiciness, 2);
  assert.equal(removed.statistics.spicinessRatingCount, 1);
  assert.equal(state.dishes[0].medianSpiciness, 2);

  const listed = await service.list({
    restaurantId,
    dishId,
    reviewType: 'dish'
  });

  assert.equal(listed.statistics.medianSpiciness, 2);

  const empty = await service.remove(first.review.id, userId);

  assert.deepEqual(empty.statistics, emptyStatistics);
  assert.equal(state.dishes[0].medianSpiciness, null);
  assert.equal(state.dishes[0].spicinessRatingCount, 0);
});