import {
  isRecord,
  isStableId,
  isValidFlavorVector,
} from "../contracts";

// =====================================================
// Utilities
// =====================================================

const hasOwn = (object, key) =>
  isRecord(object) &&
  Object.prototype.hasOwnProperty.call(object, key);

// =====================================================
// 1. Resolve image URLs
// =====================================================

/**
 * Resolve uploads only against the owning API origin.
 * Never guess an unrelated host.
 */
export function resolveCatalogImageUrl(value, origin) {
  if (
    typeof value !== "string" ||
    value.trim() === ""
  ) {
    return null;
  }

  try {
    const url = origin
      ? new URL(value.trim(), origin)
      : new URL(value.trim());

    return (
      ["http:", "https:"].includes(url.protocol) &&
      url.hostname
    )
      ? url.href
      : null;
  } catch {
    return null;
  }
}

// =====================================================
// 2. Normalize dish records
// =====================================================

function normalizeDish(record, origin) {
  if (
    !isRecord(record) ||
    !isStableId(record.id) ||
    !isStableId(record.restaurantId)
  ) {
    throw new TypeError(
      "The dish API must supply id and restaurantId for every dish."
    );
  }

  const { id, ...fields } = record;

  return {
    ...fields,
    dishId: id,
    restaurantId: record.restaurantId,
    imageUrl: resolveCatalogImageUrl(
      record.imageUrl,
      origin
    ),
  };
}

// =====================================================
// 3. Public restaurant and dish sources
// =====================================================

export function createLiveCatalogSources({
  getRestaurants,
  getDishes,
  origin,
  dishReadComplete = true,
} = {}) {
  if (typeof dishReadComplete !== "boolean") {
    throw new TypeError(
      "Dish completeness must be a boolean."
    );
  }

  return {
    restaurantSource: {
      async getRestaurants() {
        if (
          typeof getRestaurants !== "function"
        ) {
          throw new Error(
            "Restaurant reader is not connected."
          );
        }

        const restaurants =
          await getRestaurants();

        if (!Array.isArray(restaurants)) {
          throw new TypeError(
            "The restaurant API must return a bare array."
          );
        }

        return restaurants;
      },
    },

    dishSource: {
      async getDishes() {
        if (
          typeof getDishes !== "function"
        ) {
          throw new Error(
            "Dish reader is not connected."
          );
        }

        const payload =
          await getDishes();

        let records = payload;
        let complete = dishReadComplete;
        let note;

        if (!Array.isArray(payload)) {
          if (
            !isRecord(payload) ||
            !Array.isArray(payload.dishes) ||
            payload.coverage?.scope !==
              "candidate-pool" ||
            payload.coverage.complete !== false ||
            (
              payload.coverage.note !== undefined &&
              typeof payload.coverage.note !== "string"
            )
          ) {
            throw new TypeError(
              "The dish API must return a full bare array or an explicitly partial dish pool."
            );
          }

          records = payload.dishes;
          complete = false;
          note = payload.coverage.note;
        }

        return {
          dishes: records.map((record) =>
            normalizeDish(record, origin)
          ),

          coverage: {
            scope: "candidate-pool",
            complete,

            ...(note === undefined
              ? {}
              : { note }),
          },
        };
      },
    },
  };
}

// =====================================================
// 4. Cancelled preference read
// =====================================================

function cancelledRead() {
  const error = new Error(
    "Preference read was cancelled."
  );

  error.name = "AbortError";

  return error;
}

// =====================================================
// 5. Legacy account compatibility
// =====================================================

/**
 * The existing Accounts module may return a legacy
 * profile containing foodPreferences or
 * favoriteCuisines, without numeric flavorTargets.
 *
 * Such a legacy profile has no numeric taste vector.
 *
 * Compatibility policy:
 *
 * 1. Explicit null -> no numeric preferences.
 * 2. Valid six-dimensional vector -> personalized.
 * 3. Known legacy profile without flavorTargets ->
 *    no numeric preferences.
 * 4. Explicit invalid flavorTargets -> error.
 * 5. Other missing flavorTargets -> error.
 *
 * Never infer numeric values from text tags.
 */
