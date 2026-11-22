const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateSpicinessStatistics,
  calculateSpicinessRanking
} = require('../services/spiciness');

test('calculates median and distribution for odd ratings', () => {
  assert.deepEqual(calculateSpicinessStatistics([5, 1, 3]), {
    medianSpiciness: 3,
    spicinessDistribution: {
      level1: 1,
      level2: 0,
      level3: 1,
      level4: 0,
      level5: 1
    },
    spicinessRatingCount: 3
  });
});

test('calculates median and distribution for even ratings', () => {
  assert.deepEqual(calculateSpicinessStatistics([4, 1]), {
    medianSpiciness: 2.5,
    spicinessDistribution: {
      level1: 1,
      level2: 0,
      level3: 0,
      level4: 1,
      level5: 0
    },
    spicinessRatingCount: 2
  });
});

test('ignores missing and invalid ratings', () => {
  assert.deepEqual(
    calculateSpicinessStatistics([undefined, null, 0, 6, 2.5, '3']),
    {
      medianSpiciness: null,
      spicinessDistribution: {
        level1: 0,
        level2: 0,
        level3: 0,
        level4: 0,
        level5: 0
      },
      spicinessRatingCount: 0
    }
  );
});

test('handles empty ratings and preserves the original array', () => {
  assert.equal(
    calculateSpicinessStatistics([]).medianSpiciness,
    null
  );

  const ratings = [5, 1, 3];
  calculateSpicinessStatistics(ratings);
  assert.deepEqual(ratings, [5, 1, 3]);
});
test('ranking requires three distinct reviewers and uses the latest valid rating', () => {
  const observations = [
    { userId: 'first', spicinessRating: '5' },
    { userId: 'first', spicinessRating: 2 },
    { userId: 'first', spicinessRating: 5 },
    { userId: 'second', spicinessRating: 3 }
  ];

  assert.deepEqual(calculateSpicinessRanking(observations), {
    median: null,
    sampleCount: 2
  });
  assert.deepEqual(calculateSpicinessRanking([
    ...observations,
    { userId: 'third', spicinessRating: 1 }
  ]), { median: 2, sampleCount: 3 });
});

test('ranking averages even medians and trims outliers using interpolated quartiles', () => {
  for (const [ratings, expected] of [
    [[1, 2, 3, 5], { median: 2.5, sampleCount: 4 }],
    [[2, 2, 2, 2, 5], { median: 2, sampleCount: 4 }],
    [[1, 2, 2, 2, 3, 4], { median: 2, sampleCount: 5 }]
  ]) {
    const observations = ratings.map((spicinessRating, index) => ({
      userId: String(index),
      spicinessRating
    }));
    assert.deepEqual(calculateSpicinessRanking(observations), expected);
  }
});
