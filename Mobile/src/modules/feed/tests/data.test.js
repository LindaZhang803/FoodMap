import { isValidFlavorVector } from '../contracts';
import { FeedRepository, createRestaurantSource } from '../services/FeedRepository';
import { UserPreferenceRepository } from '../services/UserPreferenceRepository';
import { rankCandidates, scoreDish } from '../ranking/PreferenceRanker';
import { DEFAULT_RANKING_POLICY } from '../ranking/rankingPolicy';
import { createMockSources } from '../mocks/sources';
import { MOCK_RESTAURANTS, NEUTRAL_TARGETS, USER_A_TARGETS, USER_B_TARGETS } from '../mocks/fixtures';

const all = (intensity) => ({ spicy: intensity, sweet: intensity, sour: intensity, salty: intensity, bitter: intensity, umami: intensity });
const profile = (flavorTargets = NEUTRAL_TARGETS) => ({ status: 'ready', userId: 'user', flavorTargets, error: null });
const restaurant = (_id, rating = null, reviewCount = 0) => ({ _id, name: _id, rating, reviewCount });
const dish = (dishId, restaurantId, flavorIntensities = NEUTRAL_TARGETS, averageRating = null, reviewCount = 0) =>
  ({ dishId, restaurantId, name: dishId, flavorIntensities, averageRating, reviewCount });
const candidate = (item, dishes = []) => ({ restaurantId: item._id, restaurant: item, dishes });
const freeze = (value) => {
  Object.freeze(value);
  Object.values(value).forEach((child) => {
    if (child && typeof child === 'object' && !Object.isFrozen(child)) freeze(child);
  });
  return value;
};
const coverage = { scope: 'candidate-pool', complete: true };

describe('pure numeric ranking', () => {
  test('scores target similarity exactly, including a real zero and complete neutral vector', () => {
    expect(scoreDish(USER_A_TARGETS, USER_A_TARGETS)).toBe(100);
    expect(scoreDish({ ...USER_A_TARGETS, spicy: 1, sweet: 4 }, USER_A_TARGETS)).toBe(80);
    expect(scoreDish(all(0), all(0))).toBe(100);
    expect(scoreDish(all(5), all(0))).toBe(0);
    expect(scoreDish(all(1), all(0))).toBeGreaterThan(scoreDish(all(3), all(0)));
  });

  test.each([
    null, {}, { ...all(0), spicy: undefined }, { ...all(0), spicy: null },
    { ...all(0), spicy: '0' }, { ...all(0), spicy: NaN }, { ...all(0), spicy: Infinity },
    { ...all(0), spicy: -1 }, { ...all(0), spicy: 6 }, { ...all(0), savory: 0 },
  ])('keeps malformed vector %j unscored without coercion', (vector) => {
    expect(isValidFlavorVector(vector)).toBe(false);
    expect(scoreDish(vector, all(0))).toBeNull();
    expect(scoreDish(all(0), vector)).toBeNull();
  });

  test('uses independently validated configurable weights', () => {
    const policy = { weights: { ...DEFAULT_RANKING_POLICY.weights, spicy: 5 } };
    expect(scoreDish({ ...all(0), spicy: 5 }, all(0), policy)).toBe(50);
    expect(() => scoreDish(all(0), all(0), { weights: { spicy: 1 } })).toThrow();
    expect(() => scoreDish(all(0), all(0), { weights: { ...policy.weights, sweet: '1' } })).toThrow();
    expect(() => scoreDish(all(0), all(0), { weights: { ...policy.weights, spicy: 0 } })).toThrow();
    const huge = { weights: Object.fromEntries(Object.keys(all(0)).map((key) => [key, 1e300])) };
    expect(scoreDish(all(5), all(0), huge)).toBe(0);
  });

  test('selects the maximum actual owned dish without summing a bigger menu', () => {
    const winner = dish('best', 'one', all(0), 4, 2);
    const pool = freeze([
      candidate(restaurant('one', 4, 5), [dish('other', 'one', all(5)), winner]),
      candidate(restaurant('two', 5, 50), [dish('a', 'two', all(1)), dish('b', 'two', all(1)), dish('foreign', 'one', all(0))]),
    ]);
    const result = rankCandidates(pool, profile());
    expect(result.map((entry) => entry.restaurantId)).toEqual(['one', 'two']);
    expect(result[0].recommendedDish).toBe(winner);
    expect(result[0].restaurant).toBe(pool[0].restaurant);
    expect(result[0].preferenceScore).toBe(100);
    expect(result[1].preferenceScore).toBe(80);
    expect(rankCandidates(pool, profile())).toEqual(result);
    expect(result).not.toBe(pool);
  });

  test('breaks equal dish scores by dish rating, review count, then stable dish ID', () => {
    const pool = [candidate(restaurant('one'), [
      dish('low-rating', 'one', all(0), 4, 500), dish('low-count', 'one', all(0), 5, 1),
      dish('z', 'one', all(0), 5, 2), dish('a', 'one', all(0), 5, 2),
    ])];
    expect(rankCandidates(pool, profile())[0].recommendedDish.dishId).toBe('a');
  });

  test('breaks restaurant score ties by rating, count, then ID', () => {
    const pool = [restaurant('low-rating', 4, 500), restaurant('low-count', 5, 1), restaurant('z', 5, 2), restaurant('a', 5, 2)]
      .map((item) => candidate(item, [dish(`dish-${item._id}`, item._id)]));
    expect(rankCandidates(pool, profile()).map((entry) => entry.restaurantId)).toEqual(['a', 'z', 'low-count', 'low-rating']);
  });

  test('zero similarity stays personalized before fallback and no-dish restaurants remain visible', () => {
    const pool = [candidate(restaurant('no-dish', 5, 500)), candidate(restaurant('zero'), [dish('max', 'zero', all(5))])];
    const result = rankCandidates(pool, profile());
    expect(result[0]).toMatchObject({ restaurantId: 'zero', preferenceScore: 0, rankingMode: 'personalized' });
    expect(result[1]).toMatchObject({ restaurantId: 'no-dish', preferenceScore: null, recommendedDish: null, rankingMode: 'fallback' });
    expect(rankCandidates([pool[0]], profile())).toHaveLength(1);
  });

  test('fallback orders by restaurant count then rating and chooses popular owned dish', () => {
    const popular = dish('popular', 'popular', { spicy: 1 }, null, 50);
    const pool = [
      candidate(restaurant('high-rating', 5, 2)),
      candidate(restaurant('popular', 3, 20), [dish('rated', 'popular', all(0), 5, 2), popular]),
    ];
    const result = rankCandidates(pool, { status: 'empty', flavorTargets: null });
    expect(result.map((entry) => entry.restaurantId)).toEqual(['popular', 'high-rating']);
    expect(result[0].recommendedDish).toBe(popular);
    expect(result.every((entry) => entry.rankingMode === 'fallback' && entry.preferenceScore === null)).toBe(true);
  });

  test('zero reviews are unrated while a reviewed numeric rating zero remains known', () => {
    const pool = [candidate(restaurant('z', 5, 0), [dish('z', 'z', all(0), 5, 0)]),
      candidate(restaurant('a', 0, 1), [dish('a', 'a', all(0), 0, 1)])];
    expect(rankCandidates(pool, profile()).map((entry) => entry.restaurantId)).toEqual(['a', 'z']);
    const equal = [candidate(restaurant('r'), [dish('z', 'r', all(0), 5, 0), dish('a', 'r', all(0), null, 0)])];
    expect(rankCandidates(equal, profile())[0].recommendedDish.dishId).toBe('a');
  });
});

