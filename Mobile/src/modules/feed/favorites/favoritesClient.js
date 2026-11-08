import { hasValidDisplayFields, isStableId } from '../contracts';

const OBJECT_ID = /^[0-9a-f]{24}$/i;
const TYPES = ['restaurant', 'dish'];

export function favoriteKey(targetType, targetId) {
  if (!TYPES.includes(targetType) || typeof targetId !== 'string' || !OBJECT_ID.test(targetId)) {
    throw new TypeError('A saved item needs a restaurant or dish type and a catalog ID.');
  }
  return `${targetType}:${targetId.toLowerCase()}`;
}

function imageUrl(value, origin) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim(), origin);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

/** Validate the server envelope before it reaches private state or navigation. */
export function normalizeFavorite(item, origin, expectedKey) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new TypeError('Invalid saved item response.');
  }
  const key = favoriteKey(item.targetType, item.targetId);
  if (expectedKey && key !== expectedKey) throw new TypeError('Saved item identity did not match the request.');
  if (typeof item.createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(item.createdAt) || !Number.isFinite(Date.parse(item.createdAt))) {
    throw new TypeError('Invalid saved item date.');
  }
  let target = item.target;
  if (target !== null) {
    if (!target || typeof target !== 'object' || Array.isArray(target)) {
      throw new TypeError('Invalid saved item target.');
    }
    const id = item.targetType === 'restaurant' ? target._id : target.dishId;
    if (favoriteKey(item.targetType, id) !== key) throw new TypeError('Saved target identity did not match its envelope.');
    // If the owner includes an additional ID, it must name the same catalog item.
    for (const extra of ['id', '_id']) {
      if (target[extra] != null && favoriteKey(item.targetType, target[extra]) !== key) {
        throw new TypeError('Saved target has conflicting identities.');
      }
    }
    if (item.targetType === 'dish') favoriteKey('restaurant', target.restaurantId);
    const ratingKey = item.targetType === 'restaurant' ? 'rating' : 'averageRating';
    const textKeys = item.targetType === 'restaurant' ? ['address', 'cuisineType', 'priceRange'] : [];
    if (!isStableId(target.name) || !hasValidDisplayFields(target, ratingKey, textKeys)) {
      throw new TypeError('Invalid saved target display fields.');
    }
    target = { ...target, imageUrl: imageUrl(target.imageUrl, origin) };
  }
  return { targetType: item.targetType, targetId: item.targetId.toLowerCase(), createdAt: item.createdAt, target };
}

/** Only the current Bearer token crosses this private boundary; never a user ID. */
export function createFavoritesClient({ origin, fetchImpl = globalThis.fetch }) {
  let base;
  try {
    const parsed = new URL(origin);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error();
    base = parsed.origin;
  } catch {
    throw new TypeError('Favorites needs the shared HTTP(S) API origin.');
  }
  if (typeof fetchImpl !== 'function') throw new TypeError('Favorites needs an HTTP client.');

  async function request(method, { token, signal, targetType, targetId }) {
    if (typeof token !== 'string' || !token.trim()) throw new TypeError('A current session token is required.');
    const key = method === 'GET' ? null : favoriteKey(targetType, targetId);
    const path = key ? `/${targetType}/${targetId.toLowerCase()}` : '';
    const response = await fetchImpl(`${base}/api/favorites${path}`, {
      method, headers: { Authorization: `Bearer ${token}` }, signal,
    });
    const expectedStatus = method === 'DELETE' ? 204 : 200;
    if (response.status !== expectedStatus) {
      const error = new Error(response.status === 401 ? 'Your session has expired.' : 'Could not update Want to Try. Please retry.');
      error.status = response.status;
      throw error;
    }
    // A successful removal deliberately has no JSON body.
    if (method === 'DELETE') return undefined;
    const payload = await response.json();
    if (method !== 'GET') return normalizeFavorite(payload, base, key);
    if (!payload || !Array.isArray(payload.items)) throw new TypeError('Invalid saved list response.');
    const seen = new Set();
    return payload.items.map(item => {
      const normalized = normalizeFavorite(item, base);
      const itemKey = favoriteKey(normalized.targetType, normalized.targetId);
      if (seen.has(itemKey)) throw new TypeError('Duplicate item in saved list response.');
      seen.add(itemKey);
      return normalized;
    });
  }

  return {
    list: options => request('GET', options),
    save: options => request('PUT', options),
    remove: options => request('DELETE', options),
  };
}
