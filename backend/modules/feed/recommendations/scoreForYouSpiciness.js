function scoreForYouSpiciness(rawScore, spicinessRanking, { preferredSpiciness, maximumSpiciness }) {
  const baseline = rawScore / (rawScore + 5);
  const { median, sampleCount } = spicinessRanking || {};
  if (!Number.isFinite(median) || median < 1 || median > 5 ||
      !Number.isInteger(sampleCount) || sampleCount < 3) {
    return baseline;
  }

  const match = median > maximumSpiciness ? 0 : 1 - Math.abs(median - preferredSpiciness) / 4;
  return 0.35 * baseline + 0.65 * match;
}

module.exports = { scoreForYouSpiciness };
