const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const express = require('express');
const request = require('supertest');

const { createReportModel } = require('../models/report');
const { createReportService } = require('../services/report.service');
const { createReviewService } = require('../services/review.service');
const {
  createReportRouter,
  createReportAdminRouter
} = require('../routes/report.routes');

const reviewId = '100000000000000000000001';
const userId = '400000000000000000000001';
const restaurantId = '500000000000000000000001';

function harness() {
  const state = { reports: [] };
  const session = {};
  let sequence = 1;

  const Review = {
    findById(id) {
      return {
        session() {
          return this;
        },
        lean: async () => id === reviewId ? { _id: id } : null
      };
    },

    async updateOne(filter, update, options) {
      assert.equal(options.session, session);
      return { matchedCount: 1 };
    }
  };

  const ReviewReport = {
    async create([input], options) {
      assert.equal(options.session, session);

      const duplicate = state.reports.some(report =>
        report.reviewId === input.reviewId &&
        report.reportedBy === input.reportedBy
      );

      if (duplicate) {
        const error = new Error('Duplicate report');
        error.code = 11000;
        throw error;
      }

      const report = {
        ...input,
        _id: (sequence++).toString(16).padStart(24, '0'),
        createdAt: new Date()
      };

      state.reports.push(report);
      return [report];
    },

    find(filter) {
      let offset = 0;
      let limit = 20;

      return {
        sort() {
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
        lean: async () => state.reports
          .filter(report => report.status === filter.status)
          .slice(offset, offset + limit)
      };
    },

    async countDocuments(filter) {
      return state.reports.filter(
        report => report.status === filter.status
      ).length;
    },

    findOneAndUpdate(filter, update) {
      return {
        lean: async () => {
          const index = state.reports.findIndex(
            report => report._id === filter._id
          );

          if (index === -1) return null;

          const updated = {
            ...state.reports[index],
            ...update.$set
          };

          state.reports = state.reports.map((report, i) =>
            i === index ? updated : report
          );

          return updated;
        }
      };
    }
  };

  const fakeMongoose = {
    connection: {
      async transaction(callback) {
        const backup = state.reports.map(report => ({ ...report }));

        try {
          return await callback(session);
        } catch (error) {
          state.reports = backup;
          throw error;
        }
      }
    }
  };

  return {
    state,
    service: createReportService({
      mongoose: fakeMongoose,
      Review,
      ReviewReport
    })
  };
}

test('reports validate input, use authenticated identity and prevent duplicates', async () => {
  const isolated = new mongoose.Mongoose();
  const Model = createReportModel(isolated);

  assert.ok(
    Model.schema.indexes().some(([fields, options]) =>
      fields.reviewId === 1 &&
      fields.reportedBy === 1 &&
      options.unique
    )
  );

  const { service, state } = harness();

  const created = await service.submit(
    reviewId,
    { reason: 'Spam' },
    userId
  );

  assert.equal(created.report.reportedBy, userId);
  assert.equal(created.report.status, 'pending');

  await assert.rejects(
    service.submit(reviewId, { reason: 'Spam' }, userId),
    error => error.status === 409
  );

  await assert.rejects(
    service.submit(reviewId, { reason: 'Low rating' }, userId),
    error => error.status === 400
  );

  await assert.rejects(
    service.submit(reviewId, { reason: 'Spam' }, null),
    error => error.status === 401
  );

  await assert.rejects(
    service.submit(
      '100000000000000000000099',
      { reason: 'Spam' },
      userId
    ),
    error => error.status === 404
  );

  assert.equal(state.reports.length, 1);
});

test('report endpoints protect submission and administrator processing', async () => {
  const { service } = harness();
  const previousKey = process.env.ADMIN_API_KEY;
  const adminKey = crypto.randomBytes(32).toString('hex');

  process.env.ADMIN_API_KEY = adminKey;

  const authenticate = (req, res, next) => {
    if (req.get('Authorization') !== 'Bearer owner') {
      return res.sendStatus(401);
    }

    req.user = { id: userId };
    next();
  };

  const app = express();
  app.use(express.json());

  app.use(
    '/api/reviews',
    createReportRouter({ service, authenticate })
  );

  app.use(
    '/api/review-reports',
    createReportAdminRouter({ service })
  );

  try {
    const path = `/api/reviews/${reviewId}/report`;

    assert.equal(
      (await request(app).post(path).send({ reason: 'Spam' })).status,
      401
    );

    const submitted = await request(app)
      .post(path)
      .set('Authorization', 'Bearer owner')
      .send({ reason: 'Spam' });

    assert.equal(submitted.status, 201);

    assert.equal(
      (await request(app).get('/api/review-reports')).status,
      401
    );

    assert.equal(
      (await request(app)
        .get('/api/review-reports')
        .set('x-admin-key', 'incorrect')).status,
      403
    );

    const listed = await request(app)
      .get('/api/review-reports')
      .set('x-admin-key', adminKey);

    assert.equal(listed.status, 200);
    assert.equal(listed.body.reports.length, 1);

    const reportId = submitted.body.report.id;

    const invalid = await request(app)
      .patch(`/api/review-reports/${reportId}`)
      .set('x-admin-key', adminKey)
      .send({ status: 'deleted' });

    assert.equal(invalid.status, 400);

    const resolved = await request(app)
      .patch(`/api/review-reports/${reportId}`)
      .set('x-admin-key', adminKey)
      .send({ status: 'resolved' });

    assert.equal(resolved.status, 200);
    assert.equal(resolved.body.report.status, 'resolved');
    assert.ok(resolved.body.report.resolvedAt);
  } finally {
    if (previousKey === undefined) {
      delete process.env.ADMIN_API_KEY;
    } else {
      process.env.ADMIN_API_KEY = previousKey;
    }
  }
});

test('deleting a review also deletes its reports in the same transaction', async () => {
  const session = {};
  let reportsDeleted = false;

  const service = createReviewService({
    mongoose: {
      Types: mongoose.Types,
      connection: {
        transaction: callback => callback(session)
      }
    },

    Review: {
      findById() {
        return {
          session() {
            return this;
          },
          lean: async () => ({
            _id: reviewId,
            userId,
            restaurantId,
            reviewType: 'restaurant'
          })
        };
      },

      async deleteOne() {},

      aggregate() {
        return {
          session: async () => []
        };
      }
    },

    ReviewLike: {
      async deleteMany() {}
    },

    ReviewReport: {
      async deleteMany(filter, options) {
        assert.equal(filter.reviewId, reviewId);
        assert.equal(options.session, session);
        reportsDeleted = true;
      }
    }
  });

  await service.remove(reviewId, userId);
  assert.equal(reportsDeleted, true);
});