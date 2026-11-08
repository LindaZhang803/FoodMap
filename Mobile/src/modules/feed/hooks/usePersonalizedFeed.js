import { useCallback, useEffect, useReducer, useRef } from 'react';
import { rankCandidates } from '../ranking/PreferenceRanker';
import { DEFAULT_RANKING_POLICY } from '../ranking/rankingPolicy';

const identityOf = (userId) => userId == null || userId === '' ? null : userId;

function initialSnapshot(identity) {
  return {
    userId: identity,
    status: identity === null ? 'signed-out' : 'loading',
    flavorTargets: null,
    error: null,
  };
}

function unavailableSnapshot(identity, error) {
  return { userId: identity, status: 'unavailable', flavorTargets: null, error };
}

function withRanking(state, updates) {
  const next = { ...state, ...updates };
  return { ...next, entries: rankCandidates(next.candidates, next.snapshot, next.policy) };
}

function initialize({ identity, policy, feedRepository, preferenceRepository }) {
  return {
    identity, policy, feedRepository, preferenceRepository,
    candidates: [], entries: [], snapshot: initialSnapshot(identity),
    resourceRequest: null, preferenceRequest: null,
    hasResourceResult: false, hasPreferenceResult: identity === null,
    resourceLoading: true, resourceRefreshing: false,
    preferencesLoading: identity !== null, preferenceRefreshing: false,
    resourceError: null, dishError: null, coverage: null, diagnostics: [],
  };
}

function reducer(state, action) {
  switch (action.type) {
    case 'configure': {
      const accountChanged = state.identity !== action.identity;
      const resourceSourceChanged = state.feedRepository !== action.feedRepository;
      const preferenceSourceChanged = state.preferenceRepository !== action.preferenceRepository;
      return withRanking(state, {
        identity: action.identity,
        policy: action.policy,
        feedRepository: action.feedRepository,
        preferenceRepository: action.preferenceRepository,
        ...(resourceSourceChanged ? {
          candidates: [], resourceRequest: null, hasResourceResult: false,
          resourceLoading: true, resourceRefreshing: false,
          resourceError: null, dishError: null, coverage: null, diagnostics: [],
        } : {}),
        ...(accountChanged || preferenceSourceChanged ? {
          snapshot: initialSnapshot(action.identity), preferenceRequest: null,
          hasPreferenceResult: action.identity === null,
          preferencesLoading: action.identity !== null, preferenceRefreshing: false,
        } : {}),
      });
    }
    case 'resource-start':
      return { ...state, resourceRequest: action.request,
        resourceLoading: !state.hasResourceResult, resourceRefreshing: state.hasResourceResult,
        resourceError: null };
    case 'resource-success':
      if (state.resourceRequest !== action.request) return state;
      return withRanking(state, {
        candidates: action.result.candidates, hasResourceResult: true,
        resourceLoading: false, resourceRefreshing: false, resourceError: null,
        dishError: action.result.dishError ?? null, coverage: action.result.coverage ?? null,
        diagnostics: action.result.diagnostics ?? [],
      });
    case 'resource-failure':
      if (state.resourceRequest !== action.request) return state;
      return { ...state, resourceLoading: false, resourceRefreshing: false, resourceError: action.error };
    case 'preference-start':
      if (state.identity !== action.identity) return state;
      return { ...state, preferenceRequest: action.request, preferencesLoading: true,
        preferenceRefreshing: state.hasPreferenceResult };
    case 'preference-success':
      if (state.identity !== action.identity || state.preferenceRequest !== action.request) return state;
      return withRanking(state, { snapshot: action.snapshot, hasPreferenceResult: true,
        preferencesLoading: false, preferenceRefreshing: false });
    default:
      return state;
  }
}

/**
 * Coordinates a public candidate pool and one current account's preferences.
 * preferenceRevision reloads only preferences and reranks cached candidates.
 * refresh retries both boundaries; refreshPreferences retries only the account.
 * Initial preferenceStatus can be 'loading'; settled statuses match the repository.
 * Catalog refresh failures retain useful entries and expose resourceError.
 * Preference failures replace personalized ranking with public fallback.
 */
export function usePersonalizedFeed({
  feedRepository, preferenceRepository, userId = null, preferenceRevision = 0,
  policy = DEFAULT_RANKING_POLICY,
}) {
  const identity = identityOf(userId);
  const [state, dispatch] = useReducer(reducer,
    { identity, policy, feedRepository, preferenceRepository }, initialize);
  const [resourceRevision, reloadResources] = useReducer((value) => value + 1, 0);
  const [preferenceReloadRevision, reloadPreferences] = useReducer((value) => value + 1, 0);
  const resourceSequence = useRef(0);
  const preferenceSequence = useRef(0);

  // Synchronize before publishing this render. An effect-only reset can expose
  // the previous account's personalized order for one render after logout/switch.
  let visibleState = state;
  if (state.identity !== identity || state.policy !== policy
      || state.feedRepository !== feedRepository || state.preferenceRepository !== preferenceRepository) {
    const action = { type: 'configure', identity, policy, feedRepository, preferenceRepository };
    visibleState = reducer(state, action);
    dispatch(action);
  }

  useEffect(() => {
    let active = true;
    const request = ++resourceSequence.current;
    dispatch({ type: 'resource-start', request });
    Promise.resolve()
      .then(() => {
        if (!active || request !== resourceSequence.current) return null;
        return feedRepository.getCandidates();
      })
      .then((result) => {
        if (!active || request !== resourceSequence.current) return;
        if (!result || !Array.isArray(result.candidates)) {
          throw new TypeError('Feed repository must return a candidate array.');
        }
        if (active && request === resourceSequence.current) {
          dispatch({ type: 'resource-success', request, result });
        }
      })
      .catch((error) => {
        if (active && request === resourceSequence.current) {
          dispatch({ type: 'resource-failure', request, error });
        }
      });
    return () => { active = false; };
  }, [feedRepository, resourceRevision]);

  useEffect(() => {
    // Public browsing neither requires an account repository nor calls it.
    if (identity === null) return undefined;
    let active = true;
    const request = ++preferenceSequence.current;
    dispatch({ type: 'preference-start', identity, request });
    Promise.resolve()
      .then(() => {
        if (!active || request !== preferenceSequence.current) return null;
        return preferenceRepository.getSnapshot({ userId: identity });
      })
      .then((snapshot) => {
        if (!active || request !== preferenceSequence.current) return;
        if (!snapshot || snapshot.userId !== identity || !['empty', 'ready', 'unavailable'].includes(snapshot.status)) {
          throw new Error('Preference snapshot does not belong to the requested account.');
        }
        if (active && request === preferenceSequence.current) {
          dispatch({ type: 'preference-success', identity, request, snapshot });
        }
      })
      .catch((error) => {
        if (active && request === preferenceSequence.current) {
          dispatch({ type: 'preference-success', identity, request,
            snapshot: unavailableSnapshot(identity, error) });
        }
      });
    return () => { active = false; };
  }, [identity, preferenceRepository, preferenceRevision, preferenceReloadRevision]);

  const refresh = useCallback(() => { reloadResources(); reloadPreferences(); }, []);
  const refreshPreferences = useCallback(() => { reloadPreferences(); }, []);
  const refreshResources = useCallback(() => { reloadResources(); }, []);

  return {
    // Discover and Wheel share this complete linked pool, not only winning dishes.
    candidates: visibleState.candidates,
    entries: visibleState.entries,
    loading: visibleState.resourceLoading,
    resourceLoading: visibleState.resourceLoading,
    refreshing: visibleState.resourceRefreshing || visibleState.preferenceRefreshing,
    preferencesLoading: visibleState.preferencesLoading,
    preferenceStatus: visibleState.snapshot.status,
    preferenceError: visibleState.snapshot.error ?? null,
    resourceError: visibleState.resourceError,
    dishError: visibleState.dishError,
    coverage: visibleState.coverage,
    diagnostics: visibleState.diagnostics,
    refresh, refreshPreferences, refreshResources,
  };
}

export default usePersonalizedFeed;
