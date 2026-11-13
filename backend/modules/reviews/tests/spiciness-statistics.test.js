const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateSpicinessStatistics
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