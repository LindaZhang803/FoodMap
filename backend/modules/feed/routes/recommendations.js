const express = require('express');
const { readDishRanking } = require('../recommendations/readDishRanking');
const { parseCatalogQuery } = require('../../restaurants/services/catalogQuery');
function createRecommendationsRouter({ Dish, Restaurant, Review, User, connection, authenticate, now = () => new Date() }) {
  const router = express.Router();
  const optionalAuth = (req, res, next) => {
    res.vary('Authorization');
    if (!req.headers.authorization) return next();
    res.set('Cache-Control', 'private, no-store');
    return authenticate(req, res, next);
  };
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
      const ranked = await readDishRanking({ Dish, Restaurant, Review, User, connection, userId: req.user?.id, location, mode, now: now() });
      return res.json({ dishes: ranked.slice((page - 1) * limit, page * limit), pagination: { page, limit, total: ranked.length }, mode, reviewWindowDays: 7 });
    } catch { return res.status(500).json({ message: 'Recommendations unavailable' }); }
  });
  return router;
}
module.exports = { createRecommendationsRouter };
