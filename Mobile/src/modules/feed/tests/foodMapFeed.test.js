import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import FoodMapFeed from '../screens/FoodMapFeed';

jest.mock('../../../config/api', () => ({ API_ORIGIN: 'https://foodmap.example' }));
jest.mock('react-native-safe-area-context', () =>
  jest.requireActual('react-native-safe-area-context/jest/mock').default);

const origin = 'https://foodmap.example';
const restaurantId = '111111111111111111111111';
const dishId = '222222222222222222222222';
const restaurant = { _id: restaurantId, name: 'Owner restaurant', rating: null, reviewCount: 0 };
const wireDish = { id: dishId, restaurantId, name: 'Owner dish', averageRating: null, reviewCount: 0 };
const auth = { phase: 'signedIn', user: { id: 'aaaaaaaaaaaaaaaaaaaaaaaa' }, token: 'synthetic-token' };

let originalFetch;
let records;
beforeEach(() => {
  originalFetch = global.fetch;
  records = new Map();
  // Only the HTTP transport is synthetic. The owner catalog readers, Member 4
  // adapters, Favorites HTTP client, session mapping and screens run unchanged.
  global.fetch = jest.fn(async (url, options = {}) => {
    if (url === `${origin}/api/restaurants`) return { ok: true, json: async () => [restaurant] };
    if (url === `${origin}/api/dishes`) return { ok: true, json: async () => [wireDish] };
    if (options.headers?.Authorization !== `Bearer ${auth.token}`) {
      return { status: 401 };
    }
    if (url === `${origin}/api/favorites`) {
      return { status: 200, json: async () => ({ items: [...records.values()] }) };
    }
    const [, type, id] = /\/api\/favorites\/(restaurant|dish)\/([a-f0-9]{24})$/.exec(url) || [];
    if (!type) throw new Error(`Unexpected test request: ${url}`);
    const key = `${type}:${id}`;
    if (options.method === 'DELETE') {
      records.delete(key);
      return { status: 204 };
    }
    if (options.method !== 'PUT') throw new Error('Unexpected test method');
    const item = records.get(key) || { targetType: type, targetId: id,
      createdAt: '2026-11-08T12:00:00.000Z',
      target: type === 'restaurant' ? restaurant : { ...wireDish, dishId: wireDish.id } };
    records.set(key, item);
    return { status: 200, json: async () => item };
  });
});
afterEach(() => { global.fetch = originalFetch; });

test('feed waits for sign-in, then uses stable owner readers and canonical dish links', async () => {
  let latest;
  const onRestaurantPress = jest.fn();
  const onLoginRequired = jest.fn();
  const props = { onRestaurantPress, onLoginRequired,
    renderDetail: experience => { latest = experience; return null; } };
  const view = render(<FoodMapFeed {...props} auth={{ phase: 'signedOut' }} />);
  expect(global.fetch).not.toHaveBeenCalled();
  expect(latest).toBeUndefined();
  fireEvent.press(screen.getByRole('button', { name: 'Sign in to load your feed' }));
  expect(onLoginRequired).toHaveBeenCalledTimes(1);
  view.rerender(<FoodMapFeed {...props} auth={auth} />);
  await waitFor(() => expect(latest.savedPlaces.status).toBe('ready'));
  await waitFor(() => expect(latest.feed.entries).toHaveLength(1));
  expect(latest.feed.entries[0].recommendedDish).toMatchObject({ dishId, restaurantId });
  expect(latest.feed.preferenceStatus).toBe('unavailable');
  fireEvent.press(screen.getByRole('button', { name: 'Open restaurant Owner restaurant' }));
  expect(onRestaurantPress).toHaveBeenCalledWith(restaurantId);
  fireEvent.press(screen.getByRole('tab', { name: 'Wheel' }));
  view.rerender(<FoodMapFeed {...props} auth={auth} />);
  await act(async () => {});
  expect(global.fetch.mock.calls.map(([url]) => url).sort()).toEqual([
    `${origin}/api/dishes`, `${origin}/api/favorites`, `${origin}/api/restaurants`,
  ]);
});

