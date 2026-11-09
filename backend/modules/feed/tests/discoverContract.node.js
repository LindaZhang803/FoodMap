'use strict';

// Synthetic contract tests with injected readers; no HTTP, Accounts, or catalog
// database integration is claimed by this suite.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  FLAVOR_DIMENSIONS,
  isValidFlavorVector,
  normalizeDishList,
  loadDiscoverSources,
  loadPreferenceSnapshot,
} = require('../recommendations/discoverContract');

const restaurantA = Object.freeze({
  _id: '111111111111111111111111', name: 'Synthetic Noodles', rating: null,
  imageUrl: 'https://images.example.test/restaurant.jpg', imageLicense: 'Test license',
});
const restaurantB = Object.freeze({
  _id: '222222222222222222222222', name: 'Synthetic No-dish Cafe',
});
const restaurants = Object.freeze([restaurantA, restaurantB]);
const dish = Object.freeze({
  id: '333333333333333333333333', restaurantId: restaurantA._id,
  name: 'Synthetic Noodles', imageUrl: 'https://images.example.test/dish.jpg',
  averageRating: null, reviewCount: 0, imageAuthor: 'Synthetic source',
});

function neutralVector() {
  return Object.fromEntries(FLAVOR_DIMENSIONS.map(key => [key, 0]));
}

function sources(overrides = {}) {
  return {
    getRestaurants: async () => restaurants,
    getDishes: async () => [dish],
    complete: true,
    dishScope: 'all-dishes',
    ...overrides,
  };
}

test('injected Discover readers preserve catalog objects and exact parent IDs', async () => {
  const result = await loadDiscoverSources(sources());
  assert.equal(result.restaurants, restaurants);
  assert.equal(result.restaurants[0], restaurantA);
  assert.equal(result.restaurants[1], restaurantB);
  assert.equal(result.dishError, null);
  assert.deepEqual(result.dishPayload.coverage, { scope: 'candidate-pool', complete: true });
  assert.equal(result.dishPayload.dishes[0].dishId, dish.id);
  assert.equal(result.dishPayload.dishes[0].restaurantId, restaurantA._id);
  assert.equal(result.dishPayload.dishes[0].averageRating, null);
  assert.equal(result.dishPayload.dishes[0].reviewCount, 0);
  assert.equal(result.dishPayload.dishes[0].imageUrl, dish.imageUrl);
  assert.equal(result.dishPayload.dishes[0].imageAuthor, dish.imageAuthor);
  assert.equal(Object.hasOwn(result.dishPayload.dishes[0], 'flavorIntensities'), false);
  assert.equal(dish.id, '333333333333333333333333');
  assert.equal(Object.hasOwn(dish, 'dishId'), false);
});

test('injected Discover empty dish read retains restaurants with complete coverage', async () => {
  const result = await loadDiscoverSources(sources({ getDishes: async () => [] }));
  assert.equal(result.restaurants, restaurants);
  assert.deepEqual(result.dishPayload, {
    dishes: [], coverage: { scope: 'candidate-pool', complete: true },
  });
});

test('injected Discover known subset stays partial even when it contains dishes', async () => {
  const result = await loadDiscoverSources(sources({ complete: false, dishScope: 'subset' }));
  assert.equal(result.dishError, null);
  assert.equal(result.dishPayload.coverage.complete, false);
  assert.equal(result.dishPayload.dishes.length, 1);
});

test('injected Discover complete scoped read proves the same candidate pool', async () => {
  const result = await loadDiscoverSources(sources({
    dishScope: 'candidate-pool', coveredRestaurantIds: [restaurantB._id, restaurantA._id],
  }));
  assert.equal(result.dishError, null);
  assert.equal(result.dishPayload.coverage.complete, true);
});

test('injected Discover rejects missing or contradictory coverage declarations', async () => {
  for (const options of [
    { complete: undefined },
    { dishScope: undefined },
    { dishScope: 'subset', complete: true },
    { dishScope: 'candidate-pool' },
    { dishScope: 'candidate-pool', coveredRestaurantIds: [restaurantA._id] },
    { dishScope: 'candidate-pool', coveredRestaurantIds: [restaurantA._id, 'another-pool'] },
  ]) {
    const result = await loadDiscoverSources(sources(options));
    assert.equal(result.restaurants, restaurants);
    assert.equal(result.dishPayload, null);
    assert.ok(result.dishError instanceof Error);
  }
});

test('injected Discover dish request failure remains separate from available restaurants', async () => {
  const sourceError = new Error('Synthetic dish outage');
  const result = await loadDiscoverSources(sources({
    getDishes: async () => { throw sourceError; },
  }));
  assert.equal(result.restaurants, restaurants);
  assert.equal(result.dishPayload, null);
  assert.equal(result.dishError, sourceError);
});

