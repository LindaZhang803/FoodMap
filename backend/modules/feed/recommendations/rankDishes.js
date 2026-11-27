const { distanceKm } = require('../../restaurants/services/catalogQuery');
const { scoreForYouSpiciness } = require('./scoreForYouSpiciness');
const {
  getSpicinessCompatibility, resolveDishHeatSummary, SPICINESS_COMPATIBILITY_NOTE
} = require('../../accounts/services/spicinessCompatibility');
const normalize = v => typeof v === 'string' ? v.trim().toLowerCase() : '';
const finite = v => typeof v === 'number' && Number.isFinite(v);
function rankDishes({ dishes, restaurants, activity = [], favoriteCuisines = [], location = null, mode = 'forYou', spicinessAnswers }) {
  const parents = new Map(restaurants.map(r => [String(r._id), r]));
  const counts = new Map(activity.map(a => [String(a.dishId), a]));
  const cuisines = new Set(favoriteCuisines.map(normalize).filter(Boolean));
  const ranked = [];
  for (const dish of dishes) {
    const restaurant = parents.get(String(dish.restaurantId));
    if (!restaurant) continue;
    const a = counts.get(String(dish._id)) || {};
    const count = n => finite(n) && n > 0 ? n : 0;
    const popularity = count(a.recentReviews) * 3 + count(a.likes) + count(a.favorites) * 2;
    const rating = dish.reviewCount > 0 && finite(dish.averageRating) && dish.averageRating >= 1 && dish.averageRating <= 5 ? dish.averageRating : null;
    let distance = null;
    if (location && finite(restaurant.latitude) && finite(restaurant.longitude) && Math.abs(restaurant.latitude) <= 90 && Math.abs(restaurant.longitude) <= 180) {
      distance = distanceKm(location.latitude, location.longitude, restaurant.latitude, restaurant.longitude);
    }
    const cuisineMatch = cuisines.has(normalize(restaurant.cuisineType));
    const rawScore = mode === 'trending' ? popularity : (rating || 0) + Math.log1p(popularity) + (cuisineMatch ? 3 : 0) + (distance === null ? 0 : 2 / (1 + distance));
    const score = mode === 'forYou' && spicinessAnswers
      ? scoreForYouSpiciness(rawScore, dish.spicinessRanking, spicinessAnswers)
      : rawScore;
    const { median, sampleCount } = resolveDishHeatSummary(dish);
    const spicinessCompatibility = getSpicinessCompatibility(spicinessAnswers, median, sampleCount);
    ranked.push({
      dish: { id: String(dish._id), restaurantId: String(dish.restaurantId), name: dish.name, description: dish.description || '', imageUrl: dish.imageUrl || null, category: dish.category || 'other', price: dish.price ?? null, averageRating: rating, reviewCount: dish.reviewCount || 0 },
      restaurant: { id: String(restaurant._id), name: restaurant.name, cuisineType: restaurant.cuisineType || 'Unknown' },
      score, distanceKm: distance,
      signals: { recentReviews: count(a.recentReviews), likesOnRecentReviews: count(a.likes), favorites: count(a.favorites), cuisineMatch },
      spicinessCompatibility,
      spicinessCompatibilityNote: SPICINESS_COMPATIBILITY_NOTE
    });
  }
  return ranked.sort((a, b) => b.score - a.score || a.dish.id.localeCompare(b.dish.id));
}
module.exports = { rankDishes };
