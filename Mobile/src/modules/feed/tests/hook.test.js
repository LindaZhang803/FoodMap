import { act, renderHook, waitFor } from '@testing-library/react-native';
import { usePersonalizedFeed } from '../hooks/usePersonalizedFeed';

const vector = (value) => ({ spicy: value, sweet: value, sour: value, salty: value, bitter: value, umami: value });
const snapshot = (userId, value) => ({ userId, status: 'ready', flavorTargets: vector(value), error: null });
const pool = [
  {
    restaurantId: 'neutral',
    restaurant: { _id: 'neutral', name: 'Neutral Place', rating: 4, reviewCount: 5 },
    dishes: [{ dishId: 'neutral-dish', restaurantId: 'neutral', name: 'Neutral Dish',
      averageRating: 4, reviewCount: 2, flavorIntensities: vector(0) }],
  },
  {
    restaurantId: 'intense',
    restaurant: { _id: 'intense', name: 'Intense Place', rating: 5, reviewCount: 100 },
    dishes: [{ dishId: 'intense-dish', restaurantId: 'intense', name: 'Intense Dish',
      averageRating: 5, reviewCount: 20, flavorIntensities: vector(5) }],
  },
];
const resources = (candidates = pool, overrides = {}) => ({
  candidates, coverage: { complete: true }, diagnostics: [], dishError: null, ...overrides,
});
const ids = (result) => result.entries.map((entry) => entry.restaurantId);
const modes = (result) => result.entries.map((entry) => entry.rankingMode);
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
async function flush() {
  await act(async () => { await Promise.resolve(); });
}

