// Real Express routing and HTTP responses; injected test auth, readers, and storage.
// These tests do not establish MongoDB persistence or JWT verification.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const {
  IDS, TOKENS, createTestReaders, createMemoryStore, createHarness,
} = require('./helpers');
const { createFavoritesRouter } = require('../routes/favorites');

const auth = user => `Bearer ${TOKENS[user]}`;
const targetPath = (type = 'restaurant', id = IDS.restaurantA) =>
  `/api/favorites/${type}/${id}`;
const genericError = { message: 'Internal server error' };

test('injected dependencies: every Favorites route requires authentication', async () => {
  const harness = createHarness();
  for (const [method, path] of [
    ['get', '/api/favorites'], ['put', targetPath()], ['delete', targetPath()],
  ]) {
    for (const authorization of [undefined, 'Bearer invalid-token']) {
      let pending = harness.request[method](path);
      if (authorization) pending = pending.set('Authorization', authorization);
      const response = await pending;
      assert.equal(response.status, 401);
      assert.deepEqual(response.body, { message: 'Test authentication required' });
    }
  }
  assert.deepEqual(harness.store.calls, { list: [], save: [], remove: [] });
  assert.equal(harness.readers.restaurant.calls.length, 0);
  assert.equal(harness.readers.dish.calls.length, 0);
});

test('injected middleware: auth service responses pass through unchanged', async () => {
  const harness = createHarness({ authenticate(req, res) {
    res.status(500).json({ message: 'Authentication service unavailable' });
  } });
  for (const [method, path] of [
    ['get', '/api/favorites'], ['put', targetPath()], ['delete', targetPath()],
  ]) {
    const response = await harness.request[method](path);
    assert.equal(response.status, 500);
    assert.deepEqual(response.body, { message: 'Authentication service unavailable' });
  }
  assert.deepEqual(harness.store.calls, { list: [], save: [], remove: [] });
});

test('injected middleware: missing or malformed req.user.id fails closed', async () => {
  for (const user of [undefined, {}, { id: '' }, { id: 'not-an-id' }, { id: { $ne: null } }]) {
    const harness = createHarness({ authenticate(req, res, next) {
      req.user = user;
      next();
    } });
    for (const [method, path] of [
      ['get', '/api/favorites'], ['put', targetPath()], ['delete', targetPath()],
    ]) {
      const response = await harness.request[method](path);
      assert.equal(response.status, 401);
      assert.deepEqual(response.body, { message: 'Authentication required' });
    }
    assert.deepEqual(harness.store.calls, { list: [], save: [], remove: [] });
  }
});

test('router refuses construction without explicit authentication', () => {
  assert.throws(() => createFavoritesRouter({ service: {} }), /authentication/i);
});

test('GET returns an empty items array without unnecessary catalog reads', async () => {
  const harness = createHarness();
  const response = await harness.request.get('/api/favorites').set('Authorization', auth('alice'));
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { items: [] });
  assert.deepEqual(harness.readers.restaurant.calls, []);
  assert.deepEqual(harness.readers.dish.calls, []);
});

test('PUT saves restaurant and dish summaries with string IDs and nullable ratings', async () => {
  const harness = createHarness();
  for (const [type, id] of [['restaurant', IDS.restaurantA], ['dish', IDS.dishA]]) {
    const response = await harness.request.put(targetPath(type, id)).set('Authorization', auth('alice'));
    assert.equal(response.status, 200);
    assert.deepEqual(Object.keys(response.body).sort(), ['createdAt', 'target', 'targetId', 'targetType']);
    assert.equal(response.body.targetType, type);
    assert.equal(response.body.targetId, id);
    assert.equal(new Date(response.body.createdAt).toISOString(), response.body.createdAt);
    assert.equal(response.body.target.imageUrl, `https://example.com/synthetic-${type}.jpg`);
    assert.equal(response.body.target.reviewCount, 0);
    if (type === 'restaurant') {
      assert.equal(response.body.target._id, IDS.restaurantA);
      assert.equal(response.body.target.rating, null);
      assert.equal(response.body.target.priceRange, '$$');
      assert.equal(response.body.target.cuisineType, 'Synthetic cuisine');
      assert.equal(response.body.target.imageSource, 'Synthetic source');
      assert.equal(response.body.target.imageLicenseUrl, 'https://example.com/license');
      assert.equal(response.body.target.minPrice, 0);
      assert.equal(response.body.target.maxPrice, 12);
      assert.equal(response.body.target.priceCurrency, 'USD');
    } else {
      assert.equal(response.body.target.dishId, IDS.dishA);
      assert.equal(response.body.target.restaurantId, IDS.restaurantA);
      assert.equal(response.body.target.averageRating, null);
    }
    for (const privateField of ['passwordHash', 'internalNotes', 'userId', '__v']) {
      assert.equal(Object.hasOwn(response.body.target, privateField), false);
    }
  }
  const listed = await harness.request.get('/api/favorites').set('Authorization', auth('alice'));
  assert.equal(listed.body.items.length, 2);
  assert.equal(JSON.stringify(listed.body).includes('private-value'), false);
});

