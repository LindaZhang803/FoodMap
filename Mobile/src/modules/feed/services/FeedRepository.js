import {
  asError,
  hasValidDisplayFields,
  isRecord,
  isStableId,
  isValidFlavorVector,
} from '../contracts';

function validateDishPayload(payload) {
  if (
    !isRecord(payload) ||
    !Array.isArray(payload.dishes) ||
    !isRecord(payload.coverage) ||
    payload.coverage.scope !== 'candidate-pool' ||
    typeof payload.coverage.complete !== 'boolean' ||
    (payload.coverage.note !== undefined &&
      typeof payload.coverage.note !== 'string')
  ) {
    throw new TypeError(
      'Dish source must return {dishes, coverage:{scope:"candidate-pool", complete:boolean}}.'
    );
  }

  return payload;
}

/** Adapt Member 1's existing catalog reader without inventing an endpoint. */
export function createRestaurantSource(getRestaurants) {
  if (typeof getRestaurants !== 'function') {
    throw new TypeError('A catalog reader function is required.');
  }

  return { getRestaurants: () => getRestaurants() };
}

export class FeedRepository {
  constructor({ restaurantSource, dishSource } = {}) {
    if (
      !restaurantSource ||
      typeof restaurantSource.getRestaurants !== 'function'
    ) {
      throw new TypeError(
        'A restaurantSource.getRestaurants function is required.'
      );
    }

    this.restaurantSource = restaurantSource;
    this.dishSource = dishSource;
  }

  async getCandidates() {
    const [restaurantResult, dishResult] = await Promise.allSettled([
      Promise.resolve().then(() => this.restaurantSource.getRestaurants()),
      Promise.resolve()
        .then(() => {
          if (
            !this.dishSource ||
            typeof this.dishSource.getDishes !== 'function'
          ) {
            throw new Error('Dish traits source is not connected.');
          }

          return this.dishSource.getDishes();
        })
        .then(validateDishPayload),
    ]);

    if (restaurantResult.status === 'rejected') {
      throw asError(restaurantResult.reason, 'Restaurants unavailable.');
    }

    if (!Array.isArray(restaurantResult.value)) {
      throw new TypeError('Restaurant source must return a bare array.');
    }

    const diagnostics = [];
    const candidateMap = new Map();

    restaurantResult.value.forEach((restaurant, index) => {
      if (
        !isRecord(restaurant) ||
        !isStableId(restaurant._id) ||
        !isStableId(restaurant.name) ||
        !hasValidDisplayFields(restaurant, 'rating', [
          'imageUrl',
          'address',
          'cuisineType',
          'priceRange',
        ])
      ) {
        diagnostics.push({ code: 'invalid-restaurant', index });
      } else if (candidateMap.has(restaurant._id)) {
        diagnostics.push({
          code: 'duplicate-restaurant',
          restaurantId: restaurant._id,
        });
      } else {
        candidateMap.set(restaurant._id, {
          restaurantId: restaurant._id,
          restaurant,
          dishes: [],
        });
      }
    });

    if (dishResult.status === 'rejected') {
      return {
        candidates: [...candidateMap.values()],
        dishError: asError(dishResult.reason, 'Dishes unavailable.'),
        coverage: null,
        diagnostics: [...diagnostics, { code: 'dish-source-unavailable' }],
      };
    }

    const { dishes, coverage } = dishResult.value;

    if (!coverage.complete) {
      diagnostics.push({ code: 'incomplete-dish-coverage' });
    }

    const dishIds = new Set();

    dishes.forEach((dish, index) => {
      if (
        !isRecord(dish) ||
        !isStableId(dish.dishId) ||
        !isStableId(dish.restaurantId) ||
        !isStableId(dish.name) ||
        !hasValidDisplayFields(dish, 'averageRating', ['imageUrl'])
      ) {
        diagnostics.push({ code: 'invalid-dish', index });
        return;
      }

      if (dishIds.has(dish.dishId)) {
        diagnostics.push({ code: 'duplicate-dish', dishId: dish.dishId });
        return;
      }

      dishIds.add(dish.dishId);

      const candidate = candidateMap.get(dish.restaurantId);

      if (!candidate) {
        diagnostics.push({ code: 'orphan-dish', dishId: dish.dishId });
        return;
      }

      if (!isValidFlavorVector(dish.flavorIntensities)) {
        diagnostics.push({ code: 'unscored-dish', dishId: dish.dishId });
      }

      candidate.dishes.push(dish);
    });

    return {
      candidates: [...candidateMap.values()],
      dishError: null,
      coverage: { ...coverage },
      diagnostics,
    };
  }
}

export default FeedRepository;