import React from 'react';
import { Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import App from '../../../../App';

jest.mock('../../../config/api', () => ({ API_ORIGIN: 'https://foodmap.example' }));
jest.mock('react-native-safe-area-context', () =>
  jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-location', () => ({ requestForegroundPermissionsAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({ File: jest.fn() }));
jest.mock('expo-image-picker', () => ({ requestMediaLibraryPermissionsAsync: jest.fn() }));
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'test-device-only',
  getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn(),
}));
// Keep the entry, Accounts hook/API/screens, toolbar, and feed real. Only native
// storage, HTTP transport, and destination detail screens are supplied by tests.
jest.mock('../../reviews/screens/DishBrowserScreen', () => () => null);
jest.mock('../../restaurants/screens/RestaurantDetailScreen', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return { __esModule: true, default: ({ restaurantId, onBack }) =>
    <Pressable accessibilityRole="button" accessibilityLabel="Back to feed" onPress={onBack}>
      <Text>{restaurantId}</Text>
    </Pressable> };
});

const user = { id: 'aaaaaaaaaaaaaaaaaaaaaaaa', username: 'Test user',
  email: 'test@example.com', flavorTargets: null };
const restaurant = { _id: '111111111111111111111111', name: 'Test restaurant',
  rating: null, reviewCount: 0, cuisineType: 'Japanese', priceRange: '$$' };
let originalFetch;
let finishLogin;
let loginStatus;
let favoritesStatus;
let alert;
const response = (value, status = 200) => ({ ok: status < 400, status, json: async () => value });

beforeEach(() => {
  originalFetch = global.fetch;
  finishLogin = null;
  loginStatus = 200;
  favoritesStatus = 200;
  SecureStore.getItemAsync.mockResolvedValue(null);
  SecureStore.setItemAsync.mockResolvedValue(undefined);
  SecureStore.deleteItemAsync.mockResolvedValue(undefined);
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  global.fetch = jest.fn(async (url, options = {}) => {
    if (url.endsWith('/api/auth/login')) return new Promise(resolve => {
      finishLogin = () => resolve(response(loginStatus === 200
        ? { user, token: 'test-token' } : { message: 'Invalid credentials' }, loginStatus));
    });
    if (url.endsWith('/api/auth/logout')) return response({});
    if (url.endsWith('/api/users/me')) {
      expect(options.headers.Authorization).toBe('Bearer test-token');
      return response({ user });
    }
    if (url.includes('/api/reviews/mine?')) return response({ reviews: [],
      pagination: { page: 1, limit: 20, total: 0 } });
    if (url.endsWith('/api/restaurants')) return response([restaurant]);
    if (url.endsWith('/api/dishes')) return response([]);
    if (url.endsWith('/api/favorites')) return response({ items: [] }, favoritesStatus);
    throw new Error(`Unexpected test request ${url}`);
  });
});
afterEach(() => { global.fetch = originalFetch; alert.mockRestore(); });

async function readyHome() {
  render(<App />);

  await waitFor(() => {
    expect(
      screen.getByRole("tab", {
        name: "Home",
      })
    ).toBeEnabled();

    expect(
      screen.getByRole("tab", {
        name: "Profile",
      })
    ).toBeEnabled();
  });
}

async function submitLogin() {
  fireEvent.changeText(screen.getByLabelText('Email'), 'test@example.com');
  fireEvent.changeText(screen.getByLabelText('Password'), 'synthetic-test-password');
  fireEvent.press(screen.getByRole('button', { name: 'Login' }));
  await waitFor(() => expect(finishLogin).toEqual(expect.any(Function)));
  expect(screen.getByText('Logging in...')).toBeTruthy();
  await act(async () => { finishLogin(); });
}

test('real Accounts login returns My Feed guests directly to the feed and shares one session', async () => {
  await readyHome();
  expect(screen.getByText('Near Me')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'My Feed' }));
  expect(screen.getByText('Welcome Back!')).toBeTruthy();
  expect(global.fetch.mock.calls.some(([url]) => url.endsWith('/api/favorites'))).toBe(false);
  await submitLogin();
  await waitFor(() => expect(screen.getByRole('tab', { name: 'Discover' })).toBeTruthy());
  await waitFor(() => expect(screen.getByRole('button', { name: 'Open restaurant Test restaurant' })).toBeTruthy());
  expect(SecureStore.getItemAsync).toHaveBeenCalledTimes(1);
  expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
  const calls = global.fetch.mock.calls.length;
  fireEvent.press(screen.getByRole('button', { name: 'Open restaurant Test restaurant' }));
  fireEvent.press(screen.getByRole('button', { name: 'Back to feed' }));
  expect(global.fetch).toHaveBeenCalledTimes(calls);
  fireEvent.press(screen.getByRole('button', { name: 'Back to home' }));
  expect(screen.queryByRole('tab', { name: 'Discover' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'My Feed' }));
  expect(screen.getByRole('tab', { name: 'Discover' })).toBeTruthy();
  await act(async () => {});
  expect(alert).not.toHaveBeenCalled();
});

test('normal avatar login still returns home', async () => {
  await readyHome();
  fireEvent.press(screen.getByRole('button', { name: 'Log in or create an account' }));
  await submitLogin();
  await waitFor(() => expect(screen.getByRole('button', { name: 'My Feed' })).toBeTruthy());
  expect(screen.queryByRole('tab', { name: 'Discover' })).toBeNull();
});

test('back from feed login cancels the pending destination', async () => {
  await readyHome();
  fireEvent.press(screen.getByRole('button', { name: 'My Feed' }));
  fireEvent.press(screen.getByRole('button', { name: 'Back to home' }));
  fireEvent.press(screen.getByRole('button', { name: 'Log in or create an account' }));
  await submitLogin();
  await waitFor(() => expect(screen.getByRole('button', { name: 'My Feed' })).toBeTruthy());
  expect(screen.queryByRole('tab', { name: 'Discover' })).toBeNull();
});

test('a restored session opens the feed directly without a second login or storage owner', async () => {
  SecureStore.getItemAsync.mockResolvedValue('test-token');
  await readyHome();
  fireEvent.press(screen.getByRole('button', { name: 'My Feed' }));
  await waitFor(() => expect(screen.getByRole('tab', { name: 'Discover' })).toBeTruthy());
  await act(async () => {});
  expect(global.fetch.mock.calls.some(([url]) => url.endsWith('/api/auth/login'))).toBe(false);
  expect(SecureStore.getItemAsync).toHaveBeenCalledTimes(1);
  expect(alert).not.toHaveBeenCalled();
});

test('failed login stays on Accounts and never starts private feed requests', async () => {
  loginStatus = 401;
  await readyHome();
  fireEvent.press(screen.getByRole('button', { name: 'My Feed' }));
  await submitLogin();
  await waitFor(() => expect(alert).toHaveBeenCalledWith('Login failed', 'Invalid credentials'));
  expect(screen.queryByRole('tab', { name: 'Discover' })).toBeNull();
  expect(global.fetch.mock.calls.some(([url]) => url.endsWith('/api/favorites'))).toBe(false);
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
});

test('expired feed sessions use the existing Accounts cleanup and hide the feed', async () => {
  favoritesStatus = 401;
  SecureStore.getItemAsync.mockResolvedValue('test-token');
  await readyHome();
  fireEvent.press(screen.getByRole('button', { name: 'My Feed' }));
  await waitFor(() => expect(screen.getByText('Welcome Back!')).toBeTruthy());
  expect(screen.queryByRole('tab', { name: 'Discover' })).toBeNull();
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(1);
});
