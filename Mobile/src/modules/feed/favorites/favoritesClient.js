import {
  hasValidDisplayFields,
  isStableId,
} from "../contracts";

const OBJECT_ID = /^[0-9a-f]{24}$/i;

const TYPES = ["restaurant", "dish"];

// =====================================================
// 1. Favorite identity
// =====================================================

export function favoriteKey(targetType, targetId) {
  if (
    !TYPES.includes(targetType) ||
    typeof targetId !== "string" ||
    !OBJECT_ID.test(targetId)
  ) {
    throw new TypeError(
      "A saved item needs a restaurant or dish type and a catalog ID."
    );
  }

  return `${targetType}:${targetId.toLowerCase()}`;
}

// =====================================================
// 2. Normalize image URL
// =====================================================

function imageUrl(value, origin) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return null;
  }

  try {
    const url = new URL(value.trim(), origin);

    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    )
      ? url.href
      : null;
  } catch {
    return null;
  }
}

// =====================================================
// 3. Normalize saved item
// =====================================================

export function normalizeFavorite(
  item,
  origin,
  expectedKey
) {
  if (
    !item ||
    typeof item !== "object" ||
    Array.isArray(item)
  ) {
    throw new TypeError(
      "Invalid saved item response."
    );
  }

  const key = favoriteKey(
    item.targetType,
    item.targetId
  );

  if (
    expectedKey &&
    key !== expectedKey
  ) {
    throw new TypeError(
      "Saved item identity did not match the request."
    );
  }

  if (
    typeof item.createdAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T/.test(
      item.createdAt
    ) ||
    !Number.isFinite(
      Date.parse(item.createdAt)
    )
  ) {
    throw new TypeError(
      "Invalid saved item date."
    );
  }

  let target = item.target;

  if (target !== null) {
    if (
      !target ||
      typeof target !== "object" ||
      Array.isArray(target)
    ) {
      throw new TypeError(
        "Invalid saved item target."
      );
    }

    const id =
      item.targetType === "restaurant"
        ? target._id
        : target.dishId;

    if (
      favoriteKey(
        item.targetType,
        id
      ) !== key
    ) {
      throw new TypeError(
        "Saved target identity did not match its envelope."
      );
    }

    // Preserve strict identity validation.
    for (const extra of ["id", "_id"]) {
      if (
        target[extra] != null &&
        favoriteKey(
          item.targetType,
          target[extra]
        ) !== key
      ) {
        throw new TypeError(
          "Saved target has conflicting identities."
        );
      }
    }

    if (item.targetType === "dish") {
      favoriteKey(
        "restaurant",
        target.restaurantId
      );
    }

    const ratingKey =
      item.targetType === "restaurant"
        ? "rating"
        : "averageRating";

    const textKeys =
      item.targetType === "restaurant"
        ? [
            "address",
            "cuisineType",
            "priceRange",
          ]
        : [];

    if (
      !isStableId(target.name) ||
      !hasValidDisplayFields(
        target,
        ratingKey,
        textKeys
      )
    ) {
      throw new TypeError(
        "Invalid saved target display fields."
      );
    }

    target = {
      ...target,
      imageUrl: imageUrl(
        target.imageUrl,
        origin
      ),
    };
  }

  return {
    targetType: item.targetType,
    targetId: item.targetId.toLowerCase(),
    createdAt: item.createdAt,
    target,
  };
}

// =====================================================
// 4. Error helpers
// =====================================================

function createFavoritesError(
  message,
  {
    status = null,
    stage = "unknown",
  } = {}
) {
  const error = new Error(message);

  error.status = status;
  error.stage = stage;

  return error;
}

function reportError(method, error) {
  if (typeof __DEV__ === "undefined" || !__DEV__) {
    return;
  }

  // Do not log authentication tokens or response bodies.
  console.warn(
    "[FoodMap Favorites] Request failed:",
    {
      method,
      status: error?.status ?? null,
      stage: error?.stage ?? "unknown",
      message:
        error?.message ??
        "Unknown error",
    }
  );
}

// =====================================================
// 5. Favorites API client
// =====================================================

