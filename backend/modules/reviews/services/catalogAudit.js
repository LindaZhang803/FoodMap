const { MENU_CATEGORIES } = require('./dishQuery');
const normalize = value => typeof value === 'string' ? value.trim().toLowerCase().replace(/\s+/g, ' ') : '';
const finite = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
function auditCatalog(restaurants, dishes) {
  const issues = [];
  const add = (kind, record, field, reason) => issues.push({ kind, id: String(record._id), field, reason });
  const ids = new Set(restaurants.map(r => String(r._id)));
  const seenRestaurants = new Map(), seenDishes = new Map();
  const cuisines = new Map();
  function duplicate(map, key, kind, record) {
    if (map.has(key)) add(kind, record, 'duplicate', 'Possible duplicate of ' + map.get(key) + '; manual review required');
    else map.set(key, String(record._id));
  }
  function image(kind, record) {
    if (!record.imageUrl) return add(kind, record, 'imageUrl', 'Missing image; use placeholder');
    try {
      const url = new URL(record.imageUrl, 'https://foodmap.invalid');
      if (!['http:', 'https:'].includes(url.protocol) || !(record.imageUrl.startsWith('/') || /^https?:\/\//i.test(record.imageUrl))) throw new Error();
    } catch { add(kind, record, 'imageUrl', 'Invalid image URL'); }
  }
  for (const r of restaurants) {
    if (!normalize(r.name)) add('restaurant', r, 'name', 'Missing name');
    const coordinatesValid = finite(r.latitude, -90, 90) && finite(r.longitude, -180, 180);
    if (!coordinatesValid) add('restaurant', r, 'location', 'Invalid coordinates');
    if (!normalize(r.address)) add('restaurant', r, 'address', 'Missing address');
    if (r.rating != null && !finite(r.rating, 0, 5)) add('restaurant', r, 'rating', 'Rating outside 0–5');
    const cuisine = normalize(r.cuisineType);
    if (!cuisine || cuisine === 'unknown') add('restaurant', r, 'cuisineType', 'Missing cuisine');
    else {
      if (!cuisines.has(cuisine)) cuisines.set(cuisine, new Set());
      cuisines.get(cuisine).add(r.cuisineType);
    }
    // Name alone is insufficient: chains can have several legitimate locations.
    if (normalize(r.name) && coordinatesValid) duplicate(seenRestaurants, [normalize(r.name), r.latitude.toFixed(5), r.longitude.toFixed(5)].join('|'), 'restaurant', r);
    image('restaurant', r);
  }
  for (const d of dishes) {
    if (!ids.has(String(d.restaurantId))) add('dish', d, 'restaurantId', 'Restaurant does not exist');
    if (!normalize(d.name)) add('dish', d, 'name', 'Missing name');
    else duplicate(seenDishes, String(d.restaurantId) + '|' + normalize(d.name), 'dish', d);
    if (!normalize(d.description)) add('dish', d, 'description', 'Missing description');
    if (!MENU_CATEGORIES.includes(d.category)) add('dish', d, 'category', 'Missing or unsupported category');
    if (d.price == null) add('dish', d, 'price', 'Price unknown; do not display as free');
    else if (!finite(d.price, 0, Number.MAX_SAFE_INTEGER)) add('dish', d, 'price', 'Invalid price');
    if (d.averageRating != null && !finite(d.averageRating, 1, 5)) add('dish', d, 'averageRating', 'Rating outside 1–5');
    image('dish', d);
  }
  return {
    readOnly: true,
    totals: { restaurants: restaurants.length, dishes: dishes.length },
    cuisineVariants: [...cuisines].filter(([, values]) => values.size > 1).map(([normalized, values]) => ({ normalized, values: [...values] })),
    issues
  };
}
module.exports = { auditCatalog };
