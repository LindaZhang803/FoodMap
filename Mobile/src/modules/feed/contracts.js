/**
 * Numeric values are measured/entered intensities: 0 neutral, 5 maximum.
 * All six values must be finite numbers in [0, 5]. Extra keys invalidate a
 * vector; missing/null, strings, NaN, and infinity are never coerced or filled.
 * An empty profile is null or an empty object. A partial profile is unavailable.
 * Dish traits must be assigned explicitly by the food-data owner; this module
 * never infers them from a cuisine, name, photograph, or review.
 *
 * @typedef {{spicy:number,sweet:number,sour:number,salty:number,bitter:number,umami:number}} FlavorVector
 * @typedef {{dishId:string,restaurantId:string,name:string,imageUrl?:?string,averageRating?:?number,reviewCount?:number,flavorIntensities?:?FlavorVector}} DishSummary
 * @typedef {{restaurantId:string,restaurant:Object,dishes:DishSummary[]}} FeedCandidate
 * @typedef {{scope:'candidate-pool',complete:boolean,note?:string}} DishCoverage
 * @typedef {{getRestaurants:()=>Promise<Object[]>}} RestaurantSource
 * @typedef {{getDishes:()=>Promise<{dishes:DishSummary[],coverage:DishCoverage}>}} DishSource
 * @typedef {{getPreferences:(input:{userId:string})=>Promise<{userId:string,flavorTargets:?FlavorVector}>}} AccountSource
 * @typedef {{status:'signed-out'|'empty'|'ready'|'unavailable',userId:?string,flavorTargets:?FlavorVector,error:?Error}} PreferenceSnapshot
 * @typedef {{key:string,restaurantId:string,restaurant:Object,recommendedDish:?DishSummary,preferenceScore:?number,rankingMode:'personalized'|'fallback'}} RankedRestaurantEntry
 *
 * RestaurantSource accepts Member 1's bare array only. Its original restaurant
 * objects (including _id, metadata, images/licenses) are retained by reference.
 * DishSource must explicitly describe coverage of the loaded candidate pool;
 * complete:false is usable but never implies global/complete recommendations.
 * Restaurant/dish IDs are separate nonempty strings. Invalid records and orphan
 * dishes are skipped with diagnostics; duplicate IDs keep the first record.
 * A valid dish identity with invalid traits remains available as a fallback dish.
 * Catalog failure rejects; dish failure returns restaurants with empty dishes
 * and an error for retry. The hook, not this contract, owns loading/race state.
 */

export const FLAVOR_DIMENSIONS = Object.freeze([
  'spicy', 'sweet', 'sour', 'salty', 'bitter', 'umami',
]);

export function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isStableId(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Preserve accepted objects without rewriting display data. Reject malformed
 * optional values before the shared card or native image receives them. */
export function hasValidDisplayFields(record, ratingKey, textKeys) {
  return textKeys.every((key) => record[key] === undefined || record[key] === null || typeof record[key] === 'string') &&
    (record[ratingKey] === undefined || record[ratingKey] === null ||
      (typeof record[ratingKey] === 'number' && Number.isFinite(record[ratingKey]) && record[ratingKey] >= 0 && record[ratingKey] <= 5)) &&
    (record.reviewCount === undefined || (Number.isInteger(record.reviewCount) && record.reviewCount >= 0));
}

export function isValidFlavorVector(vector) {
  if (!isRecord(vector)) return false;
  const keys = Object.keys(vector);
  return keys.length === FLAVOR_DIMENSIONS.length &&
    FLAVOR_DIMENSIONS.every((dimension) =>
      Object.prototype.hasOwnProperty.call(vector, dimension) &&
      typeof vector[dimension] === 'number' &&
      Number.isFinite(vector[dimension]) &&
      vector[dimension] >= 0 && vector[dimension] <= 5);
}

export function asError(value, fallback = 'Source unavailable') {
  return value instanceof Error ? value : new Error(typeof value === 'string' ? value : fallback);
}