import { act, renderHook, waitFor } from '@testing-library/react-native';
import { createLiveCatalogSources, createLiveAccountSource, resolveCatalogImageUrl } from '../services/liveSources';
import { FeedRepository } from '../services/FeedRepository';
import { UserPreferenceRepository } from '../services/UserPreferenceRepository';
import { rankCandidates } from '../ranking/PreferenceRanker';
import { usePersonalizedFeed } from '../hooks/usePersonalizedFeed';

const origin = 'https://foodmap.example';
const r1 = '111111111111111111111111';
const r2 = '222222222222222222222222';
const d1 = '333333333333333333333333';
const d2 = '444444444444444444444444';
const vector = value => ({ spicy: value, sweet: value, sour: value, salty: value, bitter: value, umami: value });
const restaurants = Object.freeze([
  Object.freeze({ _id: r1, name: 'First place', rating: null, reviewCount: 0,
    imageUrl: '/uploads/restaurant.jpg', imageAuthor: 'Owner', imageLicense: 'CC', address: 'First street' }),
  Object.freeze({ _id: r2, name: 'Second place', rating: 4.5, reviewCount: 20 }),
]);
const dishes = [
  { id: d1, restaurantId: r1, name: 'First dish', averageRating: null, reviewCount: 0,
    imageUrl: '/uploads/dish.jpg', imageAuthor: 'Dish owner', flavorIntensities: vector(0) },
  { id: d2, restaurantId: r2, name: 'Second dish', averageRating: 4, reviewCount: 10,
    flavorIntensities: vector(5) },
];
function publicReaders(overrides = {}) {
  return { getRestaurants: jest.fn().mockResolvedValue(restaurants),
    getDishes: jest.fn().mockResolvedValue(dishes), origin, ...overrides };
}
function preferences(userId, flavorTargets, options = {}) {
  const readSelfProfile = jest.fn().mockResolvedValue({ userId, flavorTargets });
  const accountSource = createLiveAccountSource({ readSelfProfile, userId, token: `token-${userId}`, origin, ...options });
  return { readSelfProfile, accountSource, repository: new UserPreferenceRepository({ accountSource }) };
}
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('live Discover public adapters', () => {
  test('reads each owner once without arguments, preserves restaurants, and maps exact dish parents', async () => {
    const readers = publicReaders();
    const result = await new FeedRepository(createLiveCatalogSources(readers)).getCandidates();
    expect(readers.getRestaurants).toHaveBeenCalledTimes(1);
    expect(readers.getRestaurants).toHaveBeenCalledWith();
    expect(readers.getDishes).toHaveBeenCalledTimes(1);
    expect(readers.getDishes).toHaveBeenCalledWith();
    expect(result.candidates.map(candidate => candidate.restaurant)).toEqual(restaurants);
    expect(result.candidates[0].restaurant).toBe(restaurants[0]);
    expect(result.candidates[0].dishes[0]).toMatchObject({ dishId: d1, restaurantId: r1,
      averageRating: null, reviewCount: 0, imageUrl: `${origin}/uploads/dish.jpg`, imageAuthor: 'Dish owner' });
    expect(result.candidates[0].dishes[0]).not.toHaveProperty('id');
    expect(result.candidates[1].dishes[0].dishId).toBe(d2);
    expect(restaurants[0].imageUrl).toBe('/uploads/restaurant.jpg');
    expect(dishes[0]).not.toHaveProperty('dishId');
    expect(result.coverage).toEqual({ scope: 'candidate-pool', complete: true });
  });

  test('keeps a restaurant with no dishes and skips exact-link orphans', async () => {
    const getDishes = jest.fn().mockResolvedValue([
      dishes[0], { ...dishes[1], restaurantId: '555555555555555555555555' },
    ]);
    const result = await new FeedRepository(createLiveCatalogSources(publicReaders({ getDishes }))).getCandidates();
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[1].dishes).toEqual([]);
    expect(result.diagnostics).toContainEqual({ code: 'orphan-dish', dishId: d2 });
    expect(rankCandidates(result.candidates, { status: 'signed-out' })
      .find(entry => entry.restaurantId === r2).recommendedDish).toBeNull();
  });

  test('dish failure remains a failure and retains public restaurants', async () => {
    const error = new Error('Dish service offline');
    const getDishes = jest.fn().mockRejectedValue(error);
    const result = await new FeedRepository(createLiveCatalogSources(publicReaders({ getDishes }))).getCandidates();
    expect(result.dishError).toBe(error);
    expect(result.coverage).toBeNull();
    expect(result.candidates.map(candidate => candidate.restaurant)).toEqual(restaurants);
    expect(result.candidates.every(candidate => candidate.dishes.length === 0)).toBe(true);
  });

  test.each([
    { items: dishes, nextCursor: 'next' },
    { dishes, coverage: { scope: 'candidate-pool', complete: true }, nextPage: 2 },
  ])('does not mistake an unverified paginated response for a complete list', async payload => {
    const readers = publicReaders({ getDishes: jest.fn().mockResolvedValue(payload) });
    const result = await new FeedRepository(createLiveCatalogSources(readers)).getCandidates();
    expect(result.dishError).toBeInstanceOf(Error);
    expect(result.coverage).toBeNull();
    expect(result.candidates).toHaveLength(2);
  });

  test('marks an explicit partial envelope or partial reader incomplete', async () => {
    const sources = createLiveCatalogSources(publicReaders({ getDishes: async () => ({
      dishes: [dishes[0]], coverage: { scope: 'candidate-pool', complete: false, note: 'First page only' },
    }) }));
    const result = await new FeedRepository(sources).getCandidates();
    expect(result.coverage).toEqual({ scope: 'candidate-pool', complete: false, note: 'First page only' });
    expect(result.diagnostics).toContainEqual({ code: 'incomplete-dish-coverage' });
    expect((await createLiveCatalogSources(publicReaders({ dishReadComplete: false })).dishSource.getDishes())
      .coverage.complete).toBe(false);
  });

  test('a malformed catalog response fails without fixture replacement', async () => {
    const sources = createLiveCatalogSources(publicReaders({ getRestaurants: async () => ({ items: restaurants }) }));
    await expect(new FeedRepository(sources).getCandidates()).rejects.toThrow('bare array');
  });

  test.each([null, undefined, '', '   ', 'file:///secret.jpg', 'data:image/png;base64,a', 'javascript:alert(1)', {}])(
    'uses a missing photo for unusable image %j', value => {
      expect(resolveCatalogImageUrl(value, origin)).toBeNull();
    },
  );

  test('resolves HTTP(S) and relative owner uploads without inventing an origin', () => {
    expect(resolveCatalogImageUrl('/uploads/a.jpg', origin)).toBe(`${origin}/uploads/a.jpg`);
    expect(resolveCatalogImageUrl('uploads/a.jpg', origin)).toBe(`${origin}/uploads/a.jpg`);
    expect(resolveCatalogImageUrl('http://images.example/a.jpg', origin)).toBe('http://images.example/a.jpg');
    expect(resolveCatalogImageUrl('https://images.example/a.jpg')).toBe('https://images.example/a.jpg');
    expect(resolveCatalogImageUrl('/uploads/a.jpg')).toBeNull();
  });

  test('keeps malformed or missing traits as unscored fallback dishes with honest photos', async () => {
    const getDishes = async () => [
      { ...dishes[0], flavorIntensities: { spicy: 1 }, imageUrl: 'file:///tmp/dish.jpg' },
      { ...dishes[1], flavorIntensities: undefined },
    ];
    const result = await new FeedRepository(createLiveCatalogSources(publicReaders({ getDishes }))).getCandidates();
    const ranked = rankCandidates(result.candidates, { status: 'ready', userId: 'a', flavorTargets: vector(0) });
    expect(ranked.every(entry => entry.rankingMode === 'fallback' && entry.recommendedDish !== null)).toBe(true);
    expect(ranked.every(entry => entry.recommendedDish.imageUrl === null)).toBe(true);
    expect(result.diagnostics.filter(item => item.code === 'unscored-dish')).toHaveLength(2);
  });
});

