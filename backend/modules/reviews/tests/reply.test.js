const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { createReplyModel } = require('../models/reply');

const isolated = new mongoose.Mongoose();
const ReviewReply = createReplyModel(isolated);

const validReply = {
  reviewId: '100000000000000000000001',
  userId: '400000000000000000000001',
  comment: 'Thanks for sharing!'
};

test('reply stores its parent review, author and trimmed comment', async () => {
  const reply = new ReviewReply({
    ...validReply,
    comment: '  Thanks for sharing!  '
  });

  await reply.validate();

  assert.equal(String(reply.reviewId), validReply.reviewId);
  assert.equal(String(reply.userId), validReply.userId);
  assert.equal(reply.comment, 'Thanks for sharing!');
});

test('reply requires a parent review and author', async () => {
  await assert.rejects(
    new ReviewReply({
      userId: validReply.userId,
      comment: 'Hello'
    }).validate()
  );

  await assert.rejects(
    new ReviewReply({
      reviewId: validReply.reviewId,
      comment: 'Hello'
    }).validate()
  );
});

test('reply rejects empty or overly long comments', async () => {
  for (const comment of ['', '   ', 'a'.repeat(1001)]) {
    await assert.rejects(
      new ReviewReply({ ...validReply, comment }).validate()
    );
  }
});

test('reply rejects invalid review and user IDs', async () => {
  await assert.rejects(
    new ReviewReply({
      ...validReply,
      reviewId: 'invalid'
    }).validate()
  );

  await assert.rejects(
    new ReviewReply({
      ...validReply,
      userId: 'invalid'
    }).validate()
  );
});