test('injected Discover rejects malformed dish envelopes and missing readers', async () => {
  for (const getDishes of [async () => ({ items: [dish] }), undefined]) {
    const result = await loadDiscoverSources(sources({ getDishes }));
    assert.equal(result.restaurants, restaurants);
    assert.equal(result.dishPayload, null);
    assert.ok(result.dishError instanceof Error);
  }
});

test('injected Discover restaurant failure rejects the load', async () => {
  await assert.rejects(loadDiscoverSources(sources({
    getRestaurants: async () => { throw new Error('Synthetic catalog outage'); },
  })), /catalog outage/);
  await assert.rejects(loadDiscoverSources(sources({
    getRestaurants: async () => ({ items: restaurants }),
  })), /bare array/);
});

test('synthetic dish normalization keeps IDs separate and leaves grouping to Mobile', () => {
  const orphan = { ...dish, id: '444444444444444444444444', restaurantId: '555555555555555555555555' };
  const normalized = normalizeDishList([orphan]);
  assert.equal(normalized[0].dishId, orphan.id);
  assert.equal(normalized[0].restaurantId, orphan.restaurantId);
  assert.notEqual(normalized[0].restaurantId, restaurantA._id);
  assert.throws(() => normalizeDishList([{ ...dish, restaurantId: null }]), /string id/);
});

test('synthetic photos retain usable URLs and resolve uploads only with an explicit origin', () => {
  const relative = { ...dish, imageUrl: '/uploads/noodles.jpg' };
  assert.equal(normalizeDishList([relative])[0].imageUrl, null);
  assert.equal(normalizeDishList([relative], { uploadsOrigin: 'https://api.example.test' })[0].imageUrl,
    'https://api.example.test/uploads/noodles.jpg');
  for (const imageUrl of [null, '', 'javascript:alert(1)', 'data:image/png;base64,abc', 42]) {
    assert.equal(normalizeDishList([{ ...dish, imageUrl }])[0].imageUrl, null);
  }
});

test('synthetic numeric vectors accept zero and reject unknown, partial, or malformed values', () => {
  assert.equal(isValidFlavorVector(neutralVector()), true);
  assert.equal(isValidFlavorVector({ ...neutralVector(), spicy: 5 }), true);
  for (const value of [null, {}, { spicy: 1 }, { ...neutralVector(), extra: 0 },
    ...['0', NaN, Infinity, -1, 6, null, undefined].map(spicy => ({ ...neutralVector(), spicy }))]) {
    assert.equal(isValidFlavorVector(value), false);
  }
});

test('injected self-read keeps all-zero preferences ready and explicit null empty', async () => {
  const targets = Object.freeze(neutralVector());
  const ready = await loadPreferenceSnapshot({
    userId: 'synthetic-user', getPreferences: async (...args) => {
      assert.equal(args.length, 0);
      return { userId: 'synthetic-user', flavorTargets: targets };
    },
  });
  assert.equal(ready.status, 'ready');
  assert.deepEqual(ready.flavorTargets, targets);
  assert.notEqual(ready.flavorTargets, targets);
  const empty = await loadPreferenceSnapshot({
    userId: 'synthetic-user', getPreferences: async () => ({ userId: 'synthetic-user', flavorTargets: null }),
  });
  assert.deepEqual(empty, { status: 'empty', userId: 'synthetic-user', flavorTargets: null, error: null });
});

test('injected self-read distinguishes unavailable profiles from an explicit empty profile', async () => {
  for (const profile of [
    { userId: 'synthetic-user' },
    { userId: 'synthetic-user', flavorTargets: {} },
    { userId: 'synthetic-user', flavorTargets: { spicy: 1 } },
    { userId: 'synthetic-user', foodPreferences: ['spicy'] },
    { userId: 'different-user', flavorTargets: neutralVector() },
    null,
  ]) {
    const result = await loadPreferenceSnapshot({ userId: 'synthetic-user', getPreferences: async () => profile });
    assert.equal(result.status, 'unavailable');
    assert.equal(result.flavorTargets, null);
    assert.ok(result.error instanceof Error);
  }
});

test('injected self-read source failures and missing source are unavailable', async () => {
  for (const getPreferences of [undefined, async () => { throw new Error('Synthetic account outage'); }]) {
    const result = await loadPreferenceSnapshot({ userId: 'synthetic-user', getPreferences });
    assert.equal(result.status, 'unavailable');
    assert.ok(result.error instanceof Error);
  }
});

test('signed-out browsing does not call the injected account source', async () => {
  const result = await loadPreferenceSnapshot({
    userId: null, getPreferences: async () => { assert.fail('Unexpected account request'); },
  });
  assert.deepEqual(result, { status: 'signed-out', userId: null, flavorTargets: null, error: null });
});
