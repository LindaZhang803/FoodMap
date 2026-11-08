// validates and cleans the restaurant, dish, account into reliable state
'use strict';

// Reference adapters for a future Mobile integration. This file mounts no route
// and does not rank, group, or select dishes; the Mobile feed already does that.
const FLAVOR_DIMENSIONS = Object.freeze([
  'spicy', 'sweet', 'sour', 'salty', 'bitter', 'umami',
]);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isId(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidFlavorVector(value) {
  if (!isRecord(value) || Object.keys(value).length !== FLAVOR_DIMENSIONS.length) {
    return false;
  }

  return FLAVOR_DIMENSIONS.every(key => (
    Object.prototype.hasOwnProperty.call(value, key)
    && typeof value[key] === 'number'
    && Number.isFinite(value[key])
    && value[key] >= 0
    && value[key] <= 5
  ));
}

function usableImageUrl(value, uploadsOrigin) {
  if (typeof value !== 'string' || value.trim() === '') return null;

  try {
    // Relative uploads need the owning server's explicitly supplied origin.
    // An unresolved or unsupported URL remains unknown and uses a placeholder.
    const url = uploadsOrigin ? new URL(value, uploadsOrigin) : new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function normalizeDishList(payload, { uploadsOrigin } = {}) {
  if (!Array.isArray(payload)) {
    throw new TypeError('Dish API must return a bare array.');
  }

  return payload.map(record => {
    if (!isRecord(record) || !isId(record.id) || !isId(record.restaurantId)) {
      throw new TypeError('Dishes require string id and restaurantId values.');
    }

    // Preserve the public owning API's display/statistics/attribution fields.
    // In particular, null ratings stay null and absent traits stay absent.
    const { id, ...dish } = record;
    return {
      ...dish,
      dishId: id,
      restaurantId: record.restaurantId,
      imageUrl: usableImageUrl(record.imageUrl, uploadsOrigin),
    };
  });
}

function describeCoverage(restaurants, complete, dishScope, coveredRestaurantIds) {
  if (typeof complete !== 'boolean') {
    throw new TypeError('Dish coverage complete must be explicitly true or false.');
  }

  if (!['all-dishes', 'candidate-pool', 'subset'].includes(dishScope)) {
    throw new TypeError('Declare the scope actually read by the dish source.');
  }

  if (complete && dishScope === 'subset') {
    throw new TypeError('A known dish subset cannot claim complete coverage.');
  }

  if (complete && dishScope === 'candidate-pool') {
    if (!Array.isArray(coveredRestaurantIds) || !coveredRestaurantIds.every(isId)) {
      throw new TypeError('A complete scoped read must identify its restaurant pool.');
    }

    const candidateIds = new Set(restaurants.map(restaurant => restaurant._id));
    const coveredIds = new Set(coveredRestaurantIds);
    if (
      ![...candidateIds].every(isId)
      || candidateIds.size !== coveredIds.size
      || ![...candidateIds].every(id => coveredIds.has(id))
    ) {
      throw new TypeError('Dish coverage must match the loaded restaurant pool.');
    }
  }

  return { scope: 'candidate-pool', complete };
}

/**
 * getRestaurants/getDishes are injected readers of the existing public APIs.
 * complete is the reader owner's assertion, never inferred from list length.
 * dishScope='all-dishes' means an unfiltered, successful read of every dish
 * (including every page if pagination is later added). For a complete scoped
 * read, coveredRestaurantIds must match this request's restaurant candidate pool.
 * A partial read uses complete:false. Never mark a failed read complete.
 *
 * To supply FeedRepository, return restaurants from getRestaurants and return
 * dishPayload from getDishes, throwing dishError when present. Coordinate one
 * load result per refresh so both readers refer to the same candidate pool.
 */
async function loadDiscoverSources({
  getRestaurants,
  getDishes,
  complete,
  dishScope,
  coveredRestaurantIds,
  uploadsOrigin,
}) {
  const [restaurantRead, dishRead] = await Promise.allSettled([
    Promise.resolve().then(() => getRestaurants()),
    Promise.resolve().then(() => getDishes()),
  ]);

  if (restaurantRead.status === 'rejected') throw restaurantRead.reason;
  if (!Array.isArray(restaurantRead.value)) {
    throw new TypeError('Restaurant API must return a bare array.');
  }

  // Keep the original restaurant objects, including all card metadata.
  const restaurants = restaurantRead.value;
  try {
    if (dishRead.status === 'rejected') throw dishRead.reason;
    const coverage = describeCoverage(
      restaurants, complete, dishScope, coveredRestaurantIds,
    );
    const dishes = normalizeDishList(dishRead.value, { uploadsOrigin });
    return { restaurants, dishPayload: { dishes, coverage }, dishError: null };
  } catch (error) {
    return {
      restaurants,
      dishPayload: null,
      dishError: error instanceof Error ? error : new Error('Dish source unavailable.'),
    };
  }
}

/**
 * getPreferences must call the authenticated self-read, never a user-ID query.
 * userId is the current session identity used to verify the response locally.
 * Existing string foodPreferences cannot supply this numeric contract.
 */
async function loadPreferenceSnapshot({ userId, getPreferences }) {
  if (userId === null || userId === undefined) {
    return { status: 'signed-out', userId: null, flavorTargets: null, error: null };
  }

  try {
    if (!isId(userId) || typeof getPreferences !== 'function') {
      throw new TypeError('A session identity and numeric self-read are required.');
    }
    const profile = await getPreferences();
    if (!isRecord(profile) || profile.userId !== userId) {
      throw new TypeError('Preference identity must match the current session.');
    }
    if (profile.flavorTargets === null) {
      return { status: 'empty', userId, flavorTargets: null, error: null };
    }
    if (!isValidFlavorVector(profile.flavorTargets)) {
      throw new TypeError('Preferences require exactly six numeric intensities from 0 to 5.');
    }
    return {
      status: 'ready', userId, flavorTargets: { ...profile.flavorTargets }, error: null,
    };
  } catch (error) {
    return {
      status: 'unavailable', userId, flavorTargets: null,
      error: error instanceof Error ? error : new Error('Preference source unavailable.'),
    };
  }
}

module.exports = {
  FLAVOR_DIMENSIONS,
  isValidFlavorVector,
  normalizeDishList,
  loadDiscoverSources,
  loadPreferenceSnapshot,
};