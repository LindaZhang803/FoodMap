const express = require('express');
const { rankDishes } = require('../recommendations/rankDishes');
const { parseCatalogQuery } = require('../../restaurants/services/catalogQuery');
function createRecommendationsRouter({ Dish, Restaurant, Review, User, connection, authenticate, now = () => new Date() }) {
  const router = express.Router();
  const optionalAuth = (req, res, next) => req.headers.authorization ? authenticate(req, res, next) : next();
  router.get('/dishes', optionalAuth, async (req, res) => {
    let page, limit, mode, location;
    try {
      const positive = (value, fallback, max) => {
        if (value === undefined) return fallback;
        if (typeof value !== 'string' || !/^\d+$/.test(value) || Number(value) < 1 || Number(value) > max) throw new Error('Invalid pagination');
        return Number(value);
      };
      page = positive(req.query.page, 1, 10000); limit = positive(req.query.limit, 20, 50);
      mode = req.query.mode === undefined ? 'forYou' : req.query.mode;
      if (!['forYou', 'trending'].includes(mode)) throw new Error('Invalid recommendation mode');
      const coordinates = parseCatalogQuery({ latitude: req.query.latitude, longitude: req.query.longitude });
      location = coordinates.latitude === null ? null : { latitude: coordinates.latitude, longitude: coordinates.longitude };
    } catch (error) { return res.status(400).json({ message: error.message }); }
    try {
      const since = new Date(now().getTime() - 7 * 24 * 60 * 60 * 1000);
      const [dishes, restaurants, recent, favorites, user] = await Promise.all([
        Dish.find({}).lean(), Restaurant.find({}).lean(),
        Review.aggregate([
          { $match: { reviewType: 'dish', createdAt: { $gte: since } } },
          { $group: { _id: '$dishId', recentReviews: { $sum: 1 }, likes: { $sum: '$likeCount' } } }
        ]),
        connection.db.collection('favorites').aggregate([
          { $match: { targetType: 'dish' } }, { $group: { _id: '$targetId', favorites: { $sum: 1 } } }
        ]).toArray(),
        req.user ? User.findById(req.user.id).select('favoriteCuisines').lean() : null
      ]);
      const activity = new Map(recent.map(r => [String(r._id), { dishId: r._id, recentReviews: r.recentReviews, likes: r.likes }]));
      for (const f of favorites) activity.set(String(f._id), { ...activity.get(String(f._id)), dishId: f._id, favorites: f.favorites });
      const ranked = rankDishes({ dishes, restaurants, activity: [...activity.values()], favoriteCuisines: user?.favoriteCuisines || [], location, mode });
      return res.json({ dishes: ranked.slice((page - 1) * limit, page * limit), pagination: { page, limit, total: ranked.length }, mode, reviewWindowDays: 7 });
    } catch { return res.status(500).json({ message: 'Recommendations unavailable' }); }
  });
  return router;
}
module.exports = { createRecommendationsRouter };
