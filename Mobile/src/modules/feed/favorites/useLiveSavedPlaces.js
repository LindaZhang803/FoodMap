import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  createFavoritesClient,
  favoriteKey,
  normalizeFavorite,
} from "./favoritesClient";

// =====================================================
// Utilities
// =====================================================

const sorted = (items) =>
  [...items].sort(
    (a, b) =>
      Date.parse(b.createdAt) -
      Date.parse(a.createdAt)
  );

function logFavoritesError(context, error) {
  if (!__DEV__) return;

  console.error(
    `[FoodMap Favorites] ${context}`,
    {
      status: error?.status ?? null,
      message:
        error?.message ?? String(error),
    }
  );
}

// =====================================================
// useLiveSavedPlaces
// =====================================================

/**
 * One private saved-list state owner shared by:
 *
 * - Discover
 * - Restaurant details
 * - Want to Try
 * - Decision Wheel
 *
 * Account-specific data must not leak between
 * different authenticated sessions.
 */
export default function useLiveSavedPlaces({
  session,
  origin,
  client,
  fetchImpl,
  onLoginRequired,
  onSessionExpired,
}) {
  const userId =
    session?.userId || null;

  const token =
    session?.token || null;

  const signedIn = Boolean(
    userId && token
  );

  // =====================================================
  // 1. Favorites API client
  // =====================================================

  const http = useMemo(
    () =>
      client ||
      createFavoritesClient({
        origin,
        fetchImpl,
      }),
    [
      client,
      origin,
      fetchImpl,
    ]
  );

  const currentScope = useRef(null);

  const callbacks = useRef({
    onLoginRequired,
    onSessionExpired,
  });

  callbacks.current = {
    onLoginRequired,
    onSessionExpired,
  };

  const [, rerender] = useState(0);

  // =====================================================
  // 2. Session scope
  // =====================================================

  const scope = useMemo(
    () => ({
      userId,
      origin,
      signedIn,

      items: [],

      status: signedIn
        ? "loading"
        : "signed-out",

      error: null,

      mutationErrors: {},

      pending: new Set(),
      controllers: new Set(),

      loaded: false,
      mounted: false,
      expired: false,

      listSequence: 0,

      revision: 0,

      changes: new Map(),

      privateIdentity: {},
    }),
    [
      userId,
      token,
      http,
      origin,
      signedIn,
    ]
  );

  currentScope.current = scope;

  // =====================================================
  // 3. Actions
  // =====================================================

  const actions = useMemo(() => {
    const isCurrent = () =>
      currentScope.current === scope &&
      scope.mounted &&
      !scope.expired;

    const publish = () => {
      if (
        currentScope.current === scope &&
        scope.mounted
      ) {
        rerender(
          (value) => value + 1
        );
      }
    };

    // ---------------------------------------------------
    // Abort controller
    // ---------------------------------------------------

    const controller = () => {
      const abort =
        typeof AbortController === "function"
          ? new AbortController()
          : null;

      if (abort) {
        scope.controllers.add(abort);
      }

      return abort;
    };

    // ---------------------------------------------------
    // Login
    // ---------------------------------------------------

    const requestLogin = () => {
      if (
        currentScope.current === scope
      ) {
        callbacks.current
          .onLoginRequired?.();
      }
    };

    // ---------------------------------------------------
    // Session expiration
    // ---------------------------------------------------

    function expire() {
      if (!isCurrent()) {
        return;
      }

      scope.expired = true;

      scope.privateIdentity = {};

      scope.items = [];

      scope.status = "expired";

      scope.error = new Error(
        "Your session has expired. Sign in to use Want to Try."
      );

      scope.mutationErrors = {};

      scope.pending.clear();

      scope.controllers.forEach(
        (abort) => abort.abort()
      );

      publish();

      callbacks.current
        .onSessionExpired?.();
    }

    // ===================================================
    // 4. Refresh saved items
    // ===================================================

    async function refresh() {
      if (
        !isCurrent() ||
        !signedIn
      ) {
        return false;
      }

      const sequence =
        ++scope.listSequence;

      const startingRevision =
        scope.revision;

      const protectedKeys =
        new Set(scope.pending);

      const abort = controller();

      scope.status = "loading";
      scope.error = null;

      publish();

      try {
        const response =
          await http.list({
            token,
            signal: abort?.signal,
          });

        if (
          !isCurrent() ||
          sequence !==
            scope.listSequence
        ) {
          return false;
        }

        if (
          !Array.isArray(response)
        ) {
          throw new TypeError(
            "Invalid saved list response."
          );
        }

        const incoming = new Map();

        response.forEach((raw) => {
          const item = normalizeFavorite(
            raw,
            origin
          );

          const key = favoriteKey(
            item.targetType,
            item.targetId
          );

          if (
            incoming.has(key)
          ) {
            throw new TypeError(
              "Duplicate item in saved list response."
            );
          }

          incoming.set(
            key,
            item
          );
        });

        // -----------------------------------------------
        // Preserve confirmed local mutations.
        // -----------------------------------------------

        scope.pending.forEach(
          (key) =>
            protectedKeys.add(key)
        );

        scope.changes.forEach(
          (revision, key) => {
            if (
              revision >
              startingRevision
            ) {
              protectedKeys.add(key);
            }
          }
        );

        const confirmed = new Map(
          scope.items.map(
            (item) => [
              favoriteKey(
                item.targetType,
                item.targetId
              ),
              item,
            ]
          )
        );

        protectedKeys.forEach(
          (key) => {
            if (
              confirmed.has(key)
            ) {
              incoming.set(
                key,
                confirmed.get(key)
              );
            } else {
              incoming.delete(key);
            }
          }
        );

        scope.items = sorted(
          incoming.values()
        );

        scope.loaded = true;
        scope.status = "ready";

        if (__DEV__) {
          console.log(
            "[FoodMap Favorites] Saved list loaded successfully.",
            {
              count:
                scope.items.length,
            }
          );
        }

        publish();

        return true;
      } catch (error) {
        if (
          !isCurrent() ||
          sequence !==
            scope.listSequence
        ) {
          return false;
        }

        if (
          error?.status === 401
        ) {
          logFavoritesError(
            "Session expired while loading saved list",
            error
          );

          expire();
          return false;
        }

        // Development-only diagnostics.
        logFavoritesError(
          "Saved list loading failed",
          error
        );

        scope.status = "failed";

        // Keep the user-facing error concise.
        scope.error = new Error(
          "Could not load Want to Try. Please retry."
        );

        publish();

        return false;
      } finally {
        scope.controllers.delete(
          abort
        );
      }
    }

    // ===================================================
    // 5. Save or remove favorite
    // ===================================================

    async function mutate(
      targetType,
      targetId,
      remove
    ) {
      if (
        currentScope.current !== scope
      ) {
        return false;
      }

      if (
        !signedIn ||
        scope.expired
      ) {
        requestLogin();

        return false;
      }

      if (
        !isCurrent() ||
        !scope.loaded
      ) {
        return false;
      }

      let key;

      try {
        key = favoriteKey(
          targetType,
          targetId
        );
      } catch {
        return false;
      }

      if (
        scope.pending.has(key)
      ) {
        return false;
      }

      const abort = controller();

      scope.pending.add(key);

      scope.changes.set(
        key,
        ++scope.revision
      );

      const errors = {
        ...scope.mutationErrors,
      };

      delete errors[key];

      scope.mutationErrors = errors;

      publish();

      try {
        const options = {
          token,
          targetType,
          targetId,
          signal: abort?.signal,
        };

        const response = remove
          ? await http.remove(options)
          : await http.save(options);

        if (
          !isCurrent()
        ) {
          return false;
        }

        const item = remove
          ? null
          : normalizeFavorite(
              response,
              origin,
              key
            );

        scope.items = scope.items.filter(
          (saved) =>
            favoriteKey(
              saved.targetType,
              saved.targetId
            ) !== key
        );

        if (item) {
          scope.items = sorted([
            ...scope.items,
            item,
          ]);
        }

        scope.changes.set(
          key,
          ++scope.revision
        );

        publish();

        return true;
      } catch (error) {
        if (
          !isCurrent()
        ) {
          return false;
        }

        if (
          error?.status === 401
        ) {
          logFavoritesError(
            "Session expired during favorite mutation",
            error
          );

          expire();
          return false;
        }

        logFavoritesError(
          "Favorite mutation failed",
          error
        );

        scope.mutationErrors = {
          ...scope.mutationErrors,

          [key]: new Error(
            "Could not update this saved item. Please retry."
          ),
        };

        publish();

        return false;
      } finally {
        scope.controllers.delete(
          abort
        );

        scope.pending.delete(
          key
        );

        if (
          isCurrent()
        ) {
          publish();
        }
      }
    }

    // ===================================================
    // 6. Check saved status
    // ===================================================

    const isSaved = (
      type,
      id
    ) => {
      let key;

      try {
        key = favoriteKey(
          type,
          id
        );
      } catch {
        return false;
      }

      return scope.items.some(
        (item) =>
          favoriteKey(
            item.targetType,
            item.targetId
          ) === key
      );
    };

    // ===================================================
    // 7. Public actions
    // ===================================================

    return {
      refresh,
      retry: refresh,

      requestLogin,

      isSaved,

      isPending: (
        type,
        id
      ) => {
        try {
          return scope.pending.has(
            favoriteKey(
              type,
              id
            )
          );
        } catch {
          return false;
        }
      },

      canSaveTarget: (
        type,
        id
      ) => {
        try {
          favoriteKey(
            type,
            id
          );

          return true;
        } catch {
          return false;
        }
      },

      removeFavorite: (
        type,
        id
      ) =>
        mutate(
          type,
          id,
          true
        ),

      toggleFavorite: (
        item
      ) =>
        mutate(
          "restaurant",
          item._id,
          isSaved(
            "restaurant",
            item._id
          )
        ),

      toggleFavoriteDish: (
        item
      ) =>
        mutate(
          "dish",
          item.dishId,
          isSaved(
            "dish",
            item.dishId
          )
        ),
    };
  }, [
    scope,
    http,
    token,
    signedIn,
    origin,
  ]);

  // =====================================================
  // 8. Load favorites when account changes
  // =====================================================

  useEffect(() => {
    scope.mounted = true;

    if (signedIn) {
      actions.refresh();
    }

    return () => {
      scope.mounted = false;

      scope.listSequence += 1;

      scope.controllers.forEach(
        (abort) => abort.abort()
      );

      scope.controllers.clear();
    };
  }, [
    scope,
    signedIn,
    actions,
  ]);

  // =====================================================
  // 9. Shared saved-place state
  // =====================================================

  return {
    ...actions,

    sessionScope:
      signedIn &&
      !scope.expired
        ? scope.privateIdentity
        : null,

    canRequestLogin:
      typeof onLoginRequired ===
      "function",

    items: scope.items,

    favorites:
      scope.items
        .filter(
          (item) =>
            item.targetType ===
              "restaurant" &&
            item.target
        )
        .map(
          (item) =>
            item.target
        ),

    favoriteDishes:
      scope.items
        .filter(
          (item) =>
            item.targetType ===
              "dish" &&
            item.target
        )
        .map(
          (item) =>
            item.target
        ),

    status:
      scope.status,

    error:
      scope.error,

    mutationErrors:
      scope.mutationErrors,

    pendingKeys: [
      ...scope.pending,
    ],

    loading:
      scope.status === "loading",

    canMutate:
      signedIn &&
      scope.loaded &&
      !scope.expired,
  };
}