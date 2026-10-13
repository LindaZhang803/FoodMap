const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateReview } = require('../validators/review');
const { calculateRating } = require('../services/rating');
const fixtures = require('../../../../Mobile/src/modules/reviews/mocks/fixtures.json');
test('fixtures satisfy review rules and dish ownership', () => {
  for (const review of fixtures.reviews) {
    assert.deepEqual(validateReview(review), []);
    if (review.dishId) assert.equal(fixtures.dishes.find(d => d.id === review.dishId).restaurantId, review.restaurantId);
  }
});
test('reject invalid ratings, targets, text and photos', () => {
  const valid = fixtures.reviews[0];
  for (const patch of [{ rating: 0 }, { rating: 6 }, { rating: 1.5 }, { rating: '5' }, { dishId: null }, { restaurantId: 'bad' }, { reviewType: 'other' }, { reviewType: 'restaurant' }, { comment: ' ' }, { photoUrls: ['file:///local.jpg'] }, { photoUrls: Array(6).fill('https://example.com/a.jpg') }]) {
    assert.ok(validateReview({ ...valid, ...patch }).length);
  }
});
test('separate restaurant and dish ratings, including unrated dish', () => {
  for (const dish of fixtures.dishes) assert.deepEqual(calculateRating(fixtures.reviews.filter(r => r.reviewType === 'dish' && r.dishId === dish.id)), { averageRating: dish.averageRating, reviewCount: dish.reviewCount });
  assert.deepEqual(calculateRating(fixtures.reviews.filter(r => r.reviewType === 'restaurant')), { averageRating: 3, reviewCount: 1 });
});
test('rating changes after add, edit and delete', () => {
  const reviews = [{ rating: 3 }];
  reviews.push({ rating: 5 });
  assert.equal(calculateRating(reviews).averageRating, 4);
  reviews[0].rating = 1;
  assert.equal(calculateRating(reviews).averageRating, 3);
  reviews.pop();
  assert.equal(calculateRating(reviews).averageRating, 1);
  reviews.pop();
  assert.deepEqual(calculateRating(reviews), { averageRating: null, reviewCount: 0 });
  assert.throws(() => calculateRating([{ rating: 7 }]));
});
