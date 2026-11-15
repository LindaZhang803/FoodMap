const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createCatalogFixture } = require('./catalogIntegrationFixture');
test('real main app connects restaurant filters, dish details, recommendations and post feed ranking', { skip: process.env.RUN_REVIEW_DB_TESTS !== '1', timeout: 120000 }, async () => {
  const fixture = await createCatalogFixture();
  try {
    const origin = await fixture.listen();
    const login = await fetch(origin + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: fixture.email, password: fixture.password }) });
    assert.equal(login.status, 200);
    const session = await login.json();
    const token = session.token || session.accessToken;
    assert.ok(token, 'real login returns a token');
    const get = async path => {
      const response = await fetch(origin + path, { headers: { Authorization: `Bearer ${token}` } });
      assert.equal(response.status, 200, path);
      return response.json();
    };
    const search = await get('/api/restaurants?q=Synthetic%20Ramen&minPrice=10&maxPrice=20&cuisine=japanese&sort=highestRated');
    assert.deepEqual(search.map(r => r._id), [String(fixture.ids.restaurants[0])]);
    assert.ok(search[0].dishNames.includes('Synthetic Ramen'));
    const dish = await get(`/api/dishes/${fixture.ids.dishes[0]}`);
    assert.equal(dish.restaurantName, '[SYNTHETIC] Japanese Integration Cafe');
    assert.equal(dish.price, 12.5);
    assert.equal(dish.reviews.length, 1);
    const recommendations = await get('/api/recommendations/dishes?limit=50');
    const suggested = recommendations.dishes.filter(d => fixture.ids.dishes.some(id => String(id) === d.dish.id));
    assert.equal(suggested[0].dish.id, String(fixture.ids.dishes[1]));
    const forYou = await get('/api/posts?category=forYou&limit=30');
    const posts = forYou.items.filter(p => fixture.ids.posts.some(id => String(id) === p.id));
    assert.deepEqual(posts.map(p => p.id), [String(fixture.ids.posts[1]), String(fixture.ids.posts[0])]);
    const trending = await get('/api/posts?category=trending&limit=30');
    const popular = trending.items.filter(p => fixture.ids.posts.some(id => String(id) === p.id));
    assert.deepEqual(popular.map(p => p.id), [String(fixture.ids.posts[0]), String(fixture.ids.posts[1])]);
    const photo = await fetch(origin + posts[0].coverImageUrl);
    assert.equal(photo.status, 200);
    const saved = await get('/api/favorites');
    assert.ok(JSON.stringify(saved).includes('Synthetic Pasta'));
    console.log('Verified: real login, menu-name search, filters, dish name/price/review display, personalized/trending Home feed order, photo retrieval and favorites.');
  } finally { await fixture.cleanup(); }
});
