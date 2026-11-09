import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
} from "react";

import { rankCandidates } from "../ranking/PreferenceRanker";

import { DEFAULT_RANKING_POLICY } from "../ranking/rankingPolicy";

// =====================================================
// Utilities
// =====================================================

const identityOf = (userId) =>
  userId == null || userId === ""
    ? null
    : userId;

function logFeedError(context, error) {
  if (!__DEV__) return;

  console.error(`[FoodMap Feed] ${context}`, {
    status: error?.status ?? null,
    message: error?.message ?? String(error),
  });
}

// =====================================================
// Preference snapshots
// =====================================================

function initialSnapshot(identity) {
  return {
    userId: identity,
    status:
      identity === null
        ? "signed-out"
        : "loading",
    flavorTargets: null,
    error: null,
  };
}

function unavailableSnapshot(identity, error) {
  return {
    userId: identity,
    status: "unavailable",
    flavorTargets: null,
    error,
  };
}

// =====================================================
// Ranking
// =====================================================

function withRanking(state, updates) {
  const next = {
    ...state,
    ...updates,
  };

  return {
    ...next,
    entries: rankCandidates(
      next.candidates,
      next.snapshot,
      next.policy
    ),
  };
}

// =====================================================
// Initial state
// =====================================================

function initialize({
  identity,
  policy,
  feedRepository,
  preferenceRepository,
}) {
  return {
    identity,
    policy,
    feedRepository,
    preferenceRepository,

    candidates: [],
    entries: [],

    snapshot: initialSnapshot(identity),

    resourceRequest: null,
    preferenceRequest: null,

    hasResourceResult: false,
    hasPreferenceResult: identity === null,

    resourceLoading: true,
    resourceRefreshing: false,

    preferencesLoading: identity !== null,
    preferenceRefreshing: false,

    resourceError: null,
    dishError: null,

    coverage: null,
    diagnostics: [],
  };
}

// =====================================================
// Reducer
// =====================================================

function reducer(state, action) {
  switch (action.type) {
    case "configure": {
      const accountChanged =
        state.identity !== action.identity;

      const resourceSourceChanged =
        state.feedRepository !==
        action.feedRepository;

      const preferenceSourceChanged =
        state.preferenceRepository !==
        action.preferenceRepository;

      return withRanking(state, {
        identity: action.identity,
        policy: action.policy,

        feedRepository:
          action.feedRepository,

        preferenceRepository:
          action.preferenceRepository,

        ...(resourceSourceChanged
          ? {
              candidates: [],
              resourceRequest: null,
              hasResourceResult: false,

              resourceLoading: true,
              resourceRefreshing: false,

              resourceError: null,
              dishError: null,

              coverage: null,
              diagnostics: [],
            }
          : {}),

        ...(accountChanged ||
        preferenceSourceChanged
          ? {
              snapshot: initialSnapshot(
                action.identity
              ),

              preferenceRequest: null,

              hasPreferenceResult:
                action.identity === null,

              preferencesLoading:
                action.identity !== null,

              preferenceRefreshing: false,
            }
          : {}),
      });
    }

    case "resource-start":
      return {
        ...state,

        resourceRequest: action.request,

        resourceLoading:
          !state.hasResourceResult,

        resourceRefreshing:
          state.hasResourceResult,

        resourceError: null,
      };

    case "resource-success":
      if (
        state.resourceRequest !==
        action.request
      ) {
        return state;
      }

      return withRanking(state, {
        candidates:
          action.result.candidates,

        hasResourceResult: true,

        resourceLoading: false,
        resourceRefreshing: false,

        resourceError: null,

        dishError:
          action.result.dishError ?? null,

        coverage:
          action.result.coverage ?? null,

        diagnostics:
          action.result.diagnostics ?? [],
      });

    case "resource-failure":
      if (
        state.resourceRequest !==
        action.request
      ) {
        return state;
      }

      return {
        ...state,

        resourceLoading: false,
        resourceRefreshing: false,

        resourceError: action.error,
      };

    case "preference-start":
      if (
        state.identity !==
        action.identity
      ) {
        return state;
      }

      return {
        ...state,

        preferenceRequest:
          action.request,

        preferencesLoading: true,

        preferenceRefreshing:
          state.hasPreferenceResult,
      };

    case "preference-success":
      if (
        state.identity !== action.identity ||
        state.preferenceRequest !==
          action.request
      ) {
        return state;
      }

      return withRanking(state, {
        snapshot: action.snapshot,

        hasPreferenceResult: true,

        preferencesLoading: false,
        preferenceRefreshing: false,
      });

    default:
      return state;
  }
}

// =====================================================
// usePersonalizedFeed
// =====================================================

/**
 * Coordinates public restaurant candidates and
 * the current account's taste preferences.
 *
 * Public restaurant browsing remains available
 * when personalized recommendations fail.
 *
 * Existing behavior preserved:
 * - Candidate loading
 * - Personalized ranking
 * - Public fallback ranking
 * - Account switching protection
 * - Resource refreshing
 * - Preference refreshing
 * - Request sequencing
 */
export function usePersonalizedFeed({
  feedRepository,
  preferenceRepository,
  userId = null,
  preferenceRevision = 0,
  policy = DEFAULT_RANKING_POLICY,
}) {
  const identity = identityOf(userId);

  const [state, dispatch] = useReducer(
    reducer,
    {
      identity,
      policy,
      feedRepository,
      preferenceRepository,
    },
    initialize
  );

  const [
    resourceRevision,
    reloadResources,
  ] = useReducer(
    (value) => value + 1,
    0
  );

  const [
    preferenceReloadRevision,
    reloadPreferences,
  ] = useReducer(
    (value) => value + 1,
    0
  );

  const resourceSequence = useRef(0);
  const preferenceSequence = useRef(0);

  // =====================================================
  // 1. Synchronize account and repositories
  // =====================================================

  let visibleState = state;

  if (
    state.identity !== identity ||
    state.policy !== policy ||
    state.feedRepository !== feedRepository ||
    state.preferenceRepository !==
      preferenceRepository
  ) {
    const action = {
      type: "configure",
      identity,
      policy,
      feedRepository,
      preferenceRepository,
    };

    visibleState = reducer(
      state,
      action
    );

    dispatch(action);
  }

  // =====================================================
  // 2. Load restaurant and dish candidates
  // =====================================================

  useEffect(() => {
    let active = true;

    const request =
      ++resourceSequence.current;

    dispatch({
      type: "resource-start",
      request,
    });

    Promise.resolve()
      .then(() => {
        if (
          !active ||
          request !==
            resourceSequence.current
        ) {
          return null;
        }

        return feedRepository.getCandidates();
      })
      .then((result) => {
        if (
          !active ||
          request !==
            resourceSequence.current
        ) {
          return;
        }

        if (
          !result ||
          !Array.isArray(result.candidates)
        ) {
          throw new TypeError(
            "Feed repository must return a candidate array."
          );
        }

        // ---------------------------------------------
        // Development diagnostics
        // ---------------------------------------------

        if (__DEV__) {
          if (result.dishError) {
            logFeedError(
              "Dish loading failed",
              result.dishError
            );
          }

          if (
            Array.isArray(result.diagnostics) &&
            result.diagnostics.length > 0
          ) {
            console.warn(
              "[FoodMap Feed] Repository diagnostics:",
              result.diagnostics
            );
          }

          if (
            result.coverage?.complete === false
          ) {
            console.warn(
              "[FoodMap Feed] Dish coverage incomplete."
            );
          }
        }

        dispatch({
          type: "resource-success",
          request,
          result,
        });
      })
      .catch((error) => {
        if (
          active &&
          request ===
            resourceSequence.current
        ) {
          logFeedError(
            "Restaurant or dish candidate request failed",
            error
          );

          dispatch({
            type: "resource-failure",
            request,
            error,
          });
        }
      });

    return () => {
      active = false;
    };
  }, [
    feedRepository,
    resourceRevision,
  ]);

  // =====================================================
  // 3. Load user preferences
  // =====================================================

  useEffect(() => {
    // Signed-out users can browse public candidates.
    if (identity === null) {
      return undefined;
    }

    let active = true;

    const request =
      ++preferenceSequence.current;

    dispatch({
      type: "preference-start",
      identity,
      request,
    });

    Promise.resolve()
      .then(() => {
        if (
          !active ||
          request !==
            preferenceSequence.current
        ) {
          return null;
        }

        return preferenceRepository.getSnapshot({
          userId: identity,
        });
      })
      .then((snapshot) => {
        if (
          !active ||
          request !==
            preferenceSequence.current
        ) {
          return;
        }

        const valid =
          snapshot &&
          snapshot.userId === identity &&
          [
            "empty",
            "ready",
            "unavailable",
          ].includes(snapshot.status);

        if (!valid) {
          throw new Error(
            "Preference snapshot does not belong to the requested account."
          );
        }

        if (
          snapshot.status === "unavailable"
        ) {
          logFeedError(
            "Preference repository returned unavailable status",
            snapshot.error ??
              new Error(
                "Preference data unavailable"
              )
          );
        }

        dispatch({
          type: "preference-success",
          identity,
          request,
          snapshot,
        });
      })
      .catch((error) => {
        if (
          active &&
          request ===
            preferenceSequence.current
        ) {
          logFeedError(
            "Preference loading failed",
            error
          );

          dispatch({
            type: "preference-success",
            identity,
            request,

            snapshot:
              unavailableSnapshot(
                identity,
                error
              ),
          });
        }
      });

    return () => {
      active = false;
    };
  }, [
    identity,
    preferenceRepository,
    preferenceRevision,
    preferenceReloadRevision,
  ]);

  // =====================================================
  // 4. Refresh methods
  // =====================================================

  const refresh = useCallback(() => {
    reloadResources();
    reloadPreferences();
  }, []);

  const refreshPreferences = useCallback(
    () => {
      reloadPreferences();
    },
    []
  );

  const refreshResources = useCallback(
    () => {
      reloadResources();
    },
    []
  );

  // =====================================================
  // 5. Return shared feed state
  // =====================================================

  return {
    // Discover and Wheel share the same candidate pool.
    candidates: visibleState.candidates,
    entries: visibleState.entries,

    loading:
      visibleState.resourceLoading,

    resourceLoading:
      visibleState.resourceLoading,

    refreshing:
      visibleState.resourceRefreshing ||
      visibleState.preferenceRefreshing,

    preferencesLoading:
      visibleState.preferencesLoading,

    preferenceStatus:
      visibleState.snapshot.status,

    preferenceError:
      visibleState.snapshot.error ?? null,

    resourceError:
      visibleState.resourceError,

    dishError:
      visibleState.dishError,

    coverage:
      visibleState.coverage,

    diagnostics:
      visibleState.diagnostics,

    refresh,
    refreshPreferences,
    refreshResources,
  };
}

export default usePersonalizedFeed;