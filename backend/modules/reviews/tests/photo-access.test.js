const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');
const request = require('supertest');

const {
  createReviewPhotoRouter
} = require('../routes/photo.routes');

const {
  createPhotoModerationRouter
} = require('../routes/photo-moderation.routes');

const photoId = '300000000000000000000001';
const userId = '400000000000000000000001';
const reviewId = '100000000000000000000001';

function authenticate(req, res, next) {
  if (req.get('Authorization') !== 'Bearer owner') {
    return res.status(401).json({
      message: 'Authentication required'
    });
  }

  req.user = { id: userId };
  next();
}

test('photo visibility follows approval status and ownership', async () => {
  let photo = {
    _id: photoId,
    userId,
    reviewId,
    status: 'pending',
    data: Buffer.from('synthetic test image'),
    contentType: 'image/jpeg'
  };

  const app = express();

  app.use('/api/review-photos', createReviewPhotoRouter({
    authenticate,
    ReviewPhoto: {
      findById() {
        return {
          select() {
            return this;
          },
          lean: async () => photo
        };
      }
    },
    Review: {
      exists: async () => true
    }
  }));

  const path = `/api/review-photos/${photoId}/image`;

  // Pending, rejected and old unreviewed photos are private.
  for (const status of ['pending', 'rejected', undefined]) {
    photo = { ...photo, status };

    assert.equal(
      (await request(app).get(path)).status,
      404
    );

    assert.equal(
      (await request(app)
        .get(path)
        .set('Authorization', 'Bearer owner')).status,
      200
    );
  }

  // Approved photos attached to a review are public.
  photo = { ...photo, status: 'approved' };

  assert.equal(
    (await request(app).get(path)).status,
    200
  );

  // An unattached draft must stay private.
  photo = { ...photo, reviewId: null };

  assert.equal(
    (await request(app).get(path)).status,
    404
  );

  assert.equal(
    (await request(app)
      .get('/api/review-photos/invalid/image')).status,
    400
  );
});

test('only an administrator can preview, approve and reject photos', async () => {
  const previousKey = process.env.ADMIN_API_KEY;
  const adminKey = crypto.randomBytes(32).toString('hex');

  process.env.ADMIN_API_KEY = adminKey;

  let photo = {
    _id: photoId,
    userId,
    reviewId,
    status: 'pending',
    data: Buffer.from('synthetic test image'),
    contentType: 'image/jpeg'
  };

  const ReviewPhoto = {
    findById() {
      return {
        select() {
          return this;
        },
        lean: async () => photo
      };
    },

    findOneAndUpdate(filter, update) {
      assert.equal(filter._id, photoId);

      photo = {
        ...photo,
        ...update.$set
      };

      return {
        select() {
          return this;
        },
        lean: async () => photo
      };
    }
  };

  const app = express();
  app.use(express.json());

  app.use(
    '/api/review-photo-moderation',
    createPhotoModerationRouter({ ReviewPhoto })
  );

  const path = `/api/review-photo-moderation/${photoId}`;

  try {
    assert.equal(
      (await request(app).patch(`${path}/approve`)).status,
      401
    );

    assert.equal(
      (await request(app)
        .patch(`${path}/approve`)
        .set('x-admin-key', 'incorrect-key')).status,
      403
    );

    // A normal user token is not administrator authentication.
    assert.equal(
      (await request(app)
        .patch(`${path}/approve`)
        .set('Authorization', 'Bearer owner')).status,
      401
    );

    assert.equal(
      (await request(app)
        .get(`${path}/image`)
        .set('x-admin-key', adminKey)).status,
      200
    );

    const approved = await request(app)
      .patch(`${path}/approve`)
      .set('x-admin-key', adminKey);

    assert.equal(approved.status, 200);
    assert.equal(approved.body.photo.status, 'approved');
    assert.ok(approved.body.photo.reviewedAt);

    const rejected = await request(app)
      .patch(`${path}/reject`)
      .set('x-admin-key', adminKey);

    assert.equal(rejected.status, 200);
    assert.equal(rejected.body.photo.status, 'rejected');
  } finally {
    if (previousKey === undefined) {
      delete process.env.ADMIN_API_KEY;
    } else {
      process.env.ADMIN_API_KEY = previousKey;
    }
  }
});