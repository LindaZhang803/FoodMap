const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseDishQuery } = require('../services/dishQuery');
const { auditCatalog } = require('../services/catalogAudit');
test('menu search combines literal partial keywords, category, price and rated-only filtering', () => {
  const { filter, order } = parseDishQuery({ q: 'Ramen (hot).*', category: 'main', minPrice: '0', maxPrice: '25.50', minRating: '4', sort: 'highestRated' });
  assert.equal(new RegExp(filter.name.$regex, 'i').test('Try RAMEN (hot).* today'), true);
  assert.equal(new RegExp(filter.name.$regex, 'i').test('Ramen hot'), false);
  assert.deepEqual(filter.price, { $ne: null, $gte: 0, $lte: 25.5 });
  assert.equal(filter.category, 'main');
  assert.deepEqual(filter.averageRating, { $gte: 4 });
  assert.deepEqual(filter.reviewCount, { $gt: 0 });
  assert.equal(order.averageRating, -1);
});
test('malformed menu query inputs fail before database access; defaults stay compatible', () => {
  for (const query of [{ q: {} }, { category: ['main'] }, { minPrice: '' }, { minPrice: '-1' }, { maxPrice: 'Infinity' }, { minRating: '5.1' }, { sort: {} }, { minPrice: '20', maxPrice: '10' }]) {
    assert.throws(() => parseDishQuery(query), error => error.status === 400);
  }
  assert.deepEqual(parseDishQuery({}).filter, {});
  assert.deepEqual(parseDishQuery({ category: 'other' }).filter.$or, [{ category: 'other' }, { category: null }]);
  assert.deepEqual(parseDishQuery({ sort: 'lowestPrice' }).filter.price, { $ne: null });
});
test('catalog audit flags orphans and likely duplicates without deleting chains or mutating data', () => {
  const restaurants = [
    { _id: 'r1', name: 'Cafe', latitude: 1, longitude: 2, address: 'A', cuisineType: 'Japanese', imageUrl: '/a.jpg' },
    { _id: 'r2', name: 'Cafe', latitude: 3, longitude: 4, address: 'B', cuisineType: ' japanese ', imageUrl: 'javascript:bad' },
    { _id: 'r3', name: ' CAFE ', latitude: 1, longitude: 2 }
  ];
  const dishes = [{ _id: 'd1', restaurantId: 'missing', name: 'Ramen', price: null }];
  const snapshot = JSON.stringify({ restaurants, dishes });
  const report = auditCatalog(restaurants, dishes);
  assert.equal(report.readOnly, true);
  assert.equal(JSON.stringify({ restaurants, dishes }), snapshot);
  assert.equal(report.issues.filter(i => i.field === 'duplicate').length, 1);
  assert.ok(report.issues.some(i => i.field === 'restaurantId'));
  assert.ok(report.issues.some(i => i.id === 'r2' && i.field === 'imageUrl'));
  assert.equal(report.cuisineVariants.length, 1);
});