test('one confirmed Favorites state survives reloads for both targets and feeds Want to Try and Wheel', async () => {
  let latest;
  const props = { auth, renderDetail: experience => { latest = experience; return null; } };
  let view = render(<FoodMapFeed {...props} />);
  await waitFor(() => expect(latest.savedPlaces.status).toBe('ready'));
  await waitFor(() => expect(latest.feed.entries).toHaveLength(1));
  expect(latest.feed.preferenceStatus).toBe('unavailable');
  expect(latest.feed.entries[0].rankingMode).toBe('fallback');
  const dish = latest.feed.candidates[0].dishes[0];
  await act(async () => {
    await latest.savedPlaces.toggleFavorite(restaurant);
    await latest.savedPlaces.toggleFavoriteDish(dish);
  });
  expect(records.size).toBe(2);
  view.unmount();
  view = render(<FoodMapFeed {...props} />);
  await waitFor(() => expect(latest.savedPlaces.items).toHaveLength(2));
  fireEvent.press(screen.getByRole('tab', { name: 'Want to Try' }));
  fireEvent.press(screen.getByRole('tab', { name: 'Saved Dishes' }));
  expect(screen.getByText('Owner dish')).toBeTruthy();
  // The Reviews browser has no initial dish-ID interface: no misleading link.
  expect(screen.queryByRole('button', { name: 'View dish Owner dish' })).toBeNull();
  fireEvent.press(screen.getByRole('tab', { name: 'Wheel' }));
  fireEvent.press(screen.getByRole('button', { name: 'Dishes' }));
  fireEvent.press(screen.getByRole('button', { name: 'Remove Owner dish' }));
  expect(screen.getByRole('button', { name: 'Select saved Owner dish' })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Select saved Owner dish' }));
  fireEvent.press(screen.getByRole('button', { name: 'Import saved dishes' }));
  expect(screen.getByRole('button', { name: 'Remove Owner dish' })).toBeTruthy();
  await act(async () => {
    await latest.savedPlaces.removeFavorite('restaurant', restaurantId);
    await latest.savedPlaces.removeFavorite('dish', dishId);
  });
  view.unmount();
  render(<FoodMapFeed {...props} />);
  await waitFor(() => expect(latest.savedPlaces.status).toBe('ready'));
  expect(latest.savedPlaces.items).toEqual([]);
  expect(records.size).toBe(0);
});

test('the current Favorites 401 delegates cleanup and signingOut drops private state immediately', async () => {
  let latest;
  const onSessionExpired = jest.fn();
  const props = { onSessionExpired, renderDetail: experience => { latest = experience; return null; } };
  const view = render(<FoodMapFeed {...props} auth={auth} />);
  await waitFor(() => expect(latest.savedPlaces.status).toBe('ready'));
  await act(async () => { await latest.savedPlaces.toggleFavorite(restaurant); });
  global.fetch.mockImplementationOnce(async () => ({ status: 401 }));
  await act(async () => { await latest.savedPlaces.refresh(); });
  expect(onSessionExpired).toHaveBeenCalledTimes(1);
  expect(latest.savedPlaces.items).toEqual([]);
  expect(latest.savedPlaces.sessionScope).toBeNull();
  view.rerender(<FoodMapFeed {...props} auth={{ ...auth, phase: 'signingOut' }} />);
  expect(screen.getByText('Sign in to load your feed.')).toBeTruthy();
  expect(screen.queryByRole('tab', { name: 'Discover' })).toBeNull();
});

test.each([
  undefined,
  { phase: 'restoring' },
  { phase: 'signingIn' },
  { ...auth, phase: 'signingOut' },
  { ...auth, phase: 'clearing' },
  { phase: 'signedIn', user: auth.user },
])('feed makes no requests without a usable signed-in session: %j', async invalidAuth => {
  render(<FoodMapFeed auth={invalidAuth} onLoginRequired={jest.fn()} />);
  await act(async () => {});
  expect(global.fetch).not.toHaveBeenCalled();
  expect(screen.queryByRole('tab', { name: 'Discover' })).toBeNull();
});
