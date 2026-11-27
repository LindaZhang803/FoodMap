function scoreForYouSpiciness(rawScore, spicinessRanking, answers) {
  const baseline = rawScore / (rawScore + 5);
  const { preferredSpiciness, maximumSpiciness } = answers || {};
  if (!Number.isInteger(preferredSpiciness) || preferredSpiciness < 1 || preferredSpiciness > 5) {
    return baseline;
  }

  const { median, sampleCount } = spicinessRanking || {};
  if (!Number.isFinite(median) || median < 1 || median > 5 ||
      !Number.isInteger(sampleCount) || sampleCount < 3) {
    return baseline;
  }

  const cap = Number.isInteger(maximumSpiciness) && maximumSpiciness >= preferredSpiciness && maximumSpiciness <= 5
    ? maximumSpiciness
    : preferredSpiciness;
  // Questionnaire version 1 stores frequency without using it to weight the blend.
  const match = median > cap ? 0 : 1 - Math.abs(median - preferredSpiciness) / 4;
  return 0.35 * baseline + 0.65 * match;
}

module.exports = { scoreForYouSpiciness };