export function createFavoritesClient({
  origin,
  fetchImpl = globalThis.fetch,
}) {
  let base;

  try {
    const parsed = new URL(origin);

    if (
      !["http:", "https:"].includes(
        parsed.protocol
      ) ||
      parsed.username ||
      parsed.password
    ) {
      throw new Error(
        "Invalid API origin"
      );
    }

    base = parsed.origin;
  } catch {
    throw new TypeError(
      "Favorites needs the shared HTTP(S) API origin."
    );
  }

  if (
    typeof fetchImpl !== "function"
  ) {
    throw new TypeError(
      "Favorites needs an HTTP client."
    );
  }

  // ===================================================
  // 6. HTTP request
  // ===================================================

  async function request(
    method,
    {
      token,
      signal,
      targetType,
      targetId,
    } = {}
  ) {
    if (
      typeof token !== "string" ||
      !token.trim()
    ) {
      throw createFavoritesError(
        "A current session token is required.",
        {
          stage: "authentication",
        }
      );
    }

    const key =
      method === "GET"
        ? null
        : favoriteKey(
            targetType,
            targetId
          );

    const path = key
      ? `/${targetType}/${targetId.toLowerCase()}`
      : "";

    const url =
      `${base}/api/favorites${path}`;

    let response;

    // -------------------------------------------------
    // Network request
    // -------------------------------------------------

    try {
      response = await fetchImpl(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal,
      });
    } catch (error) {
      // Preserve cancellation behavior.
      if (
        error?.name === "AbortError"
      ) {
        throw error;
      }

      const networkError =
        createFavoritesError(
          "Cannot connect to the Favorites API. Check that the backend is running and the API address is correct.",
          {
            stage: "network",
          }
        );

      reportError(
        method,
        networkError
      );

      throw networkError;
    }

    // -------------------------------------------------
    // HTTP response validation
    // -------------------------------------------------

    const expectedStatus =
      method === "DELETE"
        ? 204
        : 200;

    if (
      response.status !==
      expectedStatus
    ) {
      let message;

      switch (response.status) {
        case 401:
          message =
            "Your session has expired.";
          break;

        case 403:
          message =
            "The account is not authorized to access this saved list.";
          break;

        case 404:
          message =
            "Favorites API endpoint was not found (404). Check the backend route.";
          break;

        case 405:
          message =
            "Favorites API does not support this request method (405).";
          break;

        case 500:
          message =
            "Favorites API returned an internal server error (500).";
          break;

        default:
          message =
            `Favorites API returned HTTP ${response.status}.`;
      }

      const httpError =
        createFavoritesError(
          message,
          {
            status: response.status,
            stage: "http",
          }
        );

      reportError(
        method,
        httpError
      );

      throw httpError;
    }

    // -------------------------------------------------
    // Successful DELETE
    // -------------------------------------------------

    if (method === "DELETE") {
      return undefined;
    }

    // -------------------------------------------------
    // Decode JSON
    // -------------------------------------------------

    let payload;

    try {
      payload = await response.json();
    } catch {
      const jsonError =
        createFavoritesError(
          "Favorites API returned invalid JSON.",
          {
            status: response.status,
            stage: "json",
          }
        );

      reportError(
        method,
        jsonError
      );

      throw jsonError;
    }

    // -------------------------------------------------
    // Validate payload
    // -------------------------------------------------

    try {
      if (method !== "GET") {
        return normalizeFavorite(
          payload,
          base,
          key
        );
      }

      if (
        !payload ||
        !Array.isArray(payload.items)
      ) {
        throw new TypeError(
          "Expected a JSON object containing an items array."
        );
      }

      const seen = new Set();

      return payload.items.map(
        (item) => {
          const normalized =
            normalizeFavorite(
              item,
              base
            );

          const itemKey =
            favoriteKey(
              normalized.targetType,
              normalized.targetId
            );

          if (seen.has(itemKey)) {
            throw new TypeError(
              "Duplicate item in saved list response."
            );
          }

          seen.add(itemKey);

          return normalized;
        }
      );
    } catch (error) {
      const validationError =
        createFavoritesError(
          `Invalid Favorites API response: ${error.message}`,
          {
            status: response.status,
            stage: "validation",
          }
        );

      reportError(
        method,
        validationError
      );

      throw validationError;
    }
  }

  // ===================================================
  // 7. Public API
  // ===================================================

  return {
    list: (options) =>
      request("GET", options),

    save: (options) =>
      request("PUT", options),

    remove: (options) =>
      request("DELETE", options),
  };
}