const { validateReview } = require('../validators/review');
const {
  calculateSpicinessStatistics
} = require('./spiciness');

const isId = value =>
  typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function parseTarget(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    fail(400, 'Invalid review target');
  }

  const target = {
    restaurantId: input.restaurantId,
    reviewType: input.reviewType
  };

  if (!isId(target.restaurantId)) {
    fail(400, 'Invalid restaurantId');
  }

  if (!['restaurant', 'dish'].includes(target.reviewType)) {
    fail(400, 'Choose restaurant or dish reviews');
  }

  if (target.reviewType === 'dish') {
    if (!isId(input.dishId)) {
      fail(400, 'Dish reviews require a valid dishId');
    }

    target.dishId = input.dishId;
  } else if (input.dishId != null) {
    fail(400, 'Restaurant reviews cannot include dishId');
  }

  return target;
}

const serialize = doc => {
  const value = typeof doc.toObject === 'function'
    ? doc.toObject()
    : doc;

  return {
    id: String(value._id),
    restaurantId: String(value.restaurantId),
    dishId: value.dishId ? String(value.dishId) : null,
    reviewType: value.reviewType,
    rating: value.rating,
    spicinessRating: value.spicinessRating ?? null,
    comment: value.comment,
    photoUrls: value.photoUrls,
    likeCount: value.likeCount || 0,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt
  };
};

