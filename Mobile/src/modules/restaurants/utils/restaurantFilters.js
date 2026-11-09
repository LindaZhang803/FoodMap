// =====================================================
// 1. Cuisine Types
// =====================================================

const CUISINES = [
  "american",
  "chinese",
  "italian",
  "japanese",
  "mexican",
];

// =====================================================
// 2. Estimated Price Levels
// =====================================================

// Application-defined price estimates (USD).
// These are NOT verified restaurant menu prices.

const PRICE_LEVELS = {
  "$": { min: 0, max: 10 },
  "$$": { min: 10, max: 30 },
  "$$$": { min: 30, max: 60 },
  "$$$$": { min: 60, max: Infinity },
};

// Get restaurant price range.
// Priority 1: Numeric price fields
// Priority 2: Estimated price level

function getRestaurantPriceRange(restaurant) {
  const hasNumericPrices =
    restaurant.minPrice != null &&
    restaurant.maxPrice != null &&
    restaurant.minPrice !== "" &&
    restaurant.maxPrice !== "";

  if (hasNumericPrices) {
    const min = Number(restaurant.minPrice);
    const max = Number(restaurant.maxPrice);

    if (
      Number.isFinite(min) &&
      Number.isFinite(max) &&
      min >= 0 &&
      max >= min
    ) {
      return { min, max };
    }
  }

  const level = String(
    restaurant.priceRange ?? ""
  ).trim();

  return PRICE_LEVELS[level] ?? null;
}

// =====================================================
// 3. Calculate Distance (Haversine Formula)
// =====================================================

export function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;

  const toRad = (value) =>
    (value * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const safeA = Math.min(1, Math.max(0, a));

  return (
    2 *
    R *
    Math.atan2(
      Math.sqrt(safeA),
      Math.sqrt(1 - safeA)
    )
  );
}

// =====================================================
// 4. Default Filters
// =====================================================

export const DEFAULT_FILTERS = {
  cuisine: "",
  minPrice: "",
  maxPrice: "",
  minRating: null,
  distance: null,
  customDistance: "",
};

// =====================================================
// 5. Filter Restaurants
// =====================================================

export function filterRestaurants(
  restaurants,
  searchQuery,
  filters,
  userLocation
) {
  const keyword = String(searchQuery ?? "")
    .trim()
    .toLowerCase();

  // Convert selected price inputs once
  const minText = String(
    filters.minPrice ?? ""
  ).trim();

  const maxText = String(
    filters.maxPrice ?? ""
  ).trim();

  const minPrice =
    minText === "" ? null : Number(minText);

  const maxPrice =
    maxText === "" ? null : Number(maxText);

  const hasPriceFilter =
    minPrice !== null || maxPrice !== null;

  // Convert custom distance
  const customDistanceText = String(
    filters.customDistance ?? ""
  ).trim();

  const maxDistance =
    customDistanceText !== ""
      ? Number(customDistanceText)
      : filters.distance;

  return restaurants.filter((restaurant) => {

    // =================================================
    // A. Keyword Search
    // =================================================

    const matchesSearch = [
      restaurant.name,
      restaurant.cuisineType,
      restaurant.address,
    ].some((value) =>
      String(value ?? "")
        .toLowerCase()
        .includes(keyword)
    );

    // =================================================
    // B. Cuisine Filter
    // =================================================

    const cuisine = String(
      restaurant.cuisineType ?? ""
    )
      .toLowerCase()
      .trim();

    const cuisineTokens = cuisine
      .split(/[;,|]/)
      .map((value) => value.trim())
      .filter(Boolean);

    const matchesCuisine =
      !filters.cuisine ||
      (
        filters.cuisine === "other"
          ? !cuisineTokens.some((type) =>
              CUISINES.includes(type)
            )
          : cuisineTokens.includes(filters.cuisine)
      );

    // =================================================
    // C. Price Filter
    // =================================================

    const restaurantPrice =
      getRestaurantPriceRange(restaurant);

    // Price ranges match when they overlap.
    const matchesPrice =
      !hasPriceFilter ||
      (
        restaurantPrice !== null &&
        (minPrice === null ||
          restaurantPrice.max >= minPrice) &&
        (maxPrice === null ||
          restaurantPrice.min <= maxPrice)
      );

    // =================================================
    // D. Minimum Rating
    // =================================================

    const rating = Number(restaurant.rating);

    const matchesRating =
      filters.minRating == null ||
      (
        restaurant.rating != null &&
        Number.isFinite(rating) &&
        rating >= Number(filters.minRating)
      );

    // =================================================
    // E. Distance Filter
    // =================================================

    let matchesDistance = true;

    if (maxDistance != null) {
      const lat = Number(restaurant.latitude);
      const lon = Number(restaurant.longitude);

      const validCoordinates =
        restaurant.latitude != null &&
        restaurant.longitude != null &&
        Number.isFinite(lat) &&
        Number.isFinite(lon) &&
        lat >= -90 &&
        lat <= 90 &&
        lon >= -180 &&
        lon <= 180;

      const validUserLocation =
        userLocation != null &&
        Number.isFinite(userLocation.latitude) &&
        Number.isFinite(userLocation.longitude);

      if (!validCoordinates || !validUserLocation) {
        matchesDistance = false;
      } else {
        const km = getDistanceKm(
          userLocation.latitude,
          userLocation.longitude,
          lat,
          lon
        );

        matchesDistance = km <= maxDistance;
      }
    }

    // =================================================
    // F. Combine All Filters
    // =================================================

    return (
      matchesSearch &&
      matchesCuisine &&
      matchesPrice &&
      matchesRating &&
      matchesDistance
    );
  });
}