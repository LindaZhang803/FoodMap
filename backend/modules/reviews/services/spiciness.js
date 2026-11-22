const isSpicinessRating = value =>
  Number.isInteger(value) && value >= 1 && value <= 5;

function median(sortedValues) {
  if (!sortedValues.length) {
    return null;
  }

  const middle = Math.floor(sortedValues.length / 2);
  return sortedValues.length % 2 === 1
    ? sortedValues[middle]
    : (sortedValues[middle - 1] + sortedValues[middle]) / 2;
}

function calculateSpicinessStatistics(values = []) {
  const ratings = values
    .filter(isSpicinessRating)
    .sort((a, b) => a - b);

  const spicinessDistribution = {
    level1: 0,
    level2: 0,
    level3: 0,
    level4: 0,
    level5: 0
  };

  for (const rating of ratings) {
    spicinessDistribution[`level${rating}`] += 1;
  }

  return {
    medianSpiciness: median(ratings),
    spicinessDistribution,
    spicinessRatingCount: ratings.length
  };
}

function quartile(sortedValues, fraction) {
  const position = (sortedValues.length - 1) * fraction;
  const lower = Math.floor(position);
  return sortedValues[lower] +
    (sortedValues[Math.ceil(position)] - sortedValues[lower]) * (position - lower);
}

// Observations arrive in descending createdAt and _id order.
function calculateSpicinessRanking(observations) {
  const latestRatings = new Map();
  for (const { userId, spicinessRating } of observations) {
    if (userId != null && isSpicinessRating(spicinessRating)) {
      const reviewer = String(userId);
      if (!latestRatings.has(reviewer)) {
        latestRatings.set(reviewer, spicinessRating);
      }
    }
  }

  let ratings = [...latestRatings.values()].sort((a, b) => a - b);
  if (ratings.length >= 5) {
    const q1 = quartile(ratings, 0.25);
    const q3 = quartile(ratings, 0.75);
    const margin = 1.5 * (q3 - q1);
    ratings = ratings.filter(value => value >= q1 - margin && value <= q3 + margin);
  }

  return {
    median: ratings.length >= 3 ? median(ratings) : null,
    sampleCount: ratings.length
  };
}

module.exports = { calculateSpicinessStatistics, calculateSpicinessRanking };
