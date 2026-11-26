const SPICINESS_COMPATIBILITY = Object.freeze({
  WITHIN: 'Within Preference',
  ABOVE: 'Above Preference',
  UNKNOWN: 'Unknown'
});

const SPICINESS_COMPATIBILITY_NOTE =
  'Spiciness compatibility is based on community ratings and is not a medical or allergen safety guarantee.';

const isMedianHeat = value => Number.isFinite(value) && value >= 1 && value <= 5;

function getSpicinessCompatibility(answers, median, sampleCount = 0) {
  const preferred = answers?.preferredSpiciness;
  if (!Number.isInteger(preferred) || preferred < 1 || preferred > 5 ||
      !isMedianHeat(median) || !Number.isInteger(sampleCount) || sampleCount < 1) {
    return SPICINESS_COMPATIBILITY.UNKNOWN;
  }

  return median <= preferred ? SPICINESS_COMPATIBILITY.WITHIN : SPICINESS_COMPATIBILITY.ABOVE;
}

function resolveDishHeatSummary(dish) {
  // Use the same heat data the dish API exposes.
  return {
    median: dish?.medianSpiciness ?? null,
    sampleCount: dish?.spicinessRatingCount ?? 0
  };
}

module.exports = { SPICINESS_COMPATIBILITY, SPICINESS_COMPATIBILITY_NOTE, getSpicinessCompatibility, resolveDishHeatSummary };
