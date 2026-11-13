const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { createModels } = require('../models');

const isolated = new mongoose.Mongoose();
const { ReviewPhoto } = createModels(isolated);

const photoData = {
  userId: '400000000000000000000001',
  data: Buffer.from('test image data')
};

test('new review photos default to pending', async () => {
  const photo = new ReviewPhoto(photoData);

  await photo.validate();

  assert.equal(photo.status, 'pending');
  assert.equal(photo.reviewedAt, null);
});

test('photo model accepts approved and rejected statuses', async () => {
  for (const status of ['approved', 'rejected']) {
    const reviewedAt = new Date();

    const photo = new ReviewPhoto({
      ...photoData,
      status,
      reviewedAt
    });

    await photo.validate();

    assert.equal(photo.status, status);
    assert.equal(
      photo.reviewedAt.getTime(),
      reviewedAt.getTime()
    );
  }
});

test('photo model rejects unsupported moderation statuses', async () => {
  for (const status of ['published', 'deleted', 'unknown']) {
    await assert.rejects(
      new ReviewPhoto({
        ...photoData,
        status
      }).validate()
    );
  }
});

test('moderation fields preserve photo ownership and draft expiration', async () => {
  const photo = new ReviewPhoto(photoData);

  await photo.validate();

  assert.equal(String(photo.userId), photoData.userId);
  assert.ok(photo.expiresAt instanceof Date);
  assert.ok(photo.expiresAt.getTime() > Date.now());
  assert.equal(ReviewPhoto.collection.name, 'review_photos');
});