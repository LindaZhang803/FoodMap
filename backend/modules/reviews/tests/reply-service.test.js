const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createReplyService } = require('../services/reply.service');

const reviewId = '100000000000000000000001';
const userId = '400000000000000000000001';
const otherUserId = '400000000000000000000002';

function harness() {
  const state = {
    replies: [],
    failCreate: false
  };

  const session = {};
  let sequence = 1;

  const query = value => ({
    session() {
      return this;
    },
    lean: async () => value
  });

  const Review = {
    findById(id) {
      return query(id === reviewId ? { _id: reviewId } : null);
    },

    async updateOne(filter, update, options) {
      assert.equal(options.session, session);
      assert.equal(filter._id, reviewId);
      return { matchedCount: 1 };
    }
  };

  const ReviewReply = {
    async create([input], options) {
      assert.equal(options.session, session);

      if (state.failCreate) {
        throw new Error('Test database failure');
      }

      const reply = {
        ...input,
        _id: (sequence++).toString(16).padStart(24, '0'),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      state.replies.push(reply);
      return [reply];
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
        lean: async () => state.replies
          .filter(reply => reply.reviewId === filter.reviewId)
          .slice(offset, offset + limit)
          .map(reply => ({ ...reply }))
      };
    },

    async countDocuments(filter) {
      return state.replies.filter(
        reply => reply.reviewId === filter.reviewId
      ).length;
    },

    findById(id) {
      return query(
        state.replies.find(reply => reply._id === id) || null
      );
    },

    async deleteOne(filter, options) {
      assert.equal(options.session, session);

      const before = state.replies.length;

      state.replies = state.replies.filter(reply =>
        !(
          reply._id === filter._id &&
          reply.userId === filter.userId &&
          reply.reviewId === filter.reviewId
        )
      );

      return {
        deletedCount: before - state.replies.length
      };
    }
  };

  const mongoose = {
    connection: {
      async transaction(callback) {
        const backup = state.replies.map(reply => ({ ...reply }));

        try {
          return await callback(session);
        } catch (error) {
          state.replies = backup;
          throw error;
        }
      }
    }
  };

  return {
    state,
    service: createReplyService({
      mongoose,
      Review,
      ReviewReply
    })
  };
}

test('creates replies using authenticated identity and trims text', async () => {
  const { service } = harness();

  const result = await service.create(
    reviewId,
    { comment: '  Thanks!  ' },
    userId
  );

  assert.equal(result.reply.reviewId, reviewId);
  assert.equal(result.reply.userId, userId);
  assert.equal(result.reply.comment, 'Thanks!');
  assert.equal(result.reply.isOwner, true);
});

test('lists replies with pagination and ownership', async () => {
  const { service } = harness();

  for (let i = 0; i < 21; i++) {
    await service.create(reviewId, { comment: `Reply ${i}` }, userId);
  }

  const first = await service.list(reviewId, {}, userId);
  assert.equal(first.replies.length, 20);
  assert.equal(first.replies[0].isOwner, true);

  const second = await service.list(reviewId, { page: '2' });
  assert.equal(second.replies.length, 1);
  assert.equal(second.replies[0].isOwner, false);
  assert.equal(second.pagination.total, 21);

  await assert.rejects(
    service.list(reviewId, { page: 0 }),
    error => error.status === 400
  );
});

test('rejects invalid input, missing reviews and unauthenticated users', async () => {
  const { service, state } = harness();

  for (const comment of ['', ' ', 'a'.repeat(1001), 123]) {
    await assert.rejects(
      service.create(reviewId, { comment }, userId),
      error => error.status === 400
    );
  }

  await assert.rejects(
    service.create(reviewId, { comment: 'Hello' }, null),
    error => error.status === 401
  );

  await assert.rejects(
    service.create('bad', { comment: 'Hello' }, userId),
    error => error.status === 400
  );

  await assert.rejects(
    service.create(
      '100000000000000000000099',
      { comment: 'Hello' },
      userId
    ),
    error => error.status === 404
  );

  await assert.rejects(
    service.create(
      reviewId,
      { comment: 'Hello', userId: otherUserId },
      userId
    ),
    error => error.status === 400
  );

  assert.equal(state.replies.length, 0);
});

test('only the reply author can delete a reply', async () => {
  const { service, state } = harness();

  const created = await service.create(
    reviewId,
    { comment: 'My reply' },
    userId
  );

  await assert.rejects(
    service.remove(reviewId, created.reply.id, otherUserId),
    error => error.status === 403
  );

  assert.equal(state.replies.length, 1);

  const result = await service.remove(
    reviewId,
    created.reply.id,
    userId
  );

  assert.deepEqual(result, { deleted: true });
  assert.equal(state.replies.length, 0);

  await assert.rejects(
    service.remove(reviewId, created.reply.id, userId),
    error => error.status === 404
  );
});

test('failed reply creation does not leave a stored reply', async () => {
  const { service, state } = harness();
  state.failCreate = true;

  await assert.rejects(
    service.create(reviewId, { comment: 'Hello' }, userId),
    /Test database failure/
  );

  assert.equal(state.replies.length, 0);
});