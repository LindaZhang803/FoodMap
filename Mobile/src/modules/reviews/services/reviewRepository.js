function validateInput(input) {
  if (!input || !['restaurant', 'dish'].includes(input.reviewType)) throw new Error('Choose a review type.');
  if (input.reviewType === 'dish' && !input.dishId) throw new Error('Select a dish first.');
  if (input.reviewType === 'restaurant' && input.dishId != null) throw new Error('Restaurant reviews cannot include a dish.');
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) throw new Error('Select 1–5 stars.');
  if (typeof input.comment !== 'string' || !input.comment.trim() || input.comment.length > 2000) throw new Error('Enter a comment (up to 2,000 characters).');
}
function createReviewRepository({ origin = '', fetchImpl = globalThis.fetch, fixtures = null } = {}) {
  let sequence = 0;
  const matches = (review, target) => review.restaurantId === target.restaurantId && review.reviewType === target.reviewType &&
    (target.reviewType !== 'dish' || review.dishId === target.dishId);
  function stats(target) {
    const rows = fixtures.reviews.filter(r => matches(r, target));
    return { averageRating: rows.length ? rows.reduce((sum, r) => sum + r.rating, 0) / rows.length : null, reviewCount: rows.length };
  }
  async function request(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetchImpl(`${origin}${path}`, { ...options, signal: controller.signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to load reviews.');
      return body;
    } finally { clearTimeout(timeout); }
  }
  return {
    async list(target, page = 1) {
      if (fixtures) {
        const rows = fixtures.reviews.filter(r => matches(r, target)).slice().reverse();
        return { reviews: rows.slice((page - 1) * 20, page * 20), statistics: stats(target), pagination: { page, limit: 20, total: rows.length } };
      }
      const params = `restaurantId=${encodeURIComponent(target.restaurantId)}&reviewType=${target.reviewType}&page=${page}` +
        (target.dishId ? `&dishId=${encodeURIComponent(target.dishId)}` : '');
      return request(`/api/reviews?${params}`);
    },
    async create(input, token) {
      validateInput(input);
      if (!fixtures && !token) throw new Error('Sign in to post a review.');
      const payload = { restaurantId: input.restaurantId, reviewType: input.reviewType, rating: input.rating, comment: input.comment.trim(), photoUrls: [] };
      if (input.reviewType === 'dish') payload.dishId = input.dishId;
      if (fixtures) {
        const dish = input.dishId && fixtures.dishes.find(d => d.id === input.dishId);
        if (input.reviewType === 'dish' && (!dish || dish.restaurantId !== input.restaurantId)) throw new Error('Dish does not belong to this restaurant.');
        const review = { ...payload, id: `demo-review-${Date.now()}-${++sequence}`, userId: 'demo-user', createdAt: new Date().toISOString() };
        fixtures.reviews.push(review);
        const statistics = stats(input);
        if (dish) Object.assign(dish, statistics);
        return { review, statistics };
      }
      return request('/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    }
  };
}
module.exports = { createReviewRepository, validateInput };
