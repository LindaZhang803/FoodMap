import { getDistanceKm } from "./restaurantFilters";

export const SORT_OPTIONS = [
  { label: "Default", value: "default" },
  { label: "Highest Rated", value: "rating" },
  { label: "Most Popular", value: "popular" },
  { label: "Nearest", value: "nearest" },
  { label: "Price: Low to High", value: "priceAsc" },
  { label: "Price: High to Low", value: "priceDesc" },
];

// FoodMap estimated price levels.
// These are not verified menu prices.
const PRICE_LEVELS = {
  "$": 0,
  "$$": 10,
  "$$$": 30,
  "$$$$": 60,
};

function getPrice(restaurant) {
  // Prefer an available numeric minimum price.
  const value = restaurant.minPrice;

  if (value != null && String(value).trim() !== "") {
    const price = Number(value);

    if (Number.isFinite(price) && price >= 0) {
      return price;
    }
  }

  const level = String(restaurant.priceRange ?? "").trim();

  return PRICE_LEVELS[level] ?? null;
}

function getDistance(restaurant, userLocation) {
  if (!userLocation) {
    return null;
  }

  const lat = Number(restaurant.latitude);
  const lon = Number(restaurant.longitude);

  if (
    restaurant.latitude == null ||
    restaurant.longitude == null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    return null;
  }

  return getDistanceKm(
    userLocation.latitude,
    userLocation.longitude,
    lat,
    lon
  );
}

// Sort descending; missing values always go last.
function compareDescending(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  return b - a;
}

// Sort ascending; missing values always go last.
function compareAscending(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  return a - b;
}

export function sortRestaurants(
  restaurants,
  sortBy,
  userLocation
) {
  // Do not change the original restaurant array.
  const result = [...restaurants];

  switch (sortBy) {
    case "rating":
      return result.sort((a, b) => {
        const ratingA =
          a.rating == null ? null : Number(a.rating);

        const ratingB =
          b.rating == null ? null : Number(b.rating);

        return compareDescending(
          Number.isFinite(ratingA) ? ratingA : null,
          Number.isFinite(ratingB) ? ratingB : null
        );
      });

    case "popular":
      return result.sort((a, b) => {
        // Review count is a proxy for popularity,
        // not an actual restaurant visit count.
        const countA =
          a.reviewCount == null ? null : Number(a.reviewCount);

        const countB =
          b.reviewCount == null ? null : Number(b.reviewCount);

        return compareDescending(
          Number.isFinite(countA) ? countA : null,
          Number.isFinite(countB) ? countB : null
        );
      });

    case "nearest":
      if (!userLocation) {
        return result;
      }

      return result.sort((a, b) =>
        compareAscending(
          getDistance(a, userLocation),
          getDistance(b, userLocation)
        )
      );

    case "priceAsc":
      return result.sort((a, b) =>
        compareAscending(getPrice(a), getPrice(b))
      );

    case "priceDesc":
      return result.sort((a, b) =>
        compareDescending(getPrice(a), getPrice(b))
      );

    default:
      return result;
  }
}