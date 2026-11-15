const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseCatalogQuery, filterCatalog, distanceKm } = require('../../restaurants/services/catalogQuery');
const rows = [
  { _id: 'a', name: 'Sushi House', cuisineType: ' Japanese ', rating: 4.5, minPrice: 10, maxPrice: 30, latitude: 34, longitude: -117 },
  { _id: 'b', name: 'Cafe', cuisineType: 'Italian', rating: null, minPrice: null, maxPrice: null, latitude: 35, longitude: -117 },
  { _id: 'c', name: 'Noodle Bar', cuisineType: 'Japanese', rating: 4, minPrice: 20, maxPrice: 40, latitude: 34.01, longitude: -117 },
  { _id: 'd', name: 'Unknown location', rating: 5, latitude: 999, longitude: -117 }
];
test('restaurant search combines cuisine, overlapping price ranges, ratings and kilometer distances', () => {
  const options = parseCatalogQuery({ q: 'JAPAN', cuisine: 'japanese', minPrice: '25', maxPrice: '35', minRating: '4', latitude: '34', longitude: '-117', maxDistance: '2', sort: 'distance' });
  const result = filterCatalog(rows, options);
  assert.deepEqual(result.map(r => r._id), ['a', 'c']);
  assert.equal(result[0].distanceKm, 0);
  assert.ok(result[1].distanceKm > 1 && result[1].distanceKm < 2);
  assert.equal(rows[0].distanceKm, undefined, 'inputs are not modified');
});
test('dish-name matches find parent restaurants; unknown prices/ratings are not treated as zero', () => {
  assert.deepEqual(filterCatalog(rows, parseCatalogQuery({ q: 'ramen' }), new Set(['c'])).map(r => r._id), ['c']);
  assert.deepEqual(filterCatalog(rows, parseCatalogQuery({ minPrice: '0', maxPrice: '10' })).map(r => r._id), ['a']);
  assert.ok(!filterCatalog(rows, parseCatalogQuery({ minRating: '0' })).some(r => r._id === 'b'));
  assert.equal(filterCatalog(rows, parseCatalogQuery({ q: '.*' })).length, 0);
  assert.equal(filterCatalog(rows, parseCatalogQuery({})).length, rows.length);
});
test('invalid restaurant query types, ranges and incomplete locations return validation errors', () => {
  for (const query of [{ q: [] }, { cuisine: {} }, { minPrice: '' }, { minRating: '6' }, { latitude: '91', longitude: '0' }, { latitude: '34' }, { maxDistance: '1' }, { sort: 'distance' }, { sort: ['name'] }, { minPrice: '5', maxPrice: '2' }]) {
    assert.throws(() => parseCatalogQuery(query), e => e.status === 400);
  }
  assert.ok(Math.abs(distanceKm(0, 0, 0, 1) - 111.195) < 0.01);
  const sorted = filterCatalog(rows, parseCatalogQuery({ sort: 'highestRated' }));
  assert.equal(sorted.at(-1)._id, 'b');
});
