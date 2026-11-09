/** Entirely synthetic demo data. All flavor traits are hand-authored fixture
 * values; they are not measurements, review-derived traits, or teammate data.
 */
const vector = (spicy, sweet, sour, salty, bitter, umami) => Object.freeze({ spicy, sweet, sour, salty, bitter, umami });

export const USER_A_TARGETS = vector(4, 1, 2, 2, 0, 4);
export const USER_B_TARGETS = vector(0, 5, 1, 1, 0, 1);
export const NEUTRAL_TARGETS = vector(0, 0, 0, 0, 0, 0);

export const MOCK_USERS = Object.freeze({
  'demo-user-a': Object.freeze({ userId: 'demo-user-a', flavorTargets: USER_A_TARGETS }),
  'demo-user-b': Object.freeze({ userId: 'demo-user-b', flavorTargets: USER_B_TARGETS }),
  'demo-user-neutral': Object.freeze({ userId: 'demo-user-neutral', flavorTargets: NEUTRAL_TARGETS }),
  'demo-user-empty': Object.freeze({ userId: 'demo-user-empty', flavorTargets: null }),
  'demo-user-invalid': Object.freeze({ userId: 'demo-user-invalid', flavorTargets: Object.freeze({ spicy: 4, sweet: '2' }) }),
});

const restaurant = (_id, name, cuisineType, rating, reviewCount, extras = {}) => Object.freeze({
  _id, name, cuisineType, rating, reviewCount, address: 'Synthetic demo address',
  priceRange: '$$', imageUrl: null, ...extras,
});

export const MOCK_RESTAURANTS = Object.freeze([
  restaurant('demo-restaurant-noodles', 'Pepper Noodle House', 'Demo noodles', 4.5, 22),
  restaurant('demo-restaurant-dessert', 'Cloud Dessert Cafe', 'Demo desserts', 4.7, 40),
  restaurant('demo-restaurant-neutral', 'Gentle Table', 'Demo cafe', null, 0),
  restaurant('demo-restaurant-missing', 'Neighborhood Kitchen', 'Demo kitchen', 4.2, 12),
  restaurant('demo-restaurant-unscored', 'Market Counter', 'Demo market', 0, 0),
]);

const dish = (dishId, restaurantId, name, flavorIntensities, averageRating, reviewCount, extra = {}) => Object.freeze({
  dishId, restaurantId, name, flavorIntensities, averageRating, reviewCount, imageUrl: null, ...extra,
});

export const MOCK_DISHES = Object.freeze([
  dish('demo-dish-noodles', 'demo-restaurant-noodles', 'Pepper Noodles', USER_A_TARGETS, 4.6, 15),
  dish('demo-dish-broth', 'demo-restaurant-noodles', 'Clear Broth', vector(1, 1, 1, 2, 0, 4), 4.8, 35),
  dish('demo-dish-cake', 'demo-restaurant-dessert', 'Berry Cloud Cake', USER_B_TARGETS, 4.8, 28),
  dish('demo-dish-pudding', 'demo-restaurant-dessert', 'Caramel Pudding', vector(0, 4, 0, 1, 1, 2), 4.3, 11),
  dish('demo-dish-neutral', 'demo-restaurant-neutral', 'Neutral Tasting Sample', NEUTRAL_TARGETS, null, 0),
  dish('demo-dish-partial', 'demo-restaurant-unscored', 'Daily Plate', Object.freeze({ spicy: 2, sweet: 1 }), null, 0),
  dish('demo-dish-invalid', 'demo-restaurant-unscored', 'Unverified Special', vector(6, 0, 0, 0, 0, 1), 3.9, 3,
    { imageUrl: 'https://example.invalid/foodmap-demo-unavailable-image.jpg' }),
]);

/** Explicit malformed fixture pool used to exercise diagnostics independently. */
export const EDGE_RESTAURANTS = Object.freeze([
  ...MOCK_RESTAURANTS, MOCK_RESTAURANTS[0], Object.freeze({ _id: '', name: 'Invalid record' }),
]);

export const EDGE_DISHES = Object.freeze([
  ...MOCK_DISHES, MOCK_DISHES[0],
  dish('demo-dish-orphan', 'nonexistent-restaurant', 'Orphan sample', USER_A_TARGETS, 5, 50),
  Object.freeze({ dishId: 'demo-malformed', restaurantId: 'demo-restaurant-noodles' }),
]);

export const MOCK_COVERAGE = Object.freeze({
  scope: 'candidate-pool', complete: true,
  note: 'Complete synthetic fixture pool, including a restaurant with explicitly no dish summaries.',
});
