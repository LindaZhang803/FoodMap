const isId = value =>
  typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function requireUser(userId) {
  if (!isId(userId)) {
    fail(401, 'Authentication required');
  }
}

function requireId(id, label) {
  if (!isId(id)) {
    fail(400, `Invalid ${label} ID`);
  }
}

function serializeReply(document, viewerId) {
  const reply = typeof document.toObject === 'function'
    ? document.toObject()
    : document;

  return {
    id: String(reply._id),
    reviewId: String(reply.reviewId),
    userId: String(reply.userId),
    comment: reply.comment,
    isOwner: Boolean(viewerId) && String(reply.userId) === viewerId,
    createdAt: reply.createdAt,
    updatedAt: reply.updatedAt
  };
}

function createReplyService({ mongoose, Review, ReviewReply }) {
  async function requireReview(reviewId, session = null) {
    requireId(reviewId, 'review');

    const review = await Review.findById(reviewId)
      .session(session)
      .lean();

    if (!review) {
      fail(404, 'Review not found');
    }

    return review;
  }

  function parsePage(value) {
    const page = value === undefined ? 1 : Number(value);

    if (!Number.isSafeInteger(page) || page < 1 || page > 10000) {
      fail(400, 'Invalid page');
    }

    return page;
  }

  return {
    async list(reviewId, query = {}, viewerId) {
      const page = parsePage(query.page);
      const limit = 20;

      await requireReview(reviewId);

      const filter = { reviewId };

      const [replies, total] = await Promise.all([
        ReviewReply.find(filter)
          .sort({ createdAt: 1, _id: 1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        ReviewReply.countDocuments(filter)
      ]);

      return {
        replies: replies.map(reply => serializeReply(reply, viewerId)),
        pagination: { page, limit, total }
      };
    },

    async create(reviewId, input, userId) {
      requireUser(userId);
      requireId(reviewId, 'review');

      if (
        !input ||
        typeof input !== 'object' ||
        Array.isArray(input) ||
        !Object.hasOwn(input, 'comment') ||
        Object.keys(input).some(key => key !== 'comment')
      ) {
        fail(400, 'Only comment can be submitted');
      }

      if (
        typeof input.comment !== 'string' ||
        !input.comment.trim() ||
        input.comment.length > 1000
      ) {
        fail(400, 'comment must contain 1-1000 characters');
      }

      return mongoose.connection.transaction(async session => {
        await requireReview(reviewId, session);

        // Coordinate reply creation with deletion of the parent review.
        await Review.updateOne(
          { _id: reviewId },
          { $inc: { __v: 1 } },
          { session }
        );

        const [reply] = await ReviewReply.create(
          [{
            reviewId,
            userId,
            comment: input.comment.trim()
          }],
          { session }
        );

        return {
          reply: serializeReply(reply, userId)
        };
      });
    },

    async remove(reviewId, replyId, userId) {
      requireUser(userId);
      requireId(reviewId, 'review');
      requireId(replyId, 'reply');

      return mongoose.connection.transaction(async session => {
        const reply = await ReviewReply.findById(replyId)
          .session(session)
          .lean();

        if (!reply || String(reply.reviewId) !== reviewId) {
          fail(404, 'Reply not found');
        }

        if (String(reply.userId) !== userId) {
          fail(403, 'You can only delete your own replies');
        }

        const result = await ReviewReply.deleteOne(
          {
            _id: replyId,
            reviewId,
            userId
          },
          { session }
        );

        if (!result.deletedCount) {
          fail(404, 'Reply not found');
        }

        return { deleted: true };
      });
    }
  };
}

module.exports = { createReplyService };