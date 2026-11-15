import { getRestaurants } from '../../src/modules/restaurants/services/restaurantApi';
import { filterRestaurants, DEFAULT_FILTERS } from '../../src/modules/restaurants/utils/restaurantFilters';
jest.mock('../../src/config/api', () => ({ API_ORIGIN: 'http://localhost:3000' }));
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });
test('existing frontend search, filters and sort controls map to live API parameters', async () => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => [] }));
  const controller = new AbortController();
  await getRestaurants({ searchQuery: 'Ramen & soup', filters: { cuisine: 'japanese', minPrice: '0', maxPrice: '20', minRating: 4, customDistance: '5' }, sortBy: 'nearest', userLocation: { latitude: 34, longitude: -117 }, signal: controller.signal });
  const [url, options] = global.fetch.mock.calls[0];
  const query = new URL(url).searchParams;
  expect(query.get('q')).toBe('Ramen & soup');
  expect(query.get('minPrice')).toBe('0');
  expect(query.get('sort')).toBe('distance');
  expect(query.get('maxDistance')).toBe('5');
  expect(query.get('latitude')).toBe('34');
  expect(options.signal).toBe(controller.signal);
});
test('dish matches from the backend remain visible under the existing local filtering', () => {
  const restaurant = { _id: 'r1', name: 'Noodle House', cuisineType: 'Japanese', dishNames: ['Ramen'] };
  expect(filterRestaurants([restaurant], 'ramen', DEFAULT_FILTERS, null)).toEqual([restaurant]);
  expect(filterRestaurants([restaurant], 'missing', DEFAULT_FILTERS, null)).toEqual([]);
});