describe('usePersonalizedFeed', () => {
  test('starts independent catalog and preference loads concurrently and publishes scored order', async () => {
    const catalog = deferred();
    const preferences = deferred();
    const feedRepository = { getCandidates: jest.fn(() => catalog.promise) };
    const preferenceRepository = { getSnapshot: jest.fn(() => preferences.promise) };
    const { result } = renderHook(() => usePersonalizedFeed({ feedRepository, preferenceRepository, userId: 'a' }));
    await flush();
    expect(feedRepository.getCandidates).toHaveBeenCalledTimes(1);
    expect(preferenceRepository.getSnapshot).toHaveBeenCalledWith({ userId: 'a' });
    expect(result.current.loading).toBe(true);
    expect(result.current.preferencesLoading).toBe(true);
    await act(async () => { preferences.resolve(snapshot('a', 0)); });
    expect(result.current.loading).toBe(true);
    expect(result.current.preferencesLoading).toBe(false);
    await act(async () => { catalog.resolve(resources()); });
    expect(ids(result.current)).toEqual(['neutral', 'intense']);
    expect(result.current.entries.map((entry) => entry.preferenceScore)).toEqual([100, 0]);
    expect(result.current.preferenceStatus).toBe('ready');
    expect(result.current.coverage).toEqual({ complete: true });
  });

  test('signed-out browsing makes no account request and ranks the public pool', async () => {
    const feedRepository = { getCandidates: jest.fn().mockResolvedValue(resources()) };
    const preferenceRepository = { getSnapshot: jest.fn() };
    const { result } = renderHook(() => usePersonalizedFeed({ feedRepository, preferenceRepository }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(preferenceRepository.getSnapshot).not.toHaveBeenCalled();
    expect(result.current.preferenceStatus).toBe('signed-out');
    expect(ids(result.current)).toEqual(['intense', 'neutral']);
    expect(modes(result.current)).toEqual(['fallback', 'fallback']);
  });

  test('preference revision reranks cached candidates without refetching catalog', async () => {
    const feedRepository = { getCandidates: jest.fn().mockResolvedValue(resources()) };
    const preferenceRepository = { getSnapshot: jest.fn()
      .mockResolvedValueOnce(snapshot('a', 0)).mockResolvedValueOnce(snapshot('a', 5)) };
    const { result, rerender } = renderHook(({ revision }) => usePersonalizedFeed({
      feedRepository, preferenceRepository, userId: 'a', preferenceRevision: revision,
    }), { initialProps: { revision: 0 } });
    await waitFor(() => expect(ids(result.current)).toEqual(['neutral', 'intense']));
    rerender({ revision: 1 });
    await waitFor(() => expect(ids(result.current)).toEqual(['intense', 'neutral']));
    expect(feedRepository.getCandidates).toHaveBeenCalledTimes(1);
    expect(preferenceRepository.getSnapshot).toHaveBeenCalledTimes(2);
    expect(modes(result.current)).toEqual(['personalized', 'personalized']);
  });

  test('the first account-switch render removes previous personalized order before effects run', async () => {
    const pendingB = deferred();
    const observed = [];
    const feedRepository = { getCandidates: jest.fn().mockResolvedValue(resources()) };
    const preferenceRepository = { getSnapshot: jest.fn(({ userId }) =>
      userId === 'a' ? Promise.resolve(snapshot('a', 0)) : pendingB.promise) };
    const { result, rerender } = renderHook(({ userId }) => {
      const value = usePersonalizedFeed({ feedRepository, preferenceRepository, userId });
      observed.push({ userId, ids: ids(value), modes: modes(value), status: value.preferenceStatus });
      return value;
    }, { initialProps: { userId: 'a' } });
    await waitFor(() => expect(ids(result.current)).toEqual(['neutral', 'intense']));
    observed.length = 0;
    rerender({ userId: 'b' });
    expect(observed[0]).toEqual({ userId: 'b', ids: ['intense', 'neutral'],
      modes: ['fallback', 'fallback'], status: 'loading' });
    await act(async () => { pendingB.resolve(snapshot('b', 5)); });
    expect(result.current.preferenceStatus).toBe('ready');
    expect(feedRepository.getCandidates).toHaveBeenCalledTimes(1);
  });

  test('logout immediately returns public fallback and ignores a pending account refresh', async () => {
    const refreshA = deferred();
    const observed = [];
    const feedRepository = { getCandidates: jest.fn().mockResolvedValue(resources()) };
    const preferenceRepository = { getSnapshot: jest.fn()
      .mockResolvedValueOnce(snapshot('a', 0)).mockImplementationOnce(() => refreshA.promise) };
    const { result, rerender } = renderHook(({ userId }) => {
      const value = usePersonalizedFeed({ feedRepository, preferenceRepository, userId });
      observed.push({ userId, ids: ids(value), modes: modes(value), status: value.preferenceStatus });
      return value;
    }, { initialProps: { userId: 'a' } });
    await waitFor(() => expect(ids(result.current)).toEqual(['neutral', 'intense']));
    act(() => result.current.refreshPreferences());
    await flush();
    observed.length = 0;
    rerender({ userId: null });
    expect(observed[0]).toEqual({ userId: null, ids: ['intense', 'neutral'],
      modes: ['fallback', 'fallback'], status: 'signed-out' });
    await act(async () => { refreshA.resolve(snapshot('a', 0)); });
    expect(ids(result.current)).toEqual(['intense', 'neutral']);
    expect(result.current.preferenceStatus).toBe('signed-out');
    expect(preferenceRepository.getSnapshot).toHaveBeenCalledTimes(2);
  });

  test('out-of-order account responses cannot overwrite the current user', async () => {
    const a = deferred();
    const b = deferred();
    const feedRepository = { getCandidates: jest.fn().mockResolvedValue(resources()) };
    const preferenceRepository = { getSnapshot: jest.fn(({ userId }) => userId === 'a' ? a.promise : b.promise) };
    const { result, rerender } = renderHook(({ userId }) => usePersonalizedFeed({
      feedRepository, preferenceRepository, userId,
    }), { initialProps: { userId: 'a' } });
    await flush();
    rerender({ userId: 'b' });
    await flush();
    await act(async () => { b.resolve(snapshot('b', 5)); });
    expect(ids(result.current)).toEqual(['intense', 'neutral']);
    await act(async () => { a.resolve(snapshot('a', 0)); });
    expect(ids(result.current)).toEqual(['intense', 'neutral']);
    expect(modes(result.current)).toEqual(['personalized', 'personalized']);
  });

  test('mismatched preference identity degrades to unavailable fallback', async () => {
    const feedRepository = { getCandidates: jest.fn().mockResolvedValue(resources()) };
    const preferenceRepository = { getSnapshot: jest.fn().mockResolvedValue(snapshot('another-user', 0)) };
    const { result } = renderHook(() => usePersonalizedFeed({ feedRepository, preferenceRepository, userId: 'a' }));
    await waitFor(() => expect(result.current.preferenceStatus).toBe('unavailable'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(modes(result.current)).toEqual(['fallback', 'fallback']);
    expect(result.current.preferenceError).toBeInstanceOf(Error);
  });

  test('same-account preference refresh retains useful entries while pending, then removes personalization on failure', async () => {
    const preferenceRefresh = deferred();
    const error = new Error('Account temporarily unavailable');
    const feedRepository = { getCandidates: jest.fn().mockResolvedValue(resources()) };
    const preferenceRepository = { getSnapshot: jest.fn()
      .mockResolvedValueOnce(snapshot('a', 0)).mockImplementationOnce(() => preferenceRefresh.promise) };
    const { result } = renderHook(() => usePersonalizedFeed({ feedRepository, preferenceRepository, userId: 'a' }));
    await waitFor(() => expect(ids(result.current)).toEqual(['neutral', 'intense']));
    act(() => result.current.refreshPreferences());
    expect(result.current.refreshing).toBe(true);
    expect(ids(result.current)).toEqual(['neutral', 'intense']);
    await act(async () => { preferenceRefresh.reject(error); });
    expect(result.current.preferenceStatus).toBe('unavailable');
    expect(result.current.preferenceError).toBe(error);
    expect(ids(result.current)).toEqual(['intense', 'neutral']);
    expect(modes(result.current)).toEqual(['fallback', 'fallback']);
    expect(result.current.refreshing).toBe(false);
    expect(feedRepository.getCandidates).toHaveBeenCalledTimes(1);
  });

  test('newer resource refresh wins and a failed refresh retains the useful list', async () => {
    const oldCatalog = deferred();
    const newCatalog = deferred();
    const error = new Error('Catalog unavailable');
    const feedRepository = { getCandidates: jest.fn()
      .mockImplementationOnce(() => oldCatalog.promise)
      .mockImplementationOnce(() => newCatalog.promise)
      .mockRejectedValueOnce(error) };
    const { result } = renderHook(() => usePersonalizedFeed({ feedRepository }));
    await flush();
    act(() => result.current.refreshResources());
    await flush();
    await act(async () => { newCatalog.resolve(resources([pool[1]])); });
    await act(async () => { oldCatalog.resolve(resources([pool[0]])); });
    expect(ids(result.current)).toEqual(['intense']);
    act(() => result.current.refreshResources());
    expect(result.current.refreshing).toBe(true);
    expect(ids(result.current)).toEqual(['intense']);
    await waitFor(() => expect(result.current.resourceError).toBe(error));
    expect(ids(result.current)).toEqual(['intense']);
    expect(result.current.refreshing).toBe(false);
  });

  test('empty catalog, catalog failure, and no-dish degradation remain distinct', async () => {
    const feedRepository = { getCandidates: jest.fn().mockResolvedValueOnce(resources([]))
      .mockRejectedValueOnce(new Error('Real catalog failure'))
      .mockResolvedValueOnce(resources(pool.map((candidate) => ({ ...candidate, dishes: [] })), {
        dishError: new Error('Dish source failed'),
      })) };
    const { result } = renderHook(() => usePersonalizedFeed({ feedRepository }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entries).toEqual([]);
    expect(result.current.resourceError).toBeNull();
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.resourceError).toBeInstanceOf(Error));
    expect(result.current.entries).toEqual([]);
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.entries).toHaveLength(2));
    expect(result.current.resourceError).toBeNull();
    expect(result.current.dishError).toBeInstanceOf(Error);
    expect(result.current.entries.every((entry) => entry.recommendedDish === null)).toBe(true);
    expect(modes(result.current)).toEqual(['fallback', 'fallback']);
  });

  test('a newer preference revision wins even when the old same-user request resolves last', async () => {
    const first = deferred();
    const second = deferred();
    const feedRepository = { getCandidates: jest.fn().mockResolvedValue(resources()) };
    const preferenceRepository = { getSnapshot: jest.fn()
      .mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise) };
    const { result, rerender } = renderHook(({ revision }) => usePersonalizedFeed({
      feedRepository, preferenceRepository, userId: 'a', preferenceRevision: revision,
    }), { initialProps: { revision: 0 } });
    await flush();
    rerender({ revision: 1 });
    await flush();
    await act(async () => { second.resolve(snapshot('a', 5)); });
    await act(async () => { first.resolve(snapshot('a', 0)); });
    expect(ids(result.current)).toEqual(['intense', 'neutral']);
    expect(result.current.entries[0].preferenceScore).toBe(100);
  });

  test('changing resource source clears the old source before render and never turns real failure into demo success', async () => {
    const failedRead = deferred();
    const demo = { getCandidates: jest.fn().mockResolvedValue(resources()) };
    const real = { getCandidates: jest.fn(() => failedRead.promise) };
    const observed = [];
    const { result, rerender } = renderHook(({ feedRepository }) => {
      const value = usePersonalizedFeed({ feedRepository });
      observed.push({ ids: ids(value), loading: value.loading });
      return value;
    }, { initialProps: { feedRepository: demo } });
    await waitFor(() => expect(result.current.entries).toHaveLength(2));
    observed.length = 0;
    rerender({ feedRepository: real });
    expect(observed[0]).toEqual({ ids: [], loading: true });
    const error = new Error('Real source offline');
    await act(async () => { failedRead.reject(error); });
    expect(result.current.entries).toEqual([]);
    expect(result.current.resourceError).toBe(error);
    expect(result.current.coverage).toBeNull();
  });

  test('changing preference source clears same-account personalization before the replacement read', async () => {
    const replacement = deferred();
    const feedRepository = { getCandidates: jest.fn().mockResolvedValue(resources()) };
    const oldPreferences = { getSnapshot: jest.fn().mockResolvedValue(snapshot('a', 0)) };
    const newPreferences = { getSnapshot: jest.fn(() => replacement.promise) };
    const observed = [];
    const { result, rerender } = renderHook(({ preferenceRepository }) => {
      const value = usePersonalizedFeed({ feedRepository, preferenceRepository, userId: 'a' });
      observed.push({ ids: ids(value), modes: modes(value), status: value.preferenceStatus });
      return value;
    }, { initialProps: { preferenceRepository: oldPreferences } });
    await waitFor(() => expect(ids(result.current)).toEqual(['neutral', 'intense']));
    observed.length = 0;
    rerender({ preferenceRepository: newPreferences });
    expect(observed[0]).toEqual({ ids: ['intense', 'neutral'], modes: ['fallback', 'fallback'], status: 'loading' });
    await act(async () => { replacement.reject(new Error('Account source unavailable')); });
    expect(result.current.preferenceStatus).toBe('unavailable');
    expect(modes(result.current)).toEqual(['fallback', 'fallback']);
    expect(feedRepository.getCandidates).toHaveBeenCalledTimes(1);
  });

  test('pending requests settling after unmount do not publish another hook render', async () => {
    const catalog = deferred();
    const preferences = deferred();
    let renders = 0;
    const feedRepository = { getCandidates: jest.fn(() => catalog.promise) };
    const preferenceRepository = { getSnapshot: jest.fn(() => preferences.promise) };
    const { unmount } = renderHook(() => {
      renders += 1;
      return usePersonalizedFeed({ feedRepository, preferenceRepository, userId: 'a' });
    });
    await flush();
    unmount();
    const before = renders;
    await act(async () => { catalog.resolve(resources()); preferences.resolve(snapshot('a', 0)); });
    expect(renders).toBe(before);
  });
});
