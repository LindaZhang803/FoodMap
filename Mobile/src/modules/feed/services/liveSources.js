import { isRecord, isStableId, isValidFlavorVector } from '../contracts';

/** Resolve uploads only against the owning API origin, never a guessed host. */
export function resolveCatalogImageUrl(value, origin) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  try {
    const url = origin ? new URL(value.trim(), origin) : new URL(value.trim());
    return ['http:', 'https:'].includes(url.protocol) && url.hostname ? url.href : null;
  } catch {
    return null;
  }
}

function normalizeDish(record, origin) {
  if (!isRecord(record) || !isStableId(record.id) || !isStableId(record.restaurantId)) {
    throw new TypeError('The dish API must supply id and restaurantId for every dish.');
  }
  const { id, ...fields } = record;
  return {
    ...fields,
    dishId: id,
    restaurantId: record.restaurantId,
    imageUrl: resolveCatalogImageUrl(record.imageUrl, origin),
  };
}

/**
 * The pinned unfiltered owner clients each return a bare array. Bind Member 2's
 * repository method before injecting it. No restaurant ID, fixtures, credentials,
 * or sort override is passed to either public reader.
 *
 * dishReadComplete=false declares a known partial bare-array source. A future
 * paged reader may supply an explicitly PARTIAL local envelope; it must collect
 * every page before supplying a complete bare array. Unknown envelopes fail
 * honestly, allowing FeedRepository to keep the restaurants and show degradation.
 */
export function createLiveCatalogSources({
  getRestaurants,
  getDishes,
  origin,
  dishReadComplete = true,
} = {}) {
  if (typeof dishReadComplete !== 'boolean') {
    throw new TypeError('Dish completeness must be a boolean.');
  }
  return {
    restaurantSource: {
      async getRestaurants() {
        if (typeof getRestaurants !== 'function') {
          throw new Error('Restaurant reader is not connected.');
        }
        const restaurants = await getRestaurants();
        if (!Array.isArray(restaurants)) {
          throw new TypeError('The restaurant API must return a bare array.');
        }
        // Retain the exact owner objects and all metadata. Restaurant-only image
        // renderers use resolveCatalogImageUrl, leaving these records untouched.
        return restaurants;
      },
    },
    dishSource: {
      async getDishes() {
        if (typeof getDishes !== 'function') {
          throw new Error('Dish reader is not connected.');
        }
        const payload = await getDishes();
        let records = payload;
        let complete = dishReadComplete;
        let note;
        if (!Array.isArray(payload)) {
          if (!isRecord(payload) || !Array.isArray(payload.dishes)
              || payload.coverage?.scope !== 'candidate-pool'
              || payload.coverage.complete !== false
              || (payload.coverage.note !== undefined && typeof payload.coverage.note !== 'string')) {
            throw new TypeError('The dish API must return a full bare array or an explicitly partial dish pool.');
          }
          records = payload.dishes;
          complete = false;
          note = payload.coverage.note;
        }
        return {
          dishes: records.map(record => normalizeDish(record, origin)),
          coverage: { scope: 'candidate-pool', complete, ...(note === undefined ? {} : { note }) },
        };
      },
    },
  };
}

function cancelledRead() {
  const error = new Error('Preference read was cancelled.');
  error.name = 'AbortError';
  return error;
}

/**
 * An owner-supplied authenticated self-reader takes { token, origin, signal } and
 * returns JSON, throwing an error with status=401 for an expired Bearer token.
 * It must never put a user ID in the self-read URL, query, or body. The identity
 * here is solely a local response check, not an authorization mechanism.
 *
 * Accept the agreed {userId, flavorTargets} shape or Accounts' {user:{id,...}}
 * envelope once its owner adds numeric flavorTargets. Legacy foodPreferences
 * tags, missing targets, and {} are unavailable. Only explicit null means empty.
 * The composition supplies isCurrentSession so stale 401s cannot log out a new
 * account. cancelPending aborts work without permanently disposing the source.
 */
export function createLiveAccountSource({
  readSelfProfile,
  userId,
  token,
  origin,
  isCurrentSession = () => true,
  onSessionExpired,
} = {}) {
  const pending = new Set();
  return {
    cancelPending() {
      pending.forEach(controller => controller.abort());
      pending.clear();
    },
    async getPreferences({ userId: requestedUserId } = {}) {
      if (!isStableId(userId) || requestedUserId !== userId
          || typeof token !== 'string' || token.trim() === '') {
        throw new Error('A matching signed-in session is required for preferences.');
      }
      if (typeof readSelfProfile !== 'function') {
        throw new Error('Numeric self-profile reader is not connected.');
      }
      if (!isCurrentSession()) throw cancelledRead();
      const controller = new AbortController();
      pending.add(controller);
      try {
        const payload = await readSelfProfile({ token, origin, signal: controller.signal });
        if (controller.signal.aborted || !isCurrentSession()) throw cancelledRead();
        const profile = isRecord(payload?.user) ? payload.user : payload;
        const responseId = profile === payload ? profile?.userId : profile?.id;
        if (!isRecord(profile) || responseId !== userId
            || (payload?.userId !== undefined && payload.userId !== userId)
            || (profile.id !== undefined && profile.id !== userId)
            || (profile._id !== undefined && profile._id !== userId)) {
          throw new Error('Self-profile identity does not match the current session.');
        }
        if (!Object.prototype.hasOwnProperty.call(profile, 'flavorTargets')
            || (profile.flavorTargets !== null && !isValidFlavorVector(profile.flavorTargets))) {
          throw new TypeError('Preferences require exactly six numeric targets from 0 to 5, or explicit null.');
        }
        return {
          userId,
          flavorTargets: profile.flavorTargets === null ? null : { ...profile.flavorTargets },
        };
      } catch (error) {
        if (controller.signal.aborted || !isCurrentSession()) throw cancelledRead();
        if (error?.status === 401) onSessionExpired?.();
        throw error;
      } finally {
        pending.delete(controller);
      }
    },
  };
}
