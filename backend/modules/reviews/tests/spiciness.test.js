const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateReview } = require('../validators/review');
const mongoose = require('mongoose');
const { createModels } = require('../models');

const review = {
  restaurantId: '100000000000000000000001',
  dishId: '200000000000000000000001',
  reviewType: 'dish',
  rating: 5,
  comment: 'Good food',
  photoUrls: []
};

test('spiciness rating is optional', () => {
  assert.deepEqual(validateReview(review), []);
});

test('accepts spiciness ratings from 1 to 5', () => {
  for (const spicinessRating of [1, 2, 3, 4, 5]) {
    assert.deepEqual(
      validateReview({ ...review, spicinessRating }),
      []
    );
  }
});

test('rejects invalid spiciness ratings', () => {
  for (const spicinessRating of [0, 6, 2.5, '3']) {
    const errors = validateReview({
      ...review,
      spicinessRating
    });

    assert.ok(
      errors.some(message => message.includes('spicinessRating')),
      `Should reject ${JSON.stringify(spicinessRating)}`
    );
  }
});

test('Review model supports optional spiciness ratings', async () => {
  const isolated = new mongoose.Mongoose();
  const { Review } = createModels(isolated);

  assert.ok(
    Review.schema.path('spicinessRating'),
    'Review needs a spicinessRating field'
  );

  const data = {
    ...review,
    userId: '400000000000000000000001'
  };

  // Existing reviews can omit spiciness.
  await new Review(data).validate();

  const document = new Review({
    ...data,
    spicinessRating: 3
  });

  await document.validate();
  assert.equal(document.spicinessRating, 3);

  for (const spicinessRating of [0, 6, 2.5]) {
    await assert.rejects(
      new Review({
        ...data,
        spicinessRating
      }).validate()
    );
  }
});