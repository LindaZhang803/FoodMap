const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');

const { createReplyRouter } = require('../routes/reply.routes');
const { createReviewService } = require('../services/review.service');

const reviewId = '100000000000000000000001';
const replyId = '200000000000000000000001';
const userId = '400000000000000000000001';
const otherUserId = '400000000000000000000002';
const restaurantId = '500000000000000000000001';
const dishId = '600000000000000000000001';

function authenticate(req, res, next) {
  const token = req.get('Authorization');

  if (token === 'Bearer owner') {
    req.user = { id: userId };
    return next();
  }

  if (token === 'Bearer other') {
    req.user = { id: otherUserId };
    return next();
  }

  return res.status(401).json({
    message: 'Authentication required'
  });
}

function makeApp(service) {
  const app = express();
  app.use(express.json());

  app.use(
    '/api/reviews',
    createReplyRouter({ service, authenticate })
  );

  return app;
}

test('reply list is public and forwards pagination', async () => {
  let received;

  const app = makeApp({
    async list(id, query, viewerId) {
      received = { id, query, viewerId };

      return {
        replies: [],
        pagination: { page: 2, limit: 20, total: 0 }
      };
    }
  });

  const response = await request(app)
    .get(`/api/reviews/${reviewId}/replies?page=2`);

  assert.equal(response.status, 200);
  assert.equal(received.id, reviewId);
  assert.equal(received.query.page, '2');
  assert.equal(received.viewerId, undefined);
  assert.deepEqual(response.body.replies, []);

  const invalidToken = await request(app)
    .get(`/api/reviews/${reviewId}/replies`)
    .set('Authorization', 'Bearer invalid');

  assert.equal(invalidToken.status, 401);
});

test('creating replies requires authentication and forwards authenticated identity', async () => {
  let received;

  const app = makeApp({
    async create(id, input, authorId) {
      received = { id, input, authorId };

      return {
        reply: {
          id: replyId,
          reviewId: id,
          userId: authorId,
          comment: input.comment
        }
      };
    }
  });

  const anonymous = await request(app)
    .post(`/api/reviews/${reviewId}/replies`)
    .send({ comment: 'Hello' });

  assert.equal(anonymous.status, 401);
  assert.equal(received, undefined);

  const signedIn = await request(app)
    .post(`/api/reviews/${reviewId}/replies`)
    .set('Authorization', 'Bearer owner')
    .send({ comment: 'Hello' });

  assert.equal(signedIn.status, 201);
  assert.equal(received.authorId, userId);
  assert.equal(received.id, reviewId);
  assert.equal(signedIn.body.reply.comment, 'Hello');
});

test('deleting replies requires authentication and preserves ownership errors', async () => {
  const app = makeApp({
    async remove(id, targetReplyId, authorId) {
      assert.equal(id, reviewId);
      assert.equal(targetReplyId, replyId);

      if (authorId !== userId) {
        const error = new Error('You can only delete your own replies');
        error.status = 403;
        throw error;
      }

      return { deleted: true };
    }
  });

  const path = `/api/reviews/${reviewId}/replies/${replyId}`;

  assert.equal(
    (await request(app).delete(path)).status,
    401
  );

  assert.equal(
    (await request(app)
      .delete(path)
      .set('Authorization', 'Bearer other')).status,
    403
  );

  const removed = await request(app)
    .delete(path)
    .set('Authorization', 'Bearer owner');

  assert.equal(removed.status, 200);
  assert.deepEqual(removed.body, { deleted: true });
});

test('unexpected reply errors do not expose database information', async () => {
  const app = makeApp({
    async list() {
      throw new Error('Private database connection information');
    }
  });

  const response = await request(app)
    .get(`/api/reviews/${reviewId}/replies`);

  assert.equal(response.status, 500);
  assert.deepEqual(response.body, {
    message: 'Reply service unavailable'
  });
});

function deletionHarness() {
  const state = {
    reviews: [{
      _id: reviewId,
      userId,
      restaurantId,
      dishId,
      reviewType: 'dish'
    }],
    replies: [{
      _id: replyId,
      reviewId,
      userId: otherUserId,
      comment: 'Reply from another user'
    }],
    failStatistics: false
  };

  const session = {};

  const Review = {
    findById(id) {
      return {
        session(value) {
          assert.equal(value, session);
          return this;
        },
        lean: async () =>
          state.reviews.find(review => review._id === id) || null
      };
    },

    async deleteOne(filter, options) {
      assert.equal(options.session, session);

      state.reviews = state.reviews.filter(review =>
        !(review._id === filter._id && review.userId === filter.userId)
      );
    },

    aggregate() {
      return {
        session: async () => []
      };
    }
  };

  const ReviewReply = {
    async deleteMany(filter, options) {
      assert.equal(options.session, session);

      state.replies = state.replies.filter(
        reply => reply.reviewId !== filter.reviewId
      );
    }
  };

  const fakeMongoose = {
    Types: mongoose.Types,
    connection: {
      async transaction(callback) {
        const reviews = state.reviews.map(row => ({ ...row }));
        const replies = state.replies.map(row => ({ ...row }));

        try {
          return await callback(session);
        } catch (error) {
          state.reviews = reviews;
          state.replies = replies;
          throw error;
        }
      }
    }
  };

  const service = createReviewService({
    mongoose: fakeMongoose,
    Review,
    ReviewReply,
    ReviewLike: {
      async deleteMany() {}
    },
    Dish: {
      async updateOne() {
        if (state.failStatistics) {
          throw new Error('Statistics update failed');
        }
      }
    }
  });

  return { service, state };
}

test('deleting a review cleans up its replies and rejects non-owners', async () => {
  const { service, state } = deletionHarness();

  await assert.rejects(
    service.remove(reviewId, otherUserId),
    error => error.status === 403
  );

  assert.equal(state.reviews.length, 1);
  assert.equal(state.replies.length, 1);

  await service.remove(reviewId, userId);

  assert.equal(state.reviews.length, 0);
  assert.equal(state.replies.length, 0);
});

test('review and reply deletion roll back together if statistics fail', async () => {
  const { service, state } = deletionHarness();
  state.failStatistics = true;

  await assert.rejects(
    service.remove(reviewId, userId),
    /Statistics update failed/
  );

  assert.equal(state.reviews.length, 1);
  assert.equal(state.replies.length, 1);
});