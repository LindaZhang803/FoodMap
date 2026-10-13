import cuisineImageMap from "./cuisineImageMap";

// =====================================================
// 1. Cuisine Keywords
// =====================================================

const cuisineKeywords = {
  american: [
    "american",
    "burger",
    "hamburger",
    "steak",
    "steakhouse",
    "bbq",
    "barbecue",
    "grill",
    "diner",
    "southern",
    "wings",
    "hot_dog",
    "sandwich",
    "cheeseburger",
    "fried_chicken"
  ],

  chinese: [
    "chinese",
    "sichuan",
    "szechuan",
    "cantonese",
    "dim_sum",
    "hot_pot",
    "dumpling",
    "hunan",
    "taiwanese",
    "shanghai",
    "szechwan"
  ],

  italian: [
    "italian",
    "pizza",
    "pizzeria",
    "pasta",
    "spaghetti",
    "trattoria",
    "risotto",
    "lasagna",
    "neapolitan",
    "sicilian"
  ],

  japanese: [
    "japanese",
    "sushi",
    "ramen",
    "udon",
    "soba",
    "tempura",
    "yakitori",
    "izakaya",
    "teppanyaki",
    "hibachi",
    "donburi",
    "tonkatsu",
    "shabu_shabu"
  ],

  mexican: [
    "mexican",
    "taco",
    "tacos",
    "taqueria",
    "burrito",
    "enchilada",
    "quesadilla",
    "torta",
    "tamales",
    "carnitas",
    "birria",
    "al_pastor"
  ]
};

// =====================================================
// 2. Normalize Cuisine Type
// =====================================================

function normalizeCuisine(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
}

// =====================================================
// 3. Detect Cuisine
// =====================================================

function detectCuisine(cuisineType) {

  const normalized = normalizeCuisine(cuisineType);

  if (!normalized || normalized === "unknown") {
    return null;
  }

  // OSM can contain multiple cuisines:
  // "italian;pizza" or "japanese;sushi"

  const cuisines = normalized
    .split(/[;,|]/)
    .map(value => value.trim())
    .filter(Boolean);

  // Match exact keywords
  for (const cuisine of cuisines) {

    for (const [type, keywords] of Object.entries(cuisineKeywords)) {

      if (keywords.includes(cuisine)) {
        return type;
      }

    }

  }

  return null;
}

// =====================================================
// 4. Stable Image Selection
// =====================================================

function getStableIndex(restaurant, count) {

  const identifier = String(
    restaurant.osmId ||
    restaurant._id ||
    restaurant.id ||
    restaurant.name ||
    ""
  );

  let hash = 0;

  for (let i = 0; i < identifier.length; i++) {
    hash = (hash * 31 + identifier.charCodeAt(i)) | 0;
  }

  return (hash >>> 0) % count;
}

// =====================================================
// 5. Get Restaurant Image
// =====================================================

export default function getRestaurantImage(restaurant) {

  // Priority 1: Real restaurant image
  if (
      typeof restaurant.imageUrl === "string" &&
      restaurant.imageUrl.trim() !== ""
  ) {
      const imageUrl = restaurant.imageUrl.trim();

      const API_ORIGIN = "http://10.13.168.63:3000";

      const fullUrl = /^https?:\/\//i.test(imageUrl)
          ? imageUrl
          : `${API_ORIGIN}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;

      return {
          uri: fullUrl
      };
  }

  // Priority 2: Cuisine image
  const cuisine = detectCuisine(restaurant.cuisineType);

  // Priority 3: Default image
  if (!cuisine || !cuisineImageMap[cuisine]) {
    return cuisineImageMap.default;
  }

  const images = cuisineImageMap[cuisine];

  const index = getStableIndex(
    restaurant,
    images.length
  );

  return images[index];
}