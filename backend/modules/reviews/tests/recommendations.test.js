const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const { rankDishes } = require('../../feed/recommendations/rankDishes');
const { createRecommendationsRouter } = require('../../feed/routes/recommendations');
const restaurants = [
  { _id: 'r1', name: 'One', cuisineType: 'Japanese', latitude: 34, longitude: -117 },
  { _id: 'r2', name: 'Two', cuisineType: 'Italian', latitude: 35, longitude: -117 }
];
const dishes = [
  { _id: 'd1', restaurantId: 'r1', name: 'Ramen', averageRating: 4, reviewCount: 1 },
  { _id: 'd2', restaurantId: 'r2', name: 'Pasta', averageRating: 4, reviewCount: 1 },
  { _id: 'orphan', restaurantId: 'gone', name: 'Removed restaurant dish' }
];
test('recommendations use cuisine and proximity, exclude orphans and handle unknown spiciness', () => {
  const ranked = rankDishes({ dishes, restaurants, favoriteCuisines: [' ITALIAN '] });
  assert.equal(ranked[0].dish.id, 'd2');
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].spicinessCompatibility, 'Unknown');
  const near = rankDishes({ dishes, restaurants, location: { latitude: 34, longitude: -117 } });
  assert.equal(near[0].dish.id, 'd1');
  assert.equal(near[0].distanceKm, 0);
});
test('trending responds to review, like and favorite counts and has a deterministic zero-data fallback', () => {
  const ranked = rankDishes({ dishes, restaurants, mode: 'trending', activity: [{ dishId: 'd2', recentReviews: 1, likes: 2, favorites: 3 }] });
  assert.equal(ranked[0].dish.id, 'd2');
  assert.equal(ranked[0].score, 11);
  assert.deepEqual(rankDishes({ dishes, restaurants, mode: 'trending' }).map(x => x.dish.id), ['d1', 'd2']);
});
test('recommendation HTTP endpoint uses authenticated preferences, paginates, and rejects invalid input', async () => {
  let readUser, match;
  const app = express();
  app.use('/api/recommendations', createRecommendationsRouter({
    Dish: { find: () => ({ lean: async () => dishes }) },
    Restaurant: { find: () => ({ lean: async () => restaurants }) },
    Review: { aggregate: async pipeline => { match = pipeline[0].$match; return []; } },
    User: { findById: id => { readUser = id; return { select: () => ({ lean: async () => ({ favoriteCuisines: ['Italian'] }) }) }; } },
    connection: { db: { collection: () => ({ aggregate: () => ({ toArray: async () => [] }) }) } },
    authenticate: (req, res, next) => { if (req.headers.authorization !== 'Bearer valid') return res.sendStatus(401); req.user = { id: 'session-user' }; next(); },
    now: () => new Date('2026-11-14T00:00:00Z')
  }));
  const result = await request(app).get('/api/recommendations/dishes?limit=1&userId=someone-else').set('Authorization', 'Bearer valid');
  assert.equal(result.status, 200);
  assert.equal(readUser, 'session-user');
  assert.equal(result.body.dishes[0].dish.id, 'd2');
  assert.deepEqual(result.body.pagination, { page: 1, limit: 1, total: 2 });
  assert.equal(match.createdAt.$gte.toISOString(), '2026-11-07T00:00:00.000Z');
  assert.equal((await request(app).get('/api/recommendations/dishes?limit=0')).status, 400);
  assert.equal((await request(app).get('/api/recommendations/dishes?latitude=34')).status, 400);
  assert.equal((await request(app).get('/api/recommendations/dishes').set('Authorization', 'bad')).status, 401);
  assert.equal((await request(app).get('/api/recommendations/dishes')).status, 200);
});