test('ownership uses the authenticated account despite body and query user IDs', async () => {
  const harness = createHarness();
  for (const [type, id] of [['restaurant', IDS.restaurantA], ['dish', IDS.dishA]]) {
    const path = targetPath(type, id);
    assert.equal((await harness.request.put(`${path}?userId=${IDS.bob}`)
      .set('Authorization', auth('alice')).send({ userId: IDS.bob, targetId: IDS.absent })).status, 200);
    assert.equal((await harness.request.put(path).set('Authorization', auth('bob'))).status, 200);
  }
  for (const [user, other] of [['alice', 'bob'], ['bob', 'alice']]) {
    const response = await harness.request.get(`/api/favorites?userId=${IDS[other]}`)
      .set('Authorization', auth(user));
    assert.equal(response.body.items.length, 2);
  }
  const removed = await harness.request.delete(`${targetPath()}?userId=${IDS.bob}`)
    .set('Authorization', auth('alice')).send({ userId: IDS.bob });
  assert.equal(removed.status, 204);
  assert.equal(removed.text, '');
  const alice = await harness.request.get('/api/favorites').set('Authorization', auth('alice'));
  const bob = await harness.request.get('/api/favorites').set('Authorization', auth('bob'));
  assert.deepEqual(alice.body.items.map(item => item.targetId), [IDS.dishA]);
  assert.equal(bob.body.items.length, 2);
  assert.equal([...harness.store.records.values()].filter(record => record.userId === IDS.bob).length, 2);
});

test('deleting another account-only save leaves it intact', async () => {
  const harness = createHarness();
  await harness.request.put(targetPath()).set('Authorization', auth('bob')).expect(200);
  await harness.request.delete(targetPath()).set('Authorization', auth('alice')).expect(204);
  const response = await harness.request.get('/api/favorites').set('Authorization', auth('bob'));
  assert.equal(response.body.items.length, 1);
});

test('malformed target types and IDs return 400 before catalog or storage operations', async () => {
  const harness = createHarness();
  const invalidPaths = [
    targetPath('user'), targetPath('Restaurant'), targetPath('restaurants'),
    targetPath('__proto__'), targetPath('constructor'), targetPath('dish', 'invalid'),
    targetPath('restaurant', '123456789012'), targetPath('restaurant', 'z'.repeat(24)),
    targetPath('restaurant', 'a'.repeat(25)), targetPath('restaurant', '%24ne'),
    targetPath('restaurant', '%E0%A4%A'), targetPath('dish', '%'),
  ];
  for (const method of ['put', 'delete']) {
    for (const path of invalidPaths) {
      const response = await harness.request[method](path).set('Authorization', auth('alice'));
      assert.equal(response.status, 400, `${method} ${path}`);
      assert.equal(typeof response.body.message, 'string');
    }
  }
  assert.deepEqual(harness.store.calls, { list: [], save: [], remove: [] });
  assert.equal(harness.readers.restaurant.calls.length, 0);
  assert.equal(harness.readers.dish.calls.length, 0);
});