function createReviewService({
  mongoose,
  Review,
  ReviewLike,
  ReviewPhoto,
  ReviewReply,
  ReviewReport,
  Dish,
  Restaurant
}) {
  function matchTarget(target) {
    const match = {
      restaurantId: new mongoose.Types.ObjectId(target.restaurantId),
      reviewType: target.reviewType
    };

    if (target.dishId) {
      match.dishId = new mongoose.Types.ObjectId(target.dishId);
    }

    return match;
  }

  async function statistics(target, session) {
    const pipeline = [
      { $match: matchTarget(target) },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          reviewCount: { $sum: 1 },
          spicinessRatings: { $push: '$spicinessRating' }
        }
      }
    ];

    const result = await Review.aggregate(pipeline)
      .session(session || null);

    const summary = result[0];

    return {
      averageRating: summary?.averageRating ?? null,
      reviewCount: summary?.reviewCount ?? 0,
      ...calculateSpicinessStatistics(
        summary?.spicinessRatings || []
      )
    };
  }

  async function assertTarget(target, session) {
    const restaurant = await Restaurant.findById(target.restaurantId)
      .session(session || null)
      .lean();

    if (!restaurant) {
      fail(404, 'Restaurant not found');
    }

    if (target.dishId) {
      const dish = await Dish.findById(target.dishId)
        .session(session || null)
        .lean();

      if (!dish) {
        fail(404, 'Dish not found');
      }

      if (String(dish.restaurantId) !== target.restaurantId) {
        fail(400, 'Dish does not belong to this restaurant');
      }
    }
  }

  async function syncPhotos(urls, reviewId, userId, session) {
    if (!ReviewPhoto) {
      if (urls.length) {
        fail(503, 'Photo service unavailable');
      }

      return;
    }

    const ids = urls.map(url => url.split('/')[3]);
    const photos = await ReviewPhoto.find({ _id: { $in: ids } })
      .session(session)
      .lean();

    if (photos.length !== ids.length) {
      fail(400, 'An uploaded photo is missing or expired');
    }

    for (const photo of photos) {
      if (String(photo.userId) !== userId) {
        fail(403, 'You can only attach your own photos');
      }

      if (
        photo.reviewId &&
        String(photo.reviewId) !== String(reviewId)
      ) {
        fail(400, 'Photo is already attached to another review');
      }

      if (photo.expiresAt && photo.expiresAt <= new Date()) {
        fail(400, 'Photo upload expired');
      }
    }

    await ReviewPhoto.updateMany(
      { _id: { $in: ids } },
      { $set: { reviewId }, $unset: { expiresAt: 1 } },
      { session }
    );

    await ReviewPhoto.deleteMany(
      { reviewId, _id: { $nin: ids } },
      { session }
    );
  }

  function requireUser(userId) {
    if (!isId(userId)) {
      fail(401, 'Authentication required');
    }
  }

  function requireId(id) {
    if (!isId(id)) {
      fail(400, 'Invalid review ID');
    }
  }

  function pageNumber(value) {
    const page = value === undefined ? 1 : Number(value);

    if (!Number.isSafeInteger(page) || page < 1 || page > 10000) {
      fail(400, 'Invalid page');
    }

    return page;
  }

  async function decorate(reviews, viewerId) {
    const likes = viewerId && ReviewLike && reviews.length
      ? await ReviewLike.find({
          userId: viewerId,
          reviewId: { $in: reviews.map(review => review._id) }
        }).lean()
      : [];

    const likedIds = new Set(
      likes.map(like => String(like.reviewId))
    );

    return reviews.map(review => ({
      ...serialize(review),
      isOwner: !!viewerId && String(review.userId) === viewerId,
      likedByMe: likedIds.has(String(review._id))
    }));
  }

  async function updateStatistics(target, session) {
    const stats = await statistics(target, session);

    if (target.dishId) {
      await Dish.updateOne(
        { _id: target.dishId },
        { $set: stats },
        { session, runValidators: true }
      );
    }

    return stats;
  }

  async function findOwned(id, userId, session) {
    requireUser(userId);
    requireId(id);

    const review = await Review.findById(id)
      .session(session)
      .lean();

    if (!review) {
      fail(404, 'Review not found');
    }

    if (String(review.userId) !== userId) {
      fail(403, 'You can only change your own reviews');
    }

    return review;
  }

  function reviewTarget(review) {
    return {
      restaurantId: String(review.restaurantId),
      reviewType: review.reviewType,
      ...(review.dishId
        ? { dishId: String(review.dishId) }
        : {})
    };
  }

  return {
    async list(query, viewerId) {
      const target = parseTarget(query);
      const page = pageNumber(query.page);
      const sort = query.sort || 'mostRecent';

      if (!['mostRecent', 'mostLiked'].includes(sort)) {
        fail(400, 'Invalid review sort');
      }

      await assertTarget(target);

      const limit = 20;
      const filter = matchTarget(target);
      const ordering = sort === 'mostLiked'
        ? { likeCount: -1, createdAt: -1, _id: -1 }
        : { createdAt: -1, _id: -1 };

      const [reviews, stats] = await Promise.all([
        Review.find(filter)
          .sort(ordering)
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        statistics(target)
      ]);

      return {
        reviews: await decorate(reviews, viewerId),
        statistics: stats,
        pagination: { page, limit, total: stats.reviewCount }
      };
    },

    async create(input, userId) {
      requireUser(userId);
      const target = parseTarget(input);

      const payload = {
        ...target,
        rating: input.rating,
        spicinessRating: input.spicinessRating,
        comment: input.comment,
        photoUrls: input.photoUrls ?? []
      };

      const errors = validateReview(payload);

      if (errors.length) {
        fail(400, errors.join('; '));
      }

      const validatedPayload = {
        ...payload,
        comment: payload.comment.trim()
      };

      return mongoose.connection.transaction(async session => {
        await assertTarget(target, session);

        const [review] = await Review.create(
          [{ ...validatedPayload, userId }],
          { session }
        );

        await syncPhotos(
          validatedPayload.photoUrls,
          review._id,
          userId,
          session
        );

        const stats = await updateStatistics(target, session);

        return {
          review: {
            ...serialize(review),
            isOwner: true,
            likedByMe: false
          },
          statistics: stats
        };
      });
    },

    async mine(query, userId) {
      requireUser(userId);

      const page = pageNumber(query.page);
      const limit = 20;
      const filter = { userId };

      const [rows, total] = await Promise.all([
        Review.find(filter)
          .sort({ createdAt: -1, _id: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Review.countDocuments(filter)
      ]);

      return {
        reviews: await decorate(rows, userId),
        pagination: { page, limit, total }
      };
    },

    async edit(id, input, userId) {
      requireUser(userId);
      requireId(id);

      if (!input || typeof input !== 'object' || Array.isArray(input)) {
        fail(400, 'Invalid review input');
      }

      const allowed = [
        'rating',
        'spicinessRating',
        'comment',
        'photoUrls'
      ];

      if (
        !Object.keys(input).length ||
        Object.keys(input).some(key => !allowed.includes(key))
      ) {
        fail(
          400,
          'Only rating, spicinessRating, comment and photoUrls can be edited'
        );
      }

      return mongoose.connection.transaction(async session => {
        const old = await findOwned(id, userId, session);
        const target = reviewTarget(old);

        const payload = {
          ...target,
          rating: old.rating,
          spicinessRating: old.spicinessRating,
          comment: old.comment,
          photoUrls: old.photoUrls,
          ...input
        };

        const errors = validateReview(payload);

        if (errors.length) {
          fail(400, errors.join('; '));
        }

        await syncPhotos(payload.photoUrls, id, userId, session);

        const changes = {
          rating: payload.rating,
          comment: payload.comment.trim(),
          photoUrls: payload.photoUrls,
          ...(payload.spicinessRating !== undefined
            ? { spicinessRating: payload.spicinessRating }
            : {})
        };

        await Review.updateOne(
          { _id: id, userId },
          { $set: changes },
          { session, runValidators: true }
        );

        const stats = await updateStatistics(target, session);
        const updated = await Review.findById(id)
          .session(session)
          .lean();

        return {
          review: { ...serialize(updated), isOwner: true },
          statistics: stats
        };
      });
    },

    async remove(id, userId) {
      requireUser(userId);
      requireId(id);

      return mongoose.connection.transaction(async session => {
        const review = await findOwned(id, userId, session);
        const target = reviewTarget(review);

        await Review.deleteOne(
          { _id: id, userId },
          { session }
        );

        await ReviewLike.deleteMany(
          { reviewId: id },
          { session }
        );

        if (ReviewPhoto) {
          await ReviewPhoto.deleteMany(
            { reviewId: id },
            { session }
          );
        }

        if (ReviewReply) {
          await ReviewReply.deleteMany(
            { reviewId: id },
            { session }
          );
        }

        if (ReviewReport) {
          await ReviewReport.deleteMany(
            { reviewId: id },
            { session }
          );
        }

        return {
          statistics: await updateStatistics(target, session)
        };
      });
    },

    async like(id, userId, enabled) {
      requireUser(userId);
      requireId(id);

      for (let attempt = 0; ; attempt++) {
        try {
          return await mongoose.connection.transaction(async session => {
            const review = await Review.findById(id)
              .session(session)
              .lean();

            if (!review) {
              fail(404, 'Review not found');
            }

            await Review.updateOne(
              { _id: id },
              { $inc: { __v: 1 } },
              { session }
            );

            if (enabled) {
              await ReviewLike.updateOne(
                { reviewId: id, userId },
                { $setOnInsert: { reviewId: id, userId } },
                { session, upsert: true }
              );
            } else {
              await ReviewLike.deleteOne(
                { reviewId: id, userId },
                { session }
              );
            }

            const likeCount = await ReviewLike.countDocuments({
              reviewId: id
            }).session(session);

            await Review.updateOne(
              { _id: id },
              { $set: { likeCount } },
              { session }
            );

            return { likeCount, likedByMe: enabled };
          });
        } catch (error) {
          if (error.code !== 11000 || attempt >= 1) {
            throw error;
          }
        }
      }
    }
  };
}

module.exports = { createReviewService, parseTarget };