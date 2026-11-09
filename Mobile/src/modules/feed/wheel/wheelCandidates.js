export const EMPTY_FILTERS = Object.freeze({
  cuisine: '', minPrice: '', maxPrice: '', minRating: null,
  distance: null, customDistance: '',
});

export function uniqueChoices(choices) {
  const ids = new Set();
  return choices.filter(choice => {
    if (!choice || typeof choice.id !== 'string' || !choice.id || ids.has(choice.id)) return false;
    ids.add(choice.id);
    return true;
  });
}

export function restaurantChoice(restaurant, isPrivate = false) {
  return restaurant && { id: restaurant._id, label: restaurant.name, record: restaurant, private: isPrivate };
}

export function dishChoice(dish, restaurants, isPrivate = false) {
  return dish && { id: dish.dishId, label: dish.name, restaurantId: dish.restaurantId,
    record: dish, parentRestaurant: restaurants.find(item => item._id === dish.restaurantId), private: isPrivate };
}

/** Delegates restaurant price overlap and kilometer semantics to Member 1. */
export function filterWheelCandidates({ mode, restaurants, dishes, searchQuery, filters,
  filterRestaurants, userLocation }) {
  if (typeof filterRestaurants !== 'function') return { choices: [], error: 'Filtering is unavailable.' };
  const min = String(filters.minPrice ?? '').trim();
  const max = String(filters.maxPrice ?? '').trim();
  const distance = String(filters.customDistance ?? '').trim();
  const rating = filters.minRating;
  if ([min, max].some(value => value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0))
    || (min !== '' && max !== '' && Number(min) > Number(max))) {
    return { choices: [], error: 'Enter a valid price range.' };
  }
  if (rating != null && (!Number.isFinite(Number(rating)) || Number(rating) < 0 || Number(rating) > 5)) {
    return { choices: [], error: 'Minimum rating must be between 0 and 5.' };
  }
  const distanceRequested = distance !== '' || filters.distance != null;
  const kilometers = distance !== '' ? Number(distance) : filters.distance;
  if (distanceRequested && (!Number.isFinite(kilometers) || kilometers < 0)) {
    return { choices: [], error: 'Enter a valid distance in kilometers.' };
  }
  const validLocation = userLocation && Number.isFinite(userLocation.latitude)
    && Math.abs(userLocation.latitude) <= 90 && Number.isFinite(userLocation.longitude)
    && Math.abs(userLocation.longitude) <= 180;
  if (distanceRequested && !validLocation) {
    return { choices: [], needsLocation: true, error: 'Location is needed for the distance filter.' };
  }
  try {
    const parents = filterRestaurants(restaurants, mode === 'restaurant' ? searchQuery : '',
      mode === 'dish' ? { ...filters, minRating: null } : filters,
      distanceRequested ? userLocation : null);
    if (!Array.isArray(parents)) throw new Error('Invalid filter response');
    if (mode === 'restaurant') return { choices: uniqueChoices(parents.map(item => restaurantChoice(item))) };
    const parentIds = new Set(parents.map(item => item._id));
    const keyword = String(searchQuery ?? '').trim().toLowerCase();
    return { choices: uniqueChoices(dishes.filter(dish => parentIds.has(dish.restaurantId)
      && String(dish.name ?? '').toLowerCase().includes(keyword)
      && (rating == null || (typeof dish.averageRating === 'number' && Number.isFinite(dish.averageRating)
        && dish.reviewCount > 0 && dish.averageRating >= Number(rating))))
      .map(item => dishChoice(item, restaurants))) };
  } catch {
    return { choices: [], error: 'Filtering is unavailable. Try again later.' };
  }
}
