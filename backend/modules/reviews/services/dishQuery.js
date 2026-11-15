const MENU_CATEGORIES = Object.freeze(['main', 'appetizer', 'side', 'drink', 'dessert', 'other']);
const orders = {
  name: { name: 1, _id: 1 },
  highestRated: { averageRating: -1, reviewCount: -1, _id: 1 },
  mostReviewed: { reviewCount: -1, averageRating: -1, _id: 1 },
  lowestPrice: { price: 1, _id: 1 }
};
function parseDishQuery(query) {
  const fail = message => { const error = new Error(message); error.status = 400; throw error; };
  const filter = {};
  if (query.restaurantId !== undefined) {
    if (typeof query.restaurantId !== 'string' || !/^[a-f0-9]{24}$/i.test(query.restaurantId)) fail('Invalid restaurantId');
    filter.restaurantId = query.restaurantId;
  }
  if (query.q !== undefined) {
    if (typeof query.q !== 'string' || query.q.length > 120) fail('Search must be a string of up to 120 characters');
    const keyword = query.q.trim();
    if (keyword) filter.name = { $regex: keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  }
  if (query.category !== undefined) {
    if (!MENU_CATEGORIES.includes(query.category)) fail('Invalid menu category');
    // Older records without a category belong to Other.
    if (query.category === 'other') filter.$or = [{ category: 'other' }, { category: null }];
    else filter.category = query.category;
  }
  const numeric = (name, max) => {
    if (query[name] === undefined) return undefined;
    const value = query[name];
    if (typeof value !== 'string' || !/^\d+(\.\d+)?$/.test(value) || !Number.isFinite(Number(value)) || Number(value) > max) fail('Invalid ' + name);
    return Number(value);
  };
  const minPrice = numeric('minPrice', Number.MAX_SAFE_INTEGER);
  const maxPrice = numeric('maxPrice', Number.MAX_SAFE_INTEGER);
  const minRating = numeric('minRating', 5);
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) fail('Minimum price exceeds maximum price');
  if (minPrice !== undefined || maxPrice !== undefined) filter.price = { $ne: null, ...(minPrice !== undefined ? { $gte: minPrice } : {}), ...(maxPrice !== undefined ? { $lte: maxPrice } : {}) };
  if (minRating !== undefined) { filter.averageRating = { $gte: minRating }; filter.reviewCount = { $gt: 0 }; }
  const sort = query.sort === undefined ? 'name' : query.sort;
  if (typeof sort !== 'string' || !Object.hasOwn(orders, sort)) fail('Invalid dish sort');
  // Unknown prices must not appear as cheaper than real menu prices.
  if (sort === 'lowestPrice') filter.price = { ...filter.price, $ne: null };
  return { filter, order: orders[sort] };
}
module.exports = { MENU_CATEGORIES, parseDishQuery };