describe('repository boundaries and synthetic sources', () => {
  test('joins exact IDs, deduplicates, diagnoses orphans, and preserves shared card objects', async () => {
    const item = freeze({ ...restaurant('r', 4, 1), imageUrl: 'https://example.test/a.jpg', imageAuthor: 'Author', imageLicense: 'CC' });
    const meal = dish('d', 'r');
    const repo = new FeedRepository({ restaurantSource: { getRestaurants: async () => [item, item, { _id: null }] },
      dishSource: { getDishes: async () => ({ dishes: [meal, meal, dish('orphan', 'missing'), { name: 'bad' }], coverage }) } });
    const result = await repo.getCandidates();
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].restaurant).toBe(item);
    expect(result.candidates[0].dishes).toEqual([meal]);
    expect(result.diagnostics.map((entry) => entry.code)).toEqual(expect.arrayContaining([
      'duplicate-restaurant', 'invalid-restaurant', 'duplicate-dish', 'orphan-dish', 'invalid-dish',
    ]));
  });

  test('rejects invented restaurant envelopes and never turns resource failures into mock success', async () => {
    const source = createRestaurantSource(async () => ({ items: MOCK_RESTAURANTS }));
    await expect(new FeedRepository({ restaurantSource: source }).getCandidates()).rejects.toThrow('bare array');
    const sources = createMockSources({ scenario: 'restaurant-error' });
    await expect(new FeedRepository(sources).getCandidates()).rejects.toThrow('Synthetic');
  });

  test('dish source failure keeps every restaurant with null recommendations', async () => {
    const sources = createMockSources({ scenario: 'dish-error' });
    const result = await new FeedRepository(sources).getCandidates();
    expect(result.dishError).toBeInstanceOf(Error);
    expect(result.candidates).toHaveLength(MOCK_RESTAURANTS.length);
    expect(rankCandidates(result.candidates, profile()).every((entry) => entry.recommendedDish === null)).toBe(true);
    expect(result.coverage).toBeNull();
  });

  test('requires explicit dish coverage and reports incomplete coverage', async () => {
    const missing = new FeedRepository({ restaurantSource: { getRestaurants: async () => [restaurant('r')] },
      dishSource: { getDishes: async () => ({ dishes: [] }) } });
    expect((await missing.getCandidates()).dishError).toBeInstanceOf(Error);
    const partial = await new FeedRepository(createMockSources({ scenario: 'partial-coverage' })).getCandidates();
    expect(partial.coverage.complete).toBe(false);
    expect(partial.diagnostics).toContainEqual({ code: 'incomplete-dish-coverage' });
  });

  test('rejects malformed display fields while retaining incomplete flavor dishes as fallback', async () => {
    const repo = new FeedRepository({ restaurantSource: { getRestaurants: async () => [restaurant('r'), { ...restaurant('bad'), address: 45 }] },
      dishSource: { getDishes: async () => ({ dishes: [dish('partial', 'r', { spicy: 2 }),
        { ...dish('bad-image', 'r'), imageUrl: {} }, { ...dish('bad-count', 'r'), reviewCount: -1 }], coverage }) } });
    const result = await repo.getCandidates();
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].dishes.map((item) => item.dishId)).toEqual(['partial']);
    expect(rankCandidates(result.candidates, profile())[0]).toMatchObject({ rankingMode: 'fallback', recommendedDish: { dishId: 'partial' } });
  });

  test('different fixture accounts visibly change restaurant order and selected dish', async () => {
    const sources = createMockSources();
    const { candidates } = await new FeedRepository(sources).getCandidates();
    const preferences = new UserPreferenceRepository(sources);
    const a = rankCandidates(candidates, await preferences.getSnapshot({ userId: 'demo-user-a' }));
    const b = rankCandidates(candidates, await preferences.getSnapshot({ userId: 'demo-user-b' }));
    expect(a[0].restaurantId).toBe('demo-restaurant-noodles');
    expect(b[0].restaurantId).toBe('demo-restaurant-dessert');
    expect(a[0].recommendedDish.dishId).toBe('demo-dish-noodles');
    expect(b[0].recommendedDish.dishId).toBe('demo-dish-cake');
    expect(USER_A_TARGETS).not.toEqual(USER_B_TARGETS);
  });

  test('signed-out, empty, neutral, and malformed preferences are distinct', async () => {
    const source = createMockSources();
    const spy = jest.spyOn(source.accountSource, 'getPreferences');
    const repo = new UserPreferenceRepository(source);
    expect(await repo.getSnapshot({ userId: null })).toMatchObject({ status: 'signed-out', userId: null });
    expect(spy).not.toHaveBeenCalled();
    expect(await repo.getSnapshot({ userId: 'demo-user-empty' })).toMatchObject({ status: 'empty', flavorTargets: null });
    expect(await repo.getSnapshot({ userId: 'demo-user-neutral' })).toMatchObject({ status: 'ready', flavorTargets: all(0) });
    expect(await repo.getSnapshot({ userId: 'demo-user-invalid' })).toMatchObject({ status: 'unavailable', flavorTargets: null });
  });

  test('mismatched preference identity and service failure become unavailable snapshots', async () => {
    const repo = new UserPreferenceRepository({ accountSource: { getPreferences: async () => ({ userId: 'other', flavorTargets: all(0) }) } });
    expect(await repo.getSnapshot({ userId: 'current' })).toMatchObject({ status: 'unavailable', userId: 'current', flavorTargets: null });
    const errorRepo = new UserPreferenceRepository(createMockSources({ scenario: 'preference-error' }));
    expect(await errorRepo.getSnapshot({ userId: 'demo-user-a' })).toMatchObject({ status: 'unavailable', error: expect.any(Error) });
  });

  test('synthetic delays and failure callbacks provide repeatable retry scenarios', async () => {
    jest.useFakeTimers();
    try {
      const sources = createMockSources({ restaurantDelayMs: 20, restaurantError: ({ call }) => call === 1 });
      const failed = sources.restaurantSource.getRestaurants();
      const failureAssertion = expect(failed).rejects.toThrow('Synthetic');
      await jest.advanceTimersByTimeAsync(20);
      await failureAssertion;
      const success = sources.restaurantSource.getRestaurants();
      await jest.advanceTimersByTimeAsync(20);
      expect(await success).toHaveLength(MOCK_RESTAURANTS.length);
    } finally {
      jest.useRealTimers();
    }
  });
});