test('valid IDs with absent catalog targets return 404 and never save', async () => {
  const harness = createHarness();
  for (const type of ['restaurant', 'dish']) {
    const response = await harness.request.put(targetPath(type, IDS.absent)).set('Authorization', auth('alice'));
    assert.equal(response.status, 404);
    assert.deepEqual(response.body, { message: 'Favorite target not found' });
  }
  assert.equal(harness.store.records.size, 0);
  assert.equal(harness.store.calls.save.length, 0);
});

test('uppercase ObjectId input refers to the same normalized saved target', async () => {
  const harness = createHarness();
  const first = await harness.request.put(targetPath()).set('Authorization', auth('alice'));
  const second = await harness.request.put(targetPath('restaurant', IDS.restaurantA.toUpperCase()))
    .set('Authorization', auth('alice'));
  assert.equal(second.status, 200);
  assert.deepEqual(second.body, first.body);
  assert.equal(harness.store.records.size, 1);
});

test('injected storage: repeated and concurrent saves retain one record and its original date', async () => {
  let date = new Date('2026-01-01T10:00:00.000Z');
  const harness = createHarness({ store: createMemoryStore({ now: () => date }) });
  for (const [type, id] of [['restaurant', IDS.restaurantA], ['dish', IDS.dishA]]) {
    const path = targetPath(type, id);
    const first = await harness.request.put(path).set('Authorization', auth('alice'));
    date = new Date('2026-01-02T10:00:00.000Z');
    const responses = await Promise.all(Array.from({ length: 12 }, () =>
      request(harness.app).put(path).set('Authorization', auth('alice'))));
    for (const response of responses) {
      assert.equal(response.status, 200);
      assert.deepEqual(response.body, first.body);
    }
  }
  assert.equal(harness.store.records.size, 2);
});

test('injected storage: new concurrent saves of the same target produce one record', async () => {
  const harness = createHarness();
  const responses = await Promise.all(Array.from({ length: 12 }, () =>
    request(harness.app).put(targetPath()).set('Authorization', auth('alice'))));
  assert.equal(harness.store.records.size, 1);
  for (const response of responses) {
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, responses[0].body);
  }
});

test('injected storage: newest-first order has a stable _id tie-breaker', async () => {
  let date = new Date('2026-01-01T10:00:00.000Z');
  const harness = createHarness({ store: createMemoryStore({ now: () => date }) });
  await harness.request.put(targetPath()).set('Authorization', auth('alice')).expect(200);
  date = new Date('2026-01-02T10:00:00.000Z');
  await harness.request.put(targetPath('dish', IDS.dishA)).set('Authorization', auth('alice')).expect(200);
  await harness.request.put(targetPath('restaurant', IDS.restaurantB)).set('Authorization', auth('alice')).expect(200);
  const first = await harness.request.get('/api/favorites').set('Authorization', auth('alice'));
  const second = await harness.request.get('/api/favorites').set('Authorization', auth('alice'));
  assert.deepEqual(first.body.items.map(item => item.targetId), [IDS.restaurantB, IDS.dishA, IDS.restaurantA]);
  assert.deepEqual(second.body, first.body);
});

test('injected storage: saved records survive a fresh service and Express app instance', async () => {
  const store = createMemoryStore();
  const first = createHarness({ store });
  const saved = await first.request.put(targetPath()).set('Authorization', auth('alice'));
  const second = createHarness({ store });
  assert.notEqual(first.service, second.service);
  const response = await second.request.get('/api/favorites').set('Authorization', auth('alice'));
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.items, [saved.body]);
});

test('deleted catalog targets hydrate as null and remain removable with retry-safe DELETE', async () => {
  const harness = createHarness();
  for (const [type, id] of [['restaurant', IDS.restaurantA], ['dish', IDS.dishA]]) {
    const path = targetPath(type, id);
    await harness.request.put(path).set('Authorization', auth('alice')).expect(200);
    harness.readers[type].docs.delete(id);
  }
  const list = await harness.request.get('/api/favorites').set('Authorization', auth('alice'));
  assert.equal(list.status, 200);
  assert.equal(list.body.items.length, 2);
  for (const item of list.body.items) {
    assert.equal(item.target, null);
    assert.ok([IDS.restaurantA, IDS.dishA].includes(item.targetId));
  }
  for (const type of ['restaurant', 'dish']) {
    harness.readers[type].findByIds = async () => { throw new Error('Reader must not run for DELETE'); };
  }
  for (const [type, id] of [['restaurant', IDS.restaurantA], ['dish', IDS.dishA]]) {
    for (let retry = 0; retry < 2; retry++) {
      const removed = await harness.request.delete(targetPath(type, id)).set('Authorization', auth('alice'));
      assert.equal(removed.status, 204);
      assert.equal(removed.text, '');
    }
  }
  assert.equal(harness.store.records.size, 0);
});

