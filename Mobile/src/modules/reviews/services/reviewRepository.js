function validateInput(input) {
  if (!input || !['restaurant', 'dish'].includes(input.reviewType)) throw new Error('Choose a review type.');
  if (input.reviewType === 'dish' && !input.dishId) throw new Error('Select a dish first.');
  if (input.reviewType === 'restaurant' && input.dishId != null) throw new Error('Restaurant reviews cannot include a dish.');
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) throw new Error('Select 1–5 stars.');
  if (typeof input.comment !== 'string' || !input.comment.trim() || input.comment.length > 2000) throw new Error('Enter a comment (up to 2,000 characters).');
}
function createReviewRepository({ origin = '', fetchImpl = globalThis.fetch, fixtures = null, fileFromAsset = asset => { const { File } = require('expo-file-system'); return new File(asset.uri); } } = {}) {
  let sequence = 0;
  const matches = (review, target) => review.restaurantId === target.restaurantId && review.reviewType === target.reviewType &&
    (target.reviewType !== 'dish' || review.dishId === target.dishId);
  const demoUser = 'demo-user';
  const decorate = ({ userId, _likes, ...review }) => ({ ...review, isOwner: userId === demoUser, likeCount: (_likes || []).length, likedByMe: (_likes || []).includes(demoUser) });
  const requireToken = token => { if (!fixtures && !token) throw new Error('Sign in to manage reviews.'); };
  const headers = token => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) });
  function findOwned(id) {
    const review = fixtures.reviews.find(r => r.id === id);
    if (!review) throw new Error('Review not found.');
    if (review.userId !== demoUser) throw new Error('You can only change your own reviews.');
    return review;
  }
  function refreshStats(target) {
    const statistics = stats(target);
    const dish = target.reviewType === 'dish' && fixtures.dishes.find(d => d.id === target.dishId);
    if (dish) Object.assign(dish, statistics);
    return statistics;
  }
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
    async list(target, page = 1, sort = 'mostRecent', token) {
      if (!['mostRecent', 'mostLiked'].includes(sort)) throw new Error('Invalid review sort.');
      if (fixtures) {
        const rows = fixtures.reviews.filter(r => matches(r, target)).slice().sort((a, b) => {
          const likes = sort === 'mostLiked' ? (b._likes || []).length - (a._likes || []).length : 0;
          return likes || String(b.createdAt).localeCompare(String(a.createdAt)) || b.id.localeCompare(a.id);
        });
        return { reviews: rows.slice((page - 1) * 20, page * 20).map(decorate), statistics: stats(target), pagination: { page, limit: 20, total: rows.length } };
      }
      const params = `restaurantId=${encodeURIComponent(target.restaurantId)}&reviewType=${target.reviewType}&page=${page}&sort=${sort}` +
        (target.dishId ? `&dishId=${encodeURIComponent(target.dishId)}` : '');
      return request(`/api/reviews?${params}`, { headers: headers(token) });
    },
    async create(input, token) {
      validateInput(input);
      if (!fixtures && !token) throw new Error('Sign in to post a review.');
      const payload = { restaurantId: input.restaurantId, reviewType: input.reviewType, rating: input.rating, comment: input.comment.trim(), photoUrls: input.photoUrls ?? [] };
      if (input.reviewType === 'dish') payload.dishId = input.dishId;
      if (fixtures) {
        const dish = input.dishId && fixtures.dishes.find(d => d.id === input.dishId);
        if (input.reviewType === 'dish' && (!dish || dish.restaurantId !== input.restaurantId)) throw new Error('Dish does not belong to this restaurant.');
        const review = { ...payload, id: `demo-review-${Date.now()}-${++sequence}`, userId: demoUser, createdAt: new Date().toISOString() };
        fixtures.reviews.push(review);
        return { review: decorate(review), statistics: refreshStats(input) };
      }
      return request('/api/reviews', { method: 'POST', headers: headers(token), body: JSON.stringify(payload) });
    },
    async edit(id, input, token) {
      requireToken(token);
      if (Object.keys(input).some(key => !['rating', 'comment', 'photoUrls'].includes(key))) throw new Error('Only rating, comment and photos can be edited.');
      if (fixtures) {
        const review = findOwned(id);
        const next = { ...review, ...input };
        validateInput(next);
        Object.assign(review, { rating: next.rating, comment: next.comment.trim(), photoUrls: next.photoUrls, updatedAt: new Date().toISOString() });
        return { review: decorate(review), statistics: refreshStats(review) };
      }
      return request(`/api/reviews/${encodeURIComponent(id)}`, { method: 'PUT', headers: headers(token), body: JSON.stringify(input) });
    },
    async remove(id, token) {
      requireToken(token);
      if (fixtures) {
        const review = findOwned(id);
        fixtures.reviews.splice(fixtures.reviews.indexOf(review), 1);
        return { statistics: refreshStats(review) };
      }
      return request(`/api/reviews/${encodeURIComponent(id)}`, { method: 'DELETE', headers: headers(token) });
    },
    async like(id, enabled, token) {
      requireToken(token);
      if (fixtures) {
        const review = fixtures.reviews.find(r => r.id === id);
        if (!review) throw new Error('Review not found.');
        const users = new Set(review._likes || []);
        if (enabled) users.add(demoUser); else users.delete(demoUser);
        review._likes = [...users];
        return { likeCount: users.size, likedByMe: users.has(demoUser) };
      }
      return request(`/api/reviews/${encodeURIComponent(id)}/like`, { method: enabled ? 'POST' : 'DELETE', headers: headers(token) });
    },
    async uploadPhoto(asset, token) {
      requireToken(token);
      if (fixtures) return { photoUrl: asset.uri };
      const form = new FormData();
      // Expo SDK 57 fetch accepts Blob/File parts, not legacy {uri,name,type} objects.
      form.append('photo', fileFromAsset(asset), asset.fileName || 'review.jpg');
      return request('/api/review-photos', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    },
    async mine(token, page = 1) {
      requireToken(token);
      if (fixtures) {
        const rows = fixtures.reviews.filter(r => r.userId === demoUser).slice().reverse();
        return { reviews: rows.slice((page - 1) * 20, page * 20).map(decorate), pagination: { page, limit: 20, total: rows.length } };
      }
      return request(`/api/reviews/mine?page=${page}`, { headers: headers(token) });
    }
  };
}
module.exports = { createReviewRepository, validateInput };
