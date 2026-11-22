const { rankDishes } = require('../recommendations/rankDishes');

const answers = {
  preferredSpiciness: 2,
  maximumSpiciness: 4,
  spicyFoodFrequency: 'sometimes'
};

function rank(summaries, spicinessAnswers, options = {}) {
  const dishes = summaries.map((spicinessRanking, index) => ({
    _id: `dish-${index}`,
    restaurantId: 'restaurant',
    reviewCount: 3,
    averageRating: 5,
    spicinessRanking
  }));
  return rankDishes({
    dishes,
    restaurants: [{ _id: 'restaurant' }],
    spicinessAnswers,
    ...options
  });
}

test('Home scores preferred, half-step, maximum, excessive and unknown heat on the same scale', () => {
  const ranked = rank([
    { median: 2, sampleCount: 3 },
    { median: 2.5, sampleCount: 4 },
    { median: 4, sampleCount: 3 },
    { median: 5, sampleCount: 3 },
    undefined
  ], answers);

  expect(ranked.map(item => item.dish.id)).toEqual(['dish-0', 'dish-1', 'dish-2', 'dish-4', 'dish-3']);
  const scores = Object.fromEntries(ranked.map(item => [item.dish.id, item.score]));
  expect(scores['dish-0']).toBeCloseTo(0.825);
  expect(scores['dish-1']).toBeCloseTo(0.74375);
  expect(scores['dish-2']).toBeCloseTo(0.5);
  expect(scores['dish-3']).toBeCloseTo(0.175);
  expect(scores['dish-4']).toBe(0.5);
});

test.each([
  { median: null, sampleCount: 3 },
  { median: 2, sampleCount: 2 },
  { median: 2, sampleCount: 3.5 },
  { median: 2, sampleCount: '3' },
  { median: '2', sampleCount: 3 },
  { median: NaN, sampleCount: 3 },
  { median: 0, sampleCount: 3 },
  { median: 6, sampleCount: 3 }
])('Home treats an invalid spiciness ranking as unknown (%j)', summary => {
  expect(rank([summary], answers)[0].score).toBe(0.5);
});

test.each(['never', 'rarely', 'sometimes', 'often', 'everyDay'])('frequency %s uses the same blend', spicyFoodFrequency => {
  const [item] = rank([{ median: 2, sampleCount: 3 }], { ...answers, spicyFoodFrequency });
  expect(item.score).toBeCloseTo(0.825);
});

test('ordinary ranking and Trending preserve their original scores', () => {
  const summary = [{ median: 2, sampleCount: 3 }];
  const activity = [{ dishId: 'dish-0', recentReviews: 2, likes: 4, favorites: 1 }];

  expect(rank(summary, undefined, { activity })[0].score).toBeCloseTo(7.56495);
  expect(rank(summary, undefined, { activity, mode: 'trending' })[0].score).toBe(12);
});
