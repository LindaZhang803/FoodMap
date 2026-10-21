import { FLAVOR_DIMENSIONS, isValidFlavorVector } from '../contracts';
import { DEFAULT_RANKING_POLICY, validateRankingPolicy } from './rankingPolicy';

// Use IDs as the final tie-breaker so equal scores always give the same order.
function compareIds(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function getReviewCount(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function getRatingForRanking(value, reviewCount) {
  // Zero reviews means unrated, even if a source includes a placeholder rating.
  // Use -1 so an unrated item sorts below a reviewed rating of 0.
  const hasReviews = getReviewCount(reviewCount) > 0;
  const hasValidRating =
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 5;

  return hasReviews && hasValidRating ? value : -1;
}

function compareDishTies(left, right) {
  // Equal flavor scores: higher rating, more reviews, then ascending dish ID.
  const ratingDifference =
    getRatingForRanking(right.averageRating, right.reviewCount) -
    getRatingForRanking(left.averageRating, left.reviewCount);
  if (ratingDifference !== 0) return ratingDifference;

  const reviewCountDifference =
    getReviewCount(right.reviewCount) - getReviewCount(left.reviewCount);
  if (reviewCountDifference !== 0) return reviewCountDifference;

  return compareIds(left.dishId, right.dishId);
}

function compareFallbackDishes(left, right) {
  // Without a flavor match, popularity (review count) takes priority over rating.
  const reviewCountDifference =
    getReviewCount(right.reviewCount) - getReviewCount(left.reviewCount);
  if (reviewCountDifference !== 0) return reviewCountDifference;

  const ratingDifference =
    getRatingForRanking(right.averageRating, right.reviewCount) -
    getRatingForRanking(left.averageRating, left.reviewCount);
  if (ratingDifference !== 0) return ratingDifference;

  return compareIds(left.dishId, right.dishId);
}

function scoreWithValidatedWeights(flavorIntensities, flavorTargets, weights) {
  if (
    !isValidFlavorVector(flavorIntensities) ||
    !isValidFlavorVector(flavorTargets)
  ) {
    return null;
  }

  // Divide all weights by the largest one to avoid numeric overflow.
  // This common scale cancels out when distance is divided by maximum distance.
  const largestWeight = Math.max(
    ...FLAVOR_DIMENSIONS.map((dimension) => weights[dimension])
  );
  let weightedDistance = 0;
  let maximumDistance = 0;

  FLAVOR_DIMENSIONS.forEach((dimension) => {
    const scaledWeight = weights[dimension] / largestWeight;
    const intensityDifference = Math.abs(
      flavorIntensities[dimension] - flavorTargets[dimension]
    );

    weightedDistance += scaledWeight * intensityDifference;
    // Each flavor intensity ranges from 0 to 5, so its largest difference is 5.
    maximumDistance += scaledWeight * 5;
  });

  // Identical flavors score 100; the largest possible difference scores 0.
  return 100 * (1 - weightedDistance / maximumDistance);
}

/**
 * Calculate similarity across all six flavors without changing either vector.
 * Return null for unknown or invalid flavors. A score of 0 is a valid match.
 */
export function scoreDish(
  flavorIntensities,
  flavorTargets,
  policy = DEFAULT_RANKING_POLICY
) {
  const { weights } = validateRankingPolicy(policy);
  return scoreWithValidatedWeights(flavorIntensities, flavorTargets, weights);
}

function compareRestaurantEntries(left, right) {
  const leftIsPersonalized = left.rankingMode === 'personalized';
  const rightIsPersonalized = right.rankingMode === 'personalized';

  // Even a flavor score of 0 comes before restaurants without a flavor score.
  if (leftIsPersonalized !== rightIsPersonalized) {
    return leftIsPersonalized ? -1 : 1;
  }

  const ratingDifference =
    getRatingForRanking(right.restaurant.rating, right.restaurant.reviewCount) -
    getRatingForRanking(left.restaurant.rating, left.restaurant.reviewCount);
  const reviewCountDifference =
    getReviewCount(right.restaurant.reviewCount) -
    getReviewCount(left.restaurant.reviewCount);

  if (leftIsPersonalized) {
    // Personalized order: flavor score, restaurant rating, review count, then ID.
    const scoreDifference = right.preferenceScore - left.preferenceScore;
    if (scoreDifference !== 0) return scoreDifference;
    if (ratingDifference !== 0) return ratingDifference;
    if (reviewCountDifference !== 0) return reviewCountDifference;
  } else {
    // Fallback order: restaurant review count, rating, then ID.
    if (reviewCountDifference !== 0) return reviewCountDifference;
    if (ratingDifference !== 0) return ratingDifference;
  }

  return compareIds(left.restaurantId, right.restaurantId);
}

/**
 * Return a new sorted array without changing candidates, dishes, or sources.
 * Each restaurant uses its best matching dish, rather than summing its menu.
 * Without usable preferences or dish flavors, choose a popular fallback dish.
 * Only dishes belonging to the candidate's restaurant can be recommended.
 *
 * @param {import('../contracts').FeedCandidate[]} candidates
 * @param {import('../contracts').PreferenceSnapshot} snapshot
 * @returns {import('../contracts').RankedRestaurantEntry[]}
 */
export function rankCandidates(
  candidates,
  snapshot,
  policy = DEFAULT_RANKING_POLICY
) {
  if (!Array.isArray(candidates)) {
    throw new TypeError('Candidates must be an array.');
  }

  const { weights } = validateRankingPolicy(policy);
  const hasUsablePreferences =
    snapshot &&
    snapshot.status === 'ready' &&
    isValidFlavorVector(snapshot.flavorTargets);
  const flavorTargets = hasUsablePreferences ? snapshot.flavorTargets : null;
  const seenRestaurantIds = new Set();
  const entries = [];

  candidates.forEach((candidate) => {
    // Keep the first valid candidate for each restaurant ID.
    if (
      !candidate ||
      !candidate.restaurant ||
      typeof candidate.restaurantId !== 'string' ||
      candidate.restaurantId !== candidate.restaurant._id ||
      seenRestaurantIds.has(candidate.restaurantId)
    ) {
      return;
    }
    seenRestaurantIds.add(candidate.restaurantId);

    const ownedDishes = Array.isArray(candidate.dishes)
      ? candidate.dishes.filter(
          (dish) => dish && dish.restaurantId === candidate.restaurantId
        )
      : [];
    let bestMatchingDish = null;
    let bestMatchScore = null;
    let popularDish = null;

    ownedDishes.forEach((dish) => {
      // Track a fallback even when this dish has no usable flavor data.
      if (!popularDish || compareFallbackDishes(dish, popularDish) < 0) {
        popularDish = dish;
      }

      const score = flavorTargets
        ? scoreWithValidatedWeights(dish.flavorIntensities, flavorTargets, weights)
        : null;
      if (score === null) return;

      const hasHigherScore = bestMatchScore === null || score > bestMatchScore;
      const winsScoreTie =
        score === bestMatchScore && compareDishTies(dish, bestMatchingDish) < 0;

      if (hasHigherScore || winsScoreTie) {
        bestMatchingDish = dish;
        bestMatchScore = score;
      }
    });

    // Restaurants with no dishes stay visible with a null recommendation.
    entries.push({
      key: `restaurant:${candidate.restaurantId}`,
      restaurantId: candidate.restaurantId,
      restaurant: candidate.restaurant,
      recommendedDish: bestMatchingDish || popularDish,
      preferenceScore: bestMatchScore,
      rankingMode: bestMatchScore === null ? 'fallback' : 'personalized',
    });
  });

  return entries.sort(compareRestaurantEntries);
}

export default rankCandidates;