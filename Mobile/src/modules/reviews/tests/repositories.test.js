const { test } = require('node:test');
const assert = require('node:assert/strict');
const fixtures = require('../mocks/fixtures.json');
const { createReviewRepository } = require('../services/reviewRepository');
const { createDishRepository } = require('../services/dishRepository');
const target = { restaurantId: fixtures.dishes[0].restaurantId, dishId: fixtures.dishes[0].id, reviewType: 'dish' };
test('demo review lifecycle preserves ownership, photos and recalculated dish ratings', async () => {
  const copy = JSON.parse(JSON.stringify(fixtures));
  const reviews = createReviewRepository({ fixtures: copy });
  const dishes = createDishRepository({ fixtures: copy });
  const photo = await reviews.uploadPhoto({ uri: 'file:///synthetic-demo.jpg' });
  const created = await reviews.create({ ...target, rating: 5, comment: 'Synthetic review', photoUrls: [photo.photoUrl] });
  assert.equal(created.review.isOwner, true); assert.equal(created.statistics.averageRating, 4.5);
  assert.deepEqual(created.review.photoUrls, ['file:///synthetic-demo.jpg']);
  const edited = await reviews.edit(created.review.id, { rating: 2, photoUrls: [] });
  assert.equal(edited.statistics.averageRating, 3); assert.deepEqual(edited.review.photoUrls, []);
  await reviews.like(fixtures.reviews[0].id, true); await reviews.like(fixtures.reviews[0].id, true);
  const list = await reviews.list(target, 1, 'mostLiked'); assert.equal(list.reviews[0].likeCount, 1);
  assert.equal((await reviews.mine()).reviews.length, 1);
  await reviews.remove(created.review.id);
  assert.equal((await dishes.getDish(target.dishId)).averageRating, 4);
  assert.equal((await reviews.mine()).reviews.length, 0);
  assert.equal(fixtures.dishes[0].averageRating, 4);
});
test('live repository supplies bearer token and propagates denied requests', async () => {
  let sent;
  const repository = createReviewRepository({ origin: 'http://localhost:3000', fetchImpl: async (url, options) => {
    sent = { url, options }; return { ok: false, json: async () => ({ message: 'Denied' }) };
  } });
  await assert.rejects(repository.edit('some-id', { rating: 2 }), /Sign in/);
  await assert.rejects(repository.create({ ...target, rating: 3, comment: 'Test', photoUrls: [] }, 'synthetic-token'), /Denied/);
  assert.equal(sent.options.headers.Authorization, 'Bearer synthetic-token');
  assert.ok(!('userId' in JSON.parse(sent.options.body)));
});
test('dish ordering and review validation handle unrated and invalid input', async () => {
  const dishes = createDishRepository({ fixtures });
  assert.equal((await dishes.getDishes(null, 'highestRated')).at(-1).averageRating, null);
  await assert.rejects(dishes.getDishes(null, 'bad'), /sort/);
  const reviews = createReviewRepository({ fixtures: JSON.parse(JSON.stringify(fixtures)) });
  await assert.rejects(reviews.create({ ...target, rating: 0, comment: 'Test' }), /stars/);
  await assert.rejects(reviews.create({ ...target, rating: 3, comment: ' ' }), /comment/);
  await assert.rejects(reviews.remove(fixtures.reviews[0].id), /own/);
});
