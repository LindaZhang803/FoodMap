function calculateSpicinessStatistics(values = []) {
  // Only count integer ratings from 1 to 5.
  const ratings = values
    .filter(value =>
      Number.isInteger(value) && value >= 1 && value <= 5
    )
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

  let medianSpiciness = null;

  if (ratings.length > 0) {
    const middle = Math.floor(ratings.length / 2);

    medianSpiciness = ratings.length % 2 === 1
      ? ratings[middle]
      : (ratings[middle - 1] + ratings[middle]) / 2;
  }

  return {
    medianSpiciness,
    spicinessDistribution,
    spicinessRatingCount: ratings.length
  };
}

module.exports = { calculateSpicinessStatistics };