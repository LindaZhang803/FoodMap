// Inject fetch and fixtures so the same contract can be checked without Expo.
function createDishRepository({ origin = '', fetchImpl = globalThis.fetch, fixtures = null } = {}) {
  async function request(path) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetchImpl(`${origin}${path}`, { signal: controller.signal });
      if (!response.ok) throw new Error(response.status === 404 ? 'Dish not found' : 'Unable to load dishes. Please retry.');
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }
  const validDish = dish => dish && typeof dish.id === 'string' &&
    typeof dish.name === 'string' && typeof dish.restaurantId === 'string' &&
    (dish.averageRating === null || (typeof dish.averageRating === 'number' && Number.isFinite(dish.averageRating) && dish.averageRating >= 1 && dish.averageRating <= 5)) &&
    Number.isInteger(dish.reviewCount) && dish.reviewCount >= 0 &&
    (dish.imageUrl == null || typeof dish.imageUrl === 'string');
  return {
    async getDishes(restaurantId) {
      if (fixtures) return fixtures.dishes.filter(d => !restaurantId || d.restaurantId === restaurantId).map(d => ({ ...d }));
      const data = await request(`/api/dishes${restaurantId ? `?restaurantId=${encodeURIComponent(restaurantId)}` : ''}`);
      if (!Array.isArray(data) || !data.every(validDish)) throw new Error('Invalid dish list response');
      return data;
    },
    async getDish(id) {
      if (fixtures) {
        const dish = fixtures.dishes.find(d => d.id === id);
        if (!dish) throw new Error('Dish not found');
        return { ...dish, reviews: fixtures.reviews.filter(r => r.reviewType === 'dish' && r.dishId === id).map(r => ({ ...r })) };
      }
      const data = await request(`/api/dishes/${encodeURIComponent(id)}`);
      if (!validDish(data) || !Array.isArray(data.reviews) || data.reviews.some(review => !review || typeof review.id !== 'string' || typeof review.comment !== 'string' || !Number.isInteger(review.rating) || review.rating < 1 || review.rating > 5)) throw new Error('Invalid dish response');
      return data;
    }
  };
}
module.exports = { createDishRepository };