describe('live authenticated numeric profile adapter', () => {
  test('guests call neither the owner self-reader nor the account source', async () => {
    const { repository, readSelfProfile, accountSource } = preferences(null, vector(0));
    expect(await repository.getSnapshot({ userId: null })).toMatchObject({ status: 'signed-out' });
    await expect(accountSource.getPreferences({ userId: null })).rejects.toThrow('signed-in session');
    expect(readSelfProfile).not.toHaveBeenCalled();
  });

  test('an absent numeric self-reader is unavailable', async () => {
    const accountSource = createLiveAccountSource({ userId: 'a', token: 'token-a', origin });
    const repository = new UserPreferenceRepository({ accountSource });
    expect(await repository.getSnapshot({ userId: 'a' })).toMatchObject({ status: 'unavailable' });
  });

// =====================================================
// Reject Invalid or Mismatched Profiles
// =====================================================

test.each([
  {},
  { userId: 'a' },

  { userId: 'a', flavorTargets: {} },
  { userId: 'a', flavorTargets: { spicy: 0 } },

  { userId: 'a', flavorTargets: { ...vector(0), spicy: '0' } },
  { userId: 'a', flavorTargets: { ...vector(0), spicy: null } },
  { userId: 'a', flavorTargets: { ...vector(0), spicy: NaN } },
  { userId: 'a', flavorTargets: { ...vector(0), spicy: Infinity } },

  { userId: 'a', flavorTargets: { ...vector(0), spicy: 6 } },
  { userId: 'a', flavorTargets: { ...vector(0), spicy: -1 } },
  { userId: 'a', flavorTargets: { ...vector(0), extra: 0 } },

  { userId: 'other', flavorTargets: vector(0) },
  { userId: 'other', user: { id: 'a', flavorTargets: vector(0) } },

])('rejects missing, malformed, or mismatched profile %j', async payload => {
  const { repository } = preferences(
    'a',
    vector(0),
    {
      readSelfProfile: async () => payload,
    }
  );

  expect(
    await repository.getSnapshot({
      userId: 'a',
    })
  ).toMatchObject({
    status: 'unavailable',
    flavorTargets: null,
  });
});

// =====================================================
// Support Legacy Accounts Profiles
// =====================================================

// Existing Accounts profiles may contain textual
// foodPreferences or favoriteCuisines without
// a six-dimensional numeric flavorTargets vector.
//
// These profiles should use fallback recommendations,
// rather than being treated as invalid accounts.

  test.each([
    {
      userId: 'a',
      foodPreferences: ['spicy'],
    },

    {
      user: {
        id: 'a',
        foodPreferences: ['sweet'],
      },
    },

    {
      userId: 'a',
      favoriteCuisines: ['Japanese'],
    },

    {
      user: {
        id: 'a',
        favoriteCuisines: ['Chinese'],
      },
    },

  ])('supports legacy Accounts profiles without numeric preferences %j', async payload => {
    const { repository } = preferences(
      'a',
      vector(0),
      {
        readSelfProfile: async () => payload,
      }
    );

    expect(
      await repository.getSnapshot({
        userId: 'a',
      })
    ).toMatchObject({
      status: 'empty',
      flavorTargets: null,
    });
  });

  test('only explicit null is empty, while all zero and Accounts envelope profiles are ready', async () => {
    expect(await preferences('a', null).repository.getSnapshot({ userId: 'a' }))
      .toMatchObject({ status: 'empty', flavorTargets: null });
    expect(await preferences('a', vector(0)).repository.getSnapshot({ userId: 'a' }))
      .toMatchObject({ status: 'ready', flavorTargets: vector(0) });
    const { repository } = preferences('a', null, {
      readSelfProfile: async () => ({ message: 'Profile retrieved', user: { id: 'a', flavorTargets: vector(5) } }),
    });
    expect(await repository.getSnapshot({ userId: 'a' })).toMatchObject({ status: 'ready', flavorTargets: vector(5) });
  });

  test('two authenticated profiles receive their own token and rank the same public pool differently', async () => {
    const { candidates } = await new FeedRepository(createLiveCatalogSources(publicReaders())).getCandidates();
    const a = preferences('a', vector(0));
    const b = preferences('b', vector(5));
    const aSnapshot = await a.repository.getSnapshot({ userId: 'a' });
    const bSnapshot = await b.repository.getSnapshot({ userId: 'b' });
    expect(rankCandidates(candidates, aSnapshot)[0].restaurantId).toBe(r1);
    expect(rankCandidates(candidates, bSnapshot)[0].restaurantId).toBe(r2);
    expect(a.readSelfProfile).toHaveBeenCalledWith({ token: 'token-a', origin, signal: expect.any(Object) });
    expect(b.readSelfProfile).toHaveBeenCalledWith({ token: 'token-b', origin, signal: expect.any(Object) });
    expect(a.readSelfProfile.mock.calls[0][0]).not.toHaveProperty('userId');
  });

  test('current-session 401 delegates once; obsolete and aborted 401s cannot expire a new account', async () => {
    const unauthorized = Object.assign(new Error('Expired'), { status: 401 });
    const onSessionExpired = jest.fn();
    const current = preferences('a', null, { readSelfProfile: async () => { throw unauthorized; }, onSessionExpired });
    expect(await current.repository.getSnapshot({ userId: 'a' })).toMatchObject({ status: 'unavailable' });
    expect(onSessionExpired).toHaveBeenCalledTimes(1);

    const pending = deferred();
    let isCurrent = true;
    const old = preferences('a', null, { readSelfProfile: () => pending.promise,
      isCurrentSession: () => isCurrent, onSessionExpired });
    const request = old.repository.getSnapshot({ userId: 'a' });
    isCurrent = false;
    pending.reject(unauthorized);
    expect(await request).toMatchObject({ status: 'unavailable', error: { name: 'AbortError' } });
    expect(onSessionExpired).toHaveBeenCalledTimes(1);

    const abortable = deferred();
    const source = preferences('a', null, { readSelfProfile: () => abortable.promise, onSessionExpired });
    const aborted = source.repository.getSnapshot({ userId: 'a' });
    source.accountSource.cancelPending();
    abortable.reject(unauthorized);
    expect(await aborted).toMatchObject({ error: { name: 'AbortError' } });
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  test('cancellation aborts the owner signal and leaves the source usable for a later read', async () => {
    const pending = deferred();
    const readSelfProfile = jest.fn().mockImplementationOnce(() => pending.promise)
      .mockResolvedValueOnce({ userId: 'a', flavorTargets: vector(0) });
    const { accountSource } = preferences('a', null, { readSelfProfile });
    const request = accountSource.getPreferences({ userId: 'a' });
    accountSource.cancelPending();
    expect(readSelfProfile.mock.calls[0][0].signal.aborted).toBe(true);
    pending.resolve({ userId: 'a', flavorTargets: vector(5) });
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    await expect(accountSource.getPreferences({ userId: 'a' })).resolves.toEqual({ userId: 'a', flavorTargets: vector(0) });
  });

  test('a preference-only refresh reranks without bulk catalog calls; full refresh reads each source once', async () => {
    const readers = publicReaders();
    const feedRepository = new FeedRepository(createLiveCatalogSources(readers));
    const readSelfProfile = jest.fn().mockResolvedValueOnce({ userId: 'a', flavorTargets: vector(0) })
      .mockResolvedValue({ userId: 'a', flavorTargets: vector(5) });
    const { repository: preferenceRepository } = preferences('a', null, { readSelfProfile });
    const { result } = renderHook(() => usePersonalizedFeed({ feedRepository, preferenceRepository, userId: 'a' }));
    await waitFor(() => expect(result.current.entries[0]?.restaurantId).toBe(r1));
    act(() => result.current.refreshPreferences());
    await waitFor(() => expect(result.current.entries[0]?.restaurantId).toBe(r2));
    expect(readers.getRestaurants).toHaveBeenCalledTimes(1);
    expect(readers.getDishes).toHaveBeenCalledTimes(1);
    act(() => result.current.refresh());
    await waitFor(() => expect(readers.getRestaurants).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.refreshing).toBe(false));
    expect(readers.getDishes).toHaveBeenCalledTimes(2);
    expect(readSelfProfile).toHaveBeenCalledTimes(3);
  });
});