test('GET batches hydration once per target type instead of once per favorite', async () => {
  const harness = createHarness();
  for (const id of [IDS.restaurantA, IDS.restaurantB, IDS.restaurantC]) {
    await harness.request.put(targetPath('restaurant', id)).set('Authorization', auth('alice')).expect(200);
  }
  for (const id of [IDS.dishA, IDS.dishB]) {
    await harness.request.put(targetPath('dish', id)).set('Authorization', auth('alice')).expect(200);
  }
  harness.readers.restaurant.calls.length = 0;
  harness.readers.dish.calls.length = 0;
  const response = await harness.request.get('/api/favorites').set('Authorization', auth('alice'));
  assert.equal(response.status, 200);
  assert.equal(response.body.items.length, 5);
  assert.equal(harness.readers.restaurant.calls.length, 1);
  assert.equal(harness.readers.dish.calls.length, 1);
  assert.deepEqual(harness.readers.restaurant.calls[0].sort(), [IDS.restaurantA, IDS.restaurantB, IDS.restaurantC]);
  assert.deepEqual(harness.readers.dish.calls[0].sort(), [IDS.dishA, IDS.dishB]);
});

test('storage failures for list, save, and delete return generic server errors', async () => {
  for (const [method, path, operation] of [
    ['get', '/api/favorites', 'list'], ['put', targetPath(), 'save'], ['delete', targetPath(), 'remove'],
  ]) {
    const store = createMemoryStore();
    store[operation] = async () => {
      const error = new Error('Secret storage details');
      error.status = 404;
      throw error;
    };
    const harness = createHarness({ store });
    const response = await harness.request[method](path).set('Authorization', auth('alice'));
    assert.equal(response.status, 500);
    assert.deepEqual(response.body, genericError);
  }
});

test('PUT catalog read failures return 500 instead of missing-target 404', async () => {
  for (const [type, id] of [['restaurant', IDS.restaurantA], ['dish', IDS.dishA]]) {
    const readers = createTestReaders();
    readers[type].findByIds = async () => { throw new Error('Secret reader details'); };
    const harness = createHarness({ readers });
    const response = await harness.request.put(targetPath(type, id)).set('Authorization', auth('alice'));
    assert.equal(response.status, 500);
    assert.deepEqual(response.body, genericError);
    assert.equal(harness.store.calls.save.length, 0);
  }
});

test('GET hydration failure rejects the read rather than reporting targets as deleted', async () => {
  for (const [type, id] of [['restaurant', IDS.restaurantA], ['dish', IDS.dishA]]) {
    const harness = createHarness();
    await harness.request.put(targetPath(type, id)).set('Authorization', auth('alice')).expect(200);
    harness.readers[type].findByIds = async () => { throw new Error('Secret reader details'); };
    const response = await harness.request.get('/api/favorites').set('Authorization', auth('alice'));
    assert.equal(response.status, 500);
    assert.deepEqual(response.body, genericError);
    assert.equal(harness.store.records.size, 1);
  }
});

test('malformed reader results fail rather than becoming an empty or broken summary', async () => {
  for (const result of [null, {}, [null], [{ _id: 'bad-id' }], [{ _id: IDS.dishA, restaurantId: 'bad-id' }]]) {
    const readers = createTestReaders();
    readers.dish.findByIds = async () => result;
    const harness = createHarness({ readers });
    const response = await harness.request.put(targetPath('dish', IDS.dishA)).set('Authorization', auth('alice'));
    assert.equal(response.status, 500);
    assert.deepEqual(response.body, genericError);
    assert.equal(harness.store.records.size, 0);
  }
});
