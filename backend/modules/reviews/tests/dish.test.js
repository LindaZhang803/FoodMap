const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createDishController } = require('../controllers/dish.controller');
const { createDishRepository } = require('../../../../Mobile/src/modules/reviews/services/dishRepository');
const fixtures = require('../../../../Mobile/src/modules/reviews/mocks/fixtures.json');
const id = fixtures.dishes[0].id;
function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}
test('mock repository separates restaurants and excludes restaurant reviews', async () => {
  const repo = createDishRepository({ fixtures });
  assert.equal((await repo.getDishes(fixtures.dishes[0].restaurantId)).length, 2);
  assert.deepEqual(await repo.getDishes('unknown'), []);
  const dish = await repo.getDish(id);
  assert.equal(dish.reviews.length, 1);
  assert.equal(dish.reviews[0].reviewType, 'dish');
  await assert.rejects(repo.getDish('missing'), /not found/);
});
test('live repository uses configured origin, encodes IDs and reports failures', async () => {
  let requested;
  const repo = createDishRepository({ origin: 'http://localhost:3000', fetchImpl: async url => {
    requested = url;
    return { ok: true, json: async () => [] };
  } });
  await repo.getDishes('a&b');
  assert.equal(requested, 'http://localhost:3000/api/dishes?restaurantId=a%26b');
  await assert.rejects(createDishRepository({ fetchImpl: async () => ({ ok: false, status: 404 }) }).getDish(id), /not found/);
  await assert.rejects(createDishRepository({ fetchImpl: async () => ({ ok: true, json: async () => ({}) }) }).getDishes(id), /Invalid/);
});
test('controller rejects malformed IDs before database access', async () => {
  const controller = createDishController({});
  for (const invalid of ['bad', ['100000000000000000000001'], {}]) {
    const res = response();
    await controller.list({ query: { restaurantId: invalid } }, res);
    assert.equal(res.statusCode, 400);
  }
  const res = response();
  await controller.detail({ params: { id: 'bad' } }, res);
  assert.equal(res.statusCode, 400);
});
test('controller scopes list, serializes IDs, and handles database failures', async () => {
  let filter;
  const controller = createDishController({ Dish: { find(value) {
    filter = value;
    return { sort: () => ({ lean: async () => [{ _id: id, name: 'Ramen', __v: 0 }] }) };
  } } });
  const res = response();
  await controller.list({ query: { restaurantId: fixtures.dishes[0].restaurantId } }, res);
  assert.deepEqual(filter, { restaurantId: fixtures.dishes[0].restaurantId });
  assert.deepEqual(res.body, [{ id, name: 'Ramen' }]);
  const failing = createDishController({ Dish: { find() { throw new Error('private database information'); } } });
  const failure = response();
  await failing.list({ query: {} }, failure);
  assert.equal(failure.statusCode, 500);
  assert.equal(failure.body.message, 'Failed to load dishes');
});
test('detail scopes reviews to dish and handles missing dishes', async () => {
  let filter;
  let projection;
  let limit;
  const controller = createDishController({
    Dish: { findById: () => ({ lean: async () => ({ _id: id, name: 'Ramen' }) }) },
    Review: { find(value) {
      filter = value;
      return { select(fields) {
        projection = fields;
        return { sort: () => ({ limit(value) { limit = value; return { lean: async () => [] }; } }) };
      } };
    } }
  });
  const res = response();
  await controller.detail({ params: { id } }, res);
  assert.deepEqual(filter, { dishId: id, reviewType: 'dish' });
  assert.ok(!projection.includes('userId'));
  assert.equal(limit, 50);
  assert.deepEqual(res.body.reviews, []);
  const missing = createDishController({ Dish: { findById: () => ({ lean: async () => null }) } });
  const absent = response();
  await missing.detail({ params: { id } }, absent);
  assert.equal(absent.statusCode, 404);
});

test('repository rejects malformed display data and supports all-dish queries', async () => {
  let requested;
  const repo = createDishRepository({ fetchImpl: async url => {
    requested = url;
    return { ok: true, json: async () => [{ ...fixtures.dishes[0], averageRating: '4' }] };
  } });
  await assert.rejects(repo.getDishes(), /Invalid dish list/);
  assert.equal(requested, '/api/dishes');
  assert.equal((await createDishRepository({ fixtures }).getDishes()).length, 3);
  const badReviews = createDishRepository({ fetchImpl: async () => ({ ok: true, json: async () => ({ ...fixtures.dishes[0], reviews: [null] }) }) });
  await assert.rejects(badReviews.getDish(id), /Invalid dish response/);
});
