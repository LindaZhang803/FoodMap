const { validateReview } = require('../validators/review');
const isId = value => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
function fail(status, message) { const error = new Error(message); error.status = status; throw error; }
function parseTarget(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail(400, 'Invalid review target');
  const target = { restaurantId: input.restaurantId, reviewType: input.reviewType };
  if (!isId(target.restaurantId)) fail(400, 'Invalid restaurantId');
  if (!['restaurant', 'dish'].includes(target.reviewType)) fail(400, 'Choose restaurant or dish reviews');
  if (target.reviewType === 'dish') {
    if (!isId(input.dishId)) fail(400, 'Dish reviews require a valid dishId');
    target.dishId = input.dishId;
  } else if (input.dishId != null) fail(400, 'Restaurant reviews cannot include dishId');
  return target;
}
const serialize = doc => {
  const value = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return { id: String(value._id), restaurantId: String(value.restaurantId), dishId: value.dishId ? String(value.dishId) : null,
    reviewType: value.reviewType, rating: value.rating, comment: value.comment, photoUrls: value.photoUrls,
    createdAt: value.createdAt, updatedAt: value.updatedAt };
};
function createReviewService({ mongoose, Review, Dish, Restaurant }) {
  function matchTarget(target) {
    const match = { restaurantId: new mongoose.Types.ObjectId(target.restaurantId), reviewType: target.reviewType };
    if (target.dishId) match.dishId = new mongoose.Types.ObjectId(target.dishId);
    return match;
  }
  async function statistics(target, session) {
    const pipeline = [{ $match: matchTarget(target) }, { $group: { _id: null, averageRating: { $avg: '$rating' }, reviewCount: { $sum: 1 } } }];
    const result = await Review.aggregate(pipeline).session(session || null);
    return result.length ? { averageRating: result[0].averageRating, reviewCount: result[0].reviewCount } : { averageRating: null, reviewCount: 0 };
  }
  async function assertTarget(target, session) {
    if (!await Restaurant.findById(target.restaurantId).session(session || null).lean()) fail(404, 'Restaurant not found');
    if (target.dishId) {
      const dish = await Dish.findById(target.dishId).session(session || null).lean();
      if (!dish) fail(404, 'Dish not found');
      if (String(dish.restaurantId) !== target.restaurantId) fail(400, 'Dish does not belong to this restaurant');
    }
  }
  return {
    async list(query) {
      const target = parseTarget(query);
      const page = query.page === undefined ? 1 : Number(query.page);
      if (!Number.isSafeInteger(page) || page < 1 || page > 10000) fail(400, 'Invalid page');
      await assertTarget(target);
      const limit = 20;
      const filter = matchTarget(target);
      const [reviews, stats] = await Promise.all([
        Review.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        statistics(target)
      ]);
      return { reviews: reviews.map(serialize), statistics: stats, pagination: { page, limit, total: stats.reviewCount } };
    },
    async create(input, userId) {
      if (!isId(userId)) fail(401, 'Authentication required');
      const target = parseTarget(input);
      // Explicit allowlist: request userId, timestamps and statistic fields are ignored.
      const payload = { ...target, rating: input.rating, comment: input.comment, photoUrls: input.photoUrls ?? [] };
      const errors = validateReview(payload);
      if (errors.length) fail(400, errors.join('; '));
      payload.comment = payload.comment.trim();
      return mongoose.connection.transaction(async session => {
        await assertTarget(target, session);
        const [review] = await Review.create([{ ...payload, userId }], { session });
        const stats = await statistics(target, session);
        if (target.dishId) {
          // Same transaction as creation; concurrent dish writes trigger transaction retry.
          await Dish.updateOne({ _id: target.dishId }, { $set: stats }, { session, runValidators: true });
        }
        // Restaurant imported ratings are intentionally preserved; return FoodMap review statistics separately.
        return { review: serialize(review), statistics: stats };
      });
    }
  };
}
module.exports = { createReviewService, parseTarget };
