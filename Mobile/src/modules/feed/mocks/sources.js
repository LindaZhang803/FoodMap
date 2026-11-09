import { asError } from '../contracts';
import { EDGE_DISHES, EDGE_RESTAURANTS, MOCK_COVERAGE, MOCK_DISHES, MOCK_RESTAURANTS, MOCK_USERS } from './fixtures';

const clone = (value) => JSON.parse(JSON.stringify(value));
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

/** All three sources implement the same local interfaces as future real
 * adapters. No failed real call is replaced with these fixtures automatically.
 * Delays may be numbers or functions of {call,userId} for reproducible races.
 * Scenarios: default, empty, restaurant-error, dish-error, preference-error,
 * all-no-dish, malformed (duplicate/orphan/invalid records), partial-coverage.
 * Error options may be Errors, strings, true, or functions of {call,userId}.
 */
export function createMockSources(options = {}) {
  const { scenario = 'default', delayMs = 0 } = options;
  const calls = { restaurants: 0, dishes: 0, preferences: 0 };
  async function before(kind, input = {}) {
    const call = ++calls[kind];
    const args = { call, ...input };
    const prefix = kind === 'restaurants' ? 'restaurant' : kind === 'dishes' ? 'dish' : 'preference';
    const configuredDelay = options[`${prefix}DelayMs`] === undefined ? delayMs : options[`${prefix}DelayMs`];
    const delay = typeof configuredDelay === 'function' ? configuredDelay(args) : configuredDelay;
    if (typeof delay === 'number' && delay > 0) await wait(delay);
    const configuredError = options[`${prefix}Error`];
    const error = typeof configuredError === 'function' ? configuredError(args) : configuredError;
    if (error || scenario === `${prefix}-error`) throw asError(error, `Synthetic ${prefix} source failure.`);
  }
  return {
    restaurantSource: {
      async getRestaurants() {
        await before('restaurants');
        if (scenario === 'empty') return [];
        return clone(options.restaurants || (scenario === 'malformed' ? EDGE_RESTAURANTS : MOCK_RESTAURANTS));
      },
    },
    dishSource: {
      async getDishes() {
        await before('dishes');
        const dishes = scenario === 'empty' || scenario === 'all-no-dish' ? [] :
          options.dishes || (scenario === 'malformed' ? EDGE_DISHES : MOCK_DISHES);
        return { dishes: clone(dishes), coverage: clone(options.coverage ||
          (scenario === 'partial-coverage' ? { ...MOCK_COVERAGE, complete: false } : MOCK_COVERAGE)) };
      },
    },
    accountSource: {
      async getPreferences({ userId }) {
        await before('preferences', { userId });
        const users = options.users || MOCK_USERS;
        if (!Object.prototype.hasOwnProperty.call(users, userId)) throw new Error('Synthetic user is unavailable.');
        return clone(users[userId]);
      },
    },
  };
}

export default createMockSources;
