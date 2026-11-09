//

const RESTAURANT_FIELDS = [
  'name', 'description', 'address', 'latitude', 'longitude', 'cuisineType',
  'priceRange', 'rating', 'reviewCount', 'imageUrl', 'imageSource', 'imageAuthor',
  'imageLicense', 'imageLicenseUrl', 'openingHours', 'minPrice', 'maxPrice',
  'priceCurrency', 'priceSource', 'priceSourceUrl', 'priceLastChecked',
];
const DISH_FIELDS = ['name', 'description', 'imageUrl', 'averageRating', 'reviewCount'];

class FavoriteInputError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function isObjectIdString(value) {
  return typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value);
}

function validateKey(userId, targetType, targetId) {
  if (!isObjectIdString(userId)) {
    throw new FavoriteInputError(401, 'Authentication required');
  }
  if (targetType !== 'restaurant' && targetType !== 'dish') {
    throw new FavoriteInputError(400, 'Invalid favorite target type');
  }
  if (!isObjectIdString(targetId)) {
    throw new FavoriteInputError(400, 'Invalid favorite target ID');
  }
  return { userId: userId.toLowerCase(), targetType, targetId: targetId.toLowerCase() };
}

function summarizeTarget(type, target) {
  if (!target) return null;
  const summary = type === 'restaurant'
    ? { _id: String(target._id) }
    : { dishId: String(target._id), restaurantId: String(target.restaurantId) };
  const fields = type === 'restaurant' ? RESTAURANT_FIELDS : DISH_FIELDS;
  for (const field of fields) {
    if (target[field] !== undefined) summary[field] = target[field];
  }
  return summary;
}

function serializeFavorite(record, target) {
  return {
    targetType: record.targetType,
    targetId: String(record.targetId),
    createdAt: new Date(record.createdAt).toISOString(),
    target: summarizeTarget(record.targetType, target),
  };
}

function createFavoriteService({ store, readers }) {
  if (!store || ['list', 'save', 'remove'].some(method => typeof store[method] !== 'function')) {
    throw new TypeError('A Favorites store is required.');
  }
  for (const type of ['restaurant', 'dish']) {
    if (!readers || !readers[type] || typeof readers[type].findByIds !== 'function') {
      throw new TypeError(`A ${type} reader with findByIds(ids) is required.`);
    }
  }

  async function readTargets(type, ids) {
    if (ids.length === 0) return new Map();
    const targets = await readers[type].findByIds(ids);
    if (!Array.isArray(targets)) throw new Error('Invalid catalog reader response');
    const result = new Map();
    for (const target of targets) {
      if (!target || !isObjectIdString(String(target._id)) ||
          (type === 'dish' && !isObjectIdString(String(target.restaurantId)))) {
        throw new Error('Invalid catalog target');
      }
      result.set(String(target._id).toLowerCase(), target);
    }
    return result;
  }

  return {
    async list(userId) {
      if (!isObjectIdString(userId)) throw new FavoriteInputError(401, 'Authentication required');
      const records = await store.list(userId.toLowerCase());
      const types = ['restaurant', 'dish'];
      const maps = await Promise.all(types.map(type => {
        const ids = [...new Set(records.filter(record => record.targetType === type)
          .map(record => String(record.targetId)))];
        return readTargets(type, ids);
      }));
      return records.map(record => {
        const map = maps[types.indexOf(record.targetType)];
        return serializeFavorite(record, map.get(String(record.targetId)) || null);
      });
    },

    async save(userId, targetType, targetId) {
      const key = validateKey(userId, targetType, targetId);
      const targets = await readTargets(key.targetType, [key.targetId]);
      const target = targets.get(key.targetId);
      if (!target) throw new FavoriteInputError(404, 'Favorite target not found');
      const record = await store.save(key);
      return serializeFavorite(record, target);
    },

    async remove(userId, targetType, targetId) {
      // No catalog read: a deleted target must remain removable.
      await store.remove(validateKey(userId, targetType, targetId));
    },
  };
}

module.exports = { createFavoriteService, FavoriteInputError };