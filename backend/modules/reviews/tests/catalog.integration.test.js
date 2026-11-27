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

test('Home and dish recommendations personalize after a questionnaire save', { skip: process.env.RUN_REVIEW_DB_TESTS !== '1', timeout: 120000 }, async () => {
  const fixture = await createCatalogFixture();
  const mongoose = require('mongoose');
  const { User, Restaurant, Dish, Review, Post } = mongoose.models;
  const { ids } = fixture;
  const [postA, postB] = ids.posts.map(String);
  const [dishA, dishB] = ids.dishes.map(String);
  const [nearLat, nearLon] = [33.98, -117.37];
  const old = new Date('2020-01-01T00:00:00Z');
  const otherReviewers = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
  const restaurantReviewId = new mongoose.Types.ObjectId();
  const restaurantPostId = new mongoose.Types.ObjectId();
  const questionnaireInput = {
    version: 1,
    answers: { preferredSpiciness: 2, maximumSpiciness: 4, spicyFoodFrequency: 'sometimes' }
  };

  try {
    await User.updateOne({ _id: ids.user }, { $set: { favoriteCuisines: [] } });
    await Restaurant.updateOne({ _id: ids.restaurants[1] }, { $set: { cuisineType: 'Japanese' } });
    await mongoose.connection.db.collection('favorites').deleteMany({ userId: ids.user });
    for (const [i, spicinessRating] of [5, 2].entries()) {
      const target = { restaurantId: ids.restaurants[i], dishId: ids.dishes[i], reviewType: 'dish' };
      await Review.collection.updateOne({ _id: ids.reviews[i] }, { $set: { createdAt: old, spicinessRating } });
      await Review.insertMany(otherReviewers.map(userId => ({
        ...target, userId, rating: 5 - i, spicinessRating, comment: 'Historic heat rating.', createdAt: old
      })));
      await Dish.collection.updateOne({ _id: ids.dishes[i] }, {
        $set: {
          reviewCount: 3,
          medianSpiciness: spicinessRating,
          spicinessRatingCount: 3,
          spicinessRanking: { median: spicinessRating, sampleCount: 3 }
        }
      });
    }
    const origin = await fixture.listen();
    const login = await fetch(origin + '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: fixture.email, password: fixture.password })
    });
    assert.equal(login.status, 200);
    const { token } = await login.json();
    assert.ok(token);

    async function request(path, { auth = true, method = 'GET', body } = {}) {
      const headers = auth ? { Authorization: `Bearer ${token}` } : {};
      if (body) headers['Content-Type'] = 'application/json';
      const response = await fetch(origin + path, { method, headers, body: JSON.stringify(body) });
      assert.equal(response.status, 200, path);
      return { data: await response.json(), headers: response.headers };
    }

    const home = '/api/posts?category=forYou&limit=1';
    const firstPost = data => data.items[0].id;
    const postIds = data => data.items.map(post => post.id);
    const guest = await request(home, { auth: false });
    const signedIn = await request(home);
    assert.equal(firstPost(guest.data), postA);
    assert.equal(guest.data.items[0].dish.spicinessCompatibility, 'Unknown');
    assert.deepEqual(signedIn.data, guest.data);
    assert.match(signedIn.headers.get('cache-control') || '', /\bprivate\b/);
    assert.match(guest.headers.get('vary') || '', /\bAuthorization\b/i);

    const trending = '/api/posts?category=trending';
    const nearby = `/api/posts?category=nearby&latitude=${nearLat}&longitude=${nearLon}`;
    const recommendations = '/api/recommendations/dishes?mode=forYou';
    const recommendedIds = dishes => dishes.map(({ dish }) => dish.id);
    async function fixtureRecommendations(options) {
      const { data } = await request(recommendations, options);
      return data.dishes.filter(({ dish }) => dish.id === dishA || dish.id === dishB);
    }
    const trendingBefore = postIds((await request(trending)).data);
    assert.deepEqual(postIds((await request(nearby)).data), [postA, postB]);
    const recommendationsBefore = await fixtureRecommendations();
    assert.deepEqual(recommendedIds(recommendationsBefore), [dishA, dishB]);
    assert.deepEqual(recommendationsBefore.map(item => item.spicinessCompatibility), ['Unknown', 'Unknown']);

    await User.collection.updateOne({ _id: ids.user }, {
      $set: { spicinessQuestionnaire: { ...questionnaireInput, version: 99, savedAt: new Date() } }
    });
    assert.deepEqual((await request(home)).data, signedIn.data);
    assert.deepEqual(await fixtureRecommendations(), recommendationsBefore);

    const questionnairePath = '/api/users/me/spiciness-questionnaire';
    const saved = await request(questionnairePath, { method: 'PUT', body: questionnaireInput });
    assert.equal(saved.data.spicinessQuestionnaireRevision, 1);
    assert.deepEqual((await request(questionnairePath)).data, saved.data);
    const { data: first } = await request(home);
    assert.deepEqual(Object.keys(first).sort(), ['hasMore', 'items', 'nextCursor']);
    assert.equal(firstPost(first), postB);
    assert.equal(first.items[0].dish.spicinessCompatibility, 'Within Preference');
    assert.equal(first.hasMore, true);
    assert.ok(first.nextCursor);
    const { data: second } = await request(`${home}&cursor=${encodeURIComponent(first.nextCursor)}`);
    assert.equal(firstPost(second), postA);
    assert.equal(second.items[0].dish.spicinessCompatibility, 'Above Preference');
    assert.equal(second.hasMore, false);
    assert.equal(second.nextCursor, null);
    assert.deepEqual((await request(home, { auth: false })).data, guest.data);
    assert.deepEqual(postIds((await request(trending)).data), trendingBefore);
    assert.deepEqual(postIds((await request(nearby)).data), [postA, postB]);
    const recommendationsAfter = await fixtureRecommendations();
    assert.deepEqual(recommendedIds(recommendationsAfter), [dishB, dishA]);
    assert.deepEqual(
      recommendationsAfter.map(item => item.spicinessCompatibility),
      ['Within Preference', 'Above Preference']
    );
    assert.deepEqual(await fixtureRecommendations({ auth: false }), recommendationsBefore);

    const clear = id => request(`/api/reviews/${id}`, { method: 'PUT', body: { spicinessRating: null } });
    await clear(ids.reviews[0]);
    assert.equal(firstPost((await request(home)).data), postB);
    await clear(ids.reviews[1]);
    assert.equal(firstPost((await request(home)).data), postA);
    const publicDish = (await request(`/api/dishes/${ids.dishes[1]}`)).data;
    assert.equal(publicDish.medianSpiciness, 2);
    assert.equal(publicDish.spicinessRatingCount, 2);
    assert.equal(Object.hasOwn(publicDish, 'spicinessRanking'), false);
    assert.equal(Object.hasOwn(publicDish, 'statisticsRevision'), false);

    // Equal scores use creation date, then descending post ID.
    await Dish.updateOne({ _id: ids.dishes[1] }, { $set: { averageRating: 5 } });
    await Post.collection.updateOne({ _id: ids.posts[1] }, { $set: { createdAt: old } });
    assert.equal(firstPost((await request(home)).data), postA);
    await Post.collection.updateOne({ _id: ids.posts[0] }, { $set: { createdAt: old } });
    assert.equal(firstPost((await request(home)).data), postB);

    // Equal scores favor a matching cuisine before the date and ID tie-breaks.
    await Restaurant.updateOne({ _id: ids.restaurants[1] }, { $set: { cuisineType: 'Italian' } });
    await User.updateOne({ _id: ids.user }, { $set: { favoriteCuisines: ['Japanese'] } });
    await Dish.updateOne({ _id: ids.dishes[0] }, { $set: { averageRating: 2 } });
    assert.equal(firstPost((await request(home)).data), postA);

    // A newer post with a restaurant review has no ranked dish and still scores zero.
    await Review.create({ _id: restaurantReviewId, restaurantId: ids.restaurants[0], userId: ids.user,
      reviewType: 'restaurant', rating: 5, spicinessRating: 2, comment: 'Restaurant review.' });
    await Post.create({ _id: restaurantPostId, authorId: ids.user, restaurantId: ids.restaurants[0],
      reviewId: restaurantReviewId, title: 'Restaurant post', imageUrls: [`/api/posts/photos/${ids.photos[0]}`] });
    assert.deepEqual(postIds((await request('/api/posts?category=forYou')).data), [postA, postB, String(restaurantPostId)]);

    const saves = await Promise.all([1, 3].map(preferredSpiciness => request(questionnairePath, {
      method: 'PUT',
      body: { ...questionnaireInput, answers: { ...questionnaireInput.answers, preferredSpiciness } }
    })));
    const revisions = saves.map(({ data }) => data.spicinessQuestionnaireRevision);
    assert.deepEqual(revisions.sort(), [2, 3]);
    const last = saves.find(({ data }) => data.spicinessQuestionnaireRevision === 3);
    assert.deepEqual((await request(questionnairePath)).data, last.data);
  } finally {
    try {
      await Post.deleteOne({ _id: restaurantPostId });
      await Review.deleteMany({ $or: [{ _id: restaurantReviewId }, { userId: { $in: otherReviewers } }] });
    } finally { await fixture.cleanup(); }
  }
});
