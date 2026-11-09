import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import FeedExperience from '../screens/FeedExperience';
import { toFeedSession } from '../services/accountSession';

jest.mock('react-native-safe-area-context', () =>
  jest.requireActual('react-native-safe-area-context/jest/mock').default);

const auth = { phase: 'signedIn', user: { id: 'aaaaaaaaaaaaaaaaaaaaaaaa' }, token: 'token-a' };

test('maps owner credentials without modifying or forwarding profile metadata', () => {
  const input = Object.freeze({ ...auth, user: Object.freeze({
    ...auth.user, foodPreferences: ['spicy'], username: 'Account owner',
  }) });
  expect(toFeedSession(input)).toEqual({ userId: auth.user.id, token: auth.token });
  expect(input.user.foodPreferences).toEqual(['spicy']);
  expect(input.phase).toBe('signedIn');
});

test.each(['restoring', 'signedOut', 'signingIn', 'signingOut', 'clearing',
  'restoreError', 'cleanupError', 'unknown'])('%s never exposes retained credentials', phase => {
  expect(toFeedSession({ ...auth, phase })).toBeNull();
});

test.each([null, undefined, [], 'signedIn', {},
  { ...auth, user: null }, { ...auth, user: [] }, { ...auth, user: {} },
  { ...auth, user: { id: ' ' } }, { ...auth, user: { id: 123 } },
  { ...auth, token: '' }, { ...auth, token: ' ' }, { ...auth, token: 123 },
])('malformed owner state %j produces no session', input => {
  expect(toFeedSession(input)).toBeNull();
});

test('signing out hides Favorites immediately, stops private work, and re-entry reloads only private data', async () => {
  const restaurant = { _id: '111111111111111111111111', name: 'Saved place', rating: null, reviewCount: 0 };
  const item = { targetType: 'restaurant', targetId: restaurant._id,
    createdAt: '2026-11-07T12:00:00.000Z', target: restaurant };
  const getRestaurants = jest.fn().mockResolvedValue([restaurant]);
  const getDishes = jest.fn().mockResolvedValue([]);
  const readSelfProfile = jest.fn().mockResolvedValue({ userId: auth.user.id, flavorTargets: null });
  const favoritesClient = { list: jest.fn().mockResolvedValue([item]), save: jest.fn(), remove: jest.fn() };
  let latest;
  const props = { getRestaurants, getDishes, readSelfProfile, favoritesClient,
    origin: 'https://food.example', renderDetail: value => { latest = value; return null; } };
  const view = render(<FeedExperience {...props} session={toFeedSession(auth)} />);
  await waitFor(() => expect(latest.savedPlaces.favorites).toHaveLength(1));
  await waitFor(() => expect(latest.feed.preferenceStatus).toBe('empty'));
  await waitFor(() => expect(latest.feed.entries).toHaveLength(1));

  let completeOldRead;
  favoritesClient.list.mockImplementationOnce(() => new Promise(resolve => { completeOldRead = resolve; }));
  let pendingRead;
  act(() => { pendingRead = latest.savedPlaces.refresh(); });
  const pendingSignal = favoritesClient.list.mock.calls[1][0].signal;

  view.rerender(<FeedExperience {...props} session={toFeedSession({ ...auth, phase: 'signingOut' })} />);
  expect(latest.savedPlaces.favorites).toEqual([]);
  expect(latest.savedPlaces.status).toBe('signed-out');
  expect(latest.savedPlaces.sessionScope).toBeNull();
  expect(pendingSignal.aborted).toBe(true);
  await act(async () => {
    completeOldRead([item]);
    await pendingRead;
    await latest.savedPlaces.refresh();
    await latest.savedPlaces.toggleFavorite(restaurant);
    latest.feed.refreshPreferences();
  });
  expect(latest.savedPlaces.favorites).toEqual([]);
  expect(favoritesClient.list).toHaveBeenCalledTimes(2);
  expect(favoritesClient.save).not.toHaveBeenCalled();
  expect(favoritesClient.remove).not.toHaveBeenCalled();
  expect(readSelfProfile).toHaveBeenCalledTimes(1);

  view.rerender(<FeedExperience {...props} session={toFeedSession(auth)} />);
  await waitFor(() => expect(latest.savedPlaces.favorites).toHaveLength(1));
  await waitFor(() => expect(readSelfProfile).toHaveBeenCalledTimes(2));
  expect(favoritesClient.list).toHaveBeenCalledTimes(3);
  expect(getRestaurants).toHaveBeenCalledTimes(1);
  expect(getDishes).toHaveBeenCalledTimes(1);
});