function normalizeFlavorTargets(profile, payload) {
  // Prefer the profile's explicit field.
  if (hasOwn(profile, "flavorTargets")) {
    const targets = profile.flavorTargets;

    if (targets === null) {
      return null;
    }

    if (!isValidFlavorVector(targets)) {
      throw new TypeError(
        "Invalid flavorTargets: expected exactly six numeric values from 0 to 5."
      );
    }

    return { ...targets };
  }

  // Support an explicitly supplied outer field.
  if (
    payload !== profile &&
    hasOwn(payload, "flavorTargets")
  ) {
    const targets = payload.flavorTargets;

    if (targets === null) {
      return null;
    }

    if (!isValidFlavorVector(targets)) {
      throw new TypeError(
        "Invalid flavorTargets in account response."
      );
    }

    return { ...targets };
  }

  // A known legacy Accounts profile has textual
  // preferences but no numeric taste vector.
  const isLegacyAccountProfile =
    Array.isArray(profile.foodPreferences) ||
    Array.isArray(profile.favoriteCuisines);

  if (isLegacyAccountProfile) {
    return null;
  }

  // Unknown or incomplete response formats
  // must not silently become empty preferences.
  throw new TypeError(
    "Account profile is missing flavorTargets."
  );
}

// =====================================================
// 6. Authenticated account source
// =====================================================

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
    // =================================================
    // Cancel pending requests
    // =================================================

    cancelPending() {
      pending.forEach((controller) =>
        controller.abort()
      );

      pending.clear();
    },

    // =================================================
    // Read user preferences
    // =================================================

    async getPreferences({
      userId: requestedUserId,
    } = {}) {
      // -----------------------------------------------
      // Validate authenticated session
      // -----------------------------------------------

      if (
        !isStableId(userId) ||
        requestedUserId !== userId ||
        typeof token !== "string" ||
        token.trim() === ""
      ) {
        throw new Error(
          "A matching signed-in session is required for preferences."
        );
      }

      if (
        typeof readSelfProfile !== "function"
      ) {
        throw new Error(
          "Numeric self-profile reader is not connected."
        );
      }

      if (!isCurrentSession()) {
        throw cancelledRead();
      }

      // -----------------------------------------------
      // Create cancellable request
      // -----------------------------------------------

      const controller =
        new AbortController();

      pending.add(controller);

      try {
        // ---------------------------------------------
        // Fetch authenticated self-profile
        // ---------------------------------------------

        const payload =
          await readSelfProfile({
            token,
            origin,
            signal: controller.signal,
          });

        if (
          controller.signal.aborted ||
          !isCurrentSession()
        ) {
          throw cancelledRead();
        }

        // ---------------------------------------------
        // Normalize response envelope
        // ---------------------------------------------

        const profile =
          isRecord(payload?.user)
            ? payload.user
            : payload;

        const responseId =
          profile === payload
            ? profile?.userId
            : profile?.id;

        // ---------------------------------------------
        // Verify account identity
        // ---------------------------------------------

        if (
          !isRecord(profile) ||
          responseId !== userId ||
          (
            payload?.userId !== undefined &&
            payload.userId !== userId
          ) ||
          (
            profile.id !== undefined &&
            profile.id !== userId
          ) ||
          (
            profile._id !== undefined &&
            profile._id !== userId
          )
        ) {
          throw new Error(
            "Self-profile identity does not match the current session."
          );
        }

        // ---------------------------------------------
        // Normalize preferences
        // ---------------------------------------------

        const flavorTargets =
          normalizeFlavorTargets(
            profile,
            payload
          );

        // ---------------------------------------------
        // Return agreed repository contract
        // ---------------------------------------------

        return {
          userId,
          flavorTargets,
        };
      } catch (error) {
        // ---------------------------------------------
        // Ignore cancelled or stale sessions
        // ---------------------------------------------

        if (
          controller.signal.aborted ||
          !isCurrentSession()
        ) {
          throw cancelledRead();
        }

        // ---------------------------------------------
        // Handle expired authentication
        // ---------------------------------------------

        if (error?.status === 401) {
          onSessionExpired?.();
        }

        throw error;
      } finally {
        pending.delete(controller);
      }
    },
  };
}