// Synthetic test identities, catalog readers, and in-memory persistence only.
// Production uses Accounts middleware and the owning Mongoose models.
const express = require('express');
const request = require('supertest');
const { createFavoriteService } = require('../services/favoriteService');
const { createFavoritesRouter } = require('../routes/favorites');

const IDS = {
  alice: '100000000000000000000001',
  bob: '100000000000000000000002',
  restaurantA: '20000000000000000000000a',
  restaurantB: '20000000000000000000000b',
  restaurantC: '20000000000000000000000c',
  dishA: '30000000000000000000000a',
  dishB: '30000000000000000000000b',
  absent: '400000000000000000000001',
};
const TOKENS = { alice: 'test-alice-token', bob: 'test-bob-token' };

function testAuthenticate(req, res, next) {
  const entry = Object.entries(TOKENS).find(([, token]) =>
    req.headers.authorization === `Bearer ${token}`);
  if (!entry) return res.status(401).json({ message: 'Test authentication required' });
  req.user = { id: IDS[entry[0]] };
  next();
}

function createTestReaders() {
  const restaurants = [IDS.restaurantA, IDS.restaurantB, IDS.restaurantC].map((_id, index) => ({
    _id,
    name: `Synthetic restaurant ${index + 1}`,
    address: 'Synthetic address',
    cuisineType: 'Synthetic cuisine',
    priceRange: '$$',
    rating: null,
    reviewCount: 0,
    imageUrl: 'https://example.com/synthetic-restaurant.jpg',
    imageAuthor: 'Synthetic author',
    imageLicense: 'Synthetic license',
    imageSource: 'Synthetic source',
    imageLicenseUrl: 'https://example.com/license',
    minPrice: 0,
    maxPrice: 12,
    priceCurrency: 'USD',
    passwordHash: 'private-value',
    internalNotes: 'private-value',
    userId: IDS.bob,
    __v: 10,
  }));
  const dishes = [IDS.dishA, IDS.dishB].map((_id, index) => ({
    _id,
    restaurantId: IDS.restaurantA,
    name: `Synthetic dish ${index + 1}`,
    imageUrl: 'https://example.com/synthetic-dish.jpg',
    averageRating: null,
    reviewCount: 0,
    passwordHash: 'private-value',
    internalNotes: 'private-value',
    userId: IDS.bob,
    __v: 10,
  }));
  function reader(documents) {
    return {
      docs: new Map(documents.map(doc => [doc._id, doc])),
      calls: [],
      async findByIds(ids) {
        this.calls.push([...ids]);
        return ids.filter(id => this.docs.has(id)).map(id => structuredClone(this.docs.get(id)));
      },
    };
  }
  return { restaurant: reader(restaurants), dish: reader(dishes) };
}

function createMemoryStore({ now = () => new Date() } = {}) {
  const records = new Map();
  const calls = { list: [], save: [], remove: [] };
  let sequence = 0;
  function keyOf({ userId, targetType, targetId }) {
    return `${userId}:${targetType}:${targetId}`;
  }
  return {
    records,
    calls,
    async list(userId) {
      calls.list.push(userId);
      return [...records.values()]
        .filter(record => record.userId === userId)
        .sort((left, right) =>
          right.createdAt - left.createdAt || right._id.localeCompare(left._id))
        .map(record => structuredClone(record));
    },
    async save(key) {
      calls.save.push({ ...key });
      const storageKey = keyOf(key);
      // No asynchronous gap: this is only the deterministic fake-store contract.
      // The separate MongoDB suite verifies real atomic upserts and uniqueness.
      if (!records.has(storageKey)) {
        records.set(storageKey, {
          ...key,
          _id: (++sequence).toString(16).padStart(24, '0'),
          createdAt: new Date(now()),
        });
      }
      return structuredClone(records.get(storageKey));
    },
    async remove(key) {
      calls.remove.push({ ...key });
      records.delete(keyOf(key));
    },
  };
}

function createHarness({
  store = createMemoryStore(),
  readers = createTestReaders(),
  authenticate = testAuthenticate,
} = {}) {
  const app = express();
  const service = createFavoriteService({ store, readers });
  app.use(express.json());
  app.use('/api/favorites', createFavoritesRouter({ authenticate, service }));
  return { app, service, store, readers, request: request(app) };
}

module.exports = {
  IDS, TOKENS, testAuthenticate, createTestReaders, createMemoryStore, createHarness,
};