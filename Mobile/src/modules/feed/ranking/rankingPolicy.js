import { FLAVOR_DIMENSIONS, isRecord } from '../contracts';

/**
 * Proposed feed-local policy: match flavor targets with equal default weights.
 * Each restaurant uses its highest dish score. Fallback popularity is measured
 * by review count, never visits. The ranker applies these selection rules.
 *
 * Weights control how much each flavor matters; targets describe the user's
 * preferred intensity. Callers can supply a positive finite weight per flavor.
 */
export const DEFAULT_RANKING_POLICY = Object.freeze({
  weights: Object.freeze(
    Object.fromEntries(FLAVOR_DIMENSIONS.map((dimension) => [dimension, 1]))
  ),
});

/**
 * Require exactly the six known flavors, each with a positive finite weight.
 * Return the original weights and their total without changing the policy.
 */
export function validateRankingPolicy(policy = DEFAULT_RANKING_POLICY) {
  const weights = policy && policy.weights;
  const validationMessage =
    'Ranking weights must contain six strictly positive finite numbers.';

  if (!isRecord(weights)) {
    throw new TypeError(validationMessage);
  }

  const hasExactlySixWeights =
    Object.keys(weights).length === FLAVOR_DIMENSIONS.length;
  if (!hasExactlySixWeights) {
    throw new TypeError(validationMessage);
  }

  const hasValidWeights = FLAVOR_DIMENSIONS.every((dimension) => {
    const ownsDimension = Object.prototype.hasOwnProperty.call(weights, dimension);
    if (!ownsDimension) return false;

    const weight = weights[dimension];

    return (
      typeof weight === 'number' &&
      Number.isFinite(weight) &&
      weight > 0
    );
  });

  if (!hasValidWeights) {
    throw new TypeError(validationMessage);
  }

  const total = FLAVOR_DIMENSIONS.reduce(
    (sum, dimension) => sum + weights[dimension],
    0
  );

  // Individual finite weights can still overflow when added together.
  if (!Number.isFinite(total)) {
    throw new TypeError('Ranking weight total must be finite.');
  }

  return { weights, total };
}