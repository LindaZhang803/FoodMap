import React from "react";

import { Alert } from "react-native";

import * as SecureStore from "expo-secure-store";

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";

import App from "../../../../App";

// =====================================================
// Mocks
// =====================================================

jest.mock("../../../config/api", () => ({
  API_ORIGIN: "https://foodmap.example",
}));

jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual(
      "react-native-safe-area-context/jest/mock"
    ).default
);

jest.mock("expo-location", () => ({
  getForegroundPermissionsAsync: jest.fn(
    async () => ({
      status: "denied",
      granted: false,
    })
  ),

  requestForegroundPermissionsAsync: jest.fn(
    async () => ({
      status: "denied",
      granted: false,
    })
  ),

  getCurrentPositionAsync: jest.fn(),
}));

jest.mock("expo-file-system", () => ({
  File: jest.fn(),
}));

jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
}));

jest.mock("expo-secure-store", () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: "test-device-only",

  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Keep the real App, Accounts, Feed,
// Favorites, Wheel, and navigation.
//
// Only native services, HTTP transport,
// and destination detail screens are mocked.

jest.mock(
  "../../reviews/screens/DishBrowserScreen",
  () => () => null
);

jest.mock(
  "../../restaurants/screens/RestaurantDetailScreen",
  () => {
    const React = require("react");

    const {
      Pressable,
      Text,
    } = require("react-native");

    return {
      __esModule: true,

      default: ({
        restaurantId,
        onBack,
      }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to feed"
          onPress={onBack}
        >
          <Text>{restaurantId}</Text>
        </Pressable>
      ),
    };
  }
);

// =====================================================
// Test Fixtures
// =====================================================

const user = {
  id: "aaaaaaaaaaaaaaaaaaaaaaaa",
  username: "Test user",
  email: "test@example.com",
  flavorTargets: null,
};

const restaurant = {
  _id: "111111111111111111111111",

  name: "Test restaurant",

  rating: null,
  reviewCount: 0,

  cuisineType: "Japanese",
  priceRange: "$$",

  latitude: 33.9737,
  longitude: -117.3281,
};

let originalFetch;

let finishLogin;

let loginStatus;
let favoritesStatus;

let alert;

// =====================================================
// HTTP Response Helper
// =====================================================

function response(value, status = 200) {
  return {
    ok: status >= 200 && status < 300,

    status,

    json: async () => value,
  };
}

// =====================================================
// Setup
// =====================================================

beforeEach(() => {
  jest.clearAllMocks();

  originalFetch = global.fetch;

  finishLogin = null;

  loginStatus = 200;

  favoritesStatus = 200;

  SecureStore.getItemAsync.mockResolvedValue(
    null
  );

  SecureStore.setItemAsync.mockResolvedValue(
    undefined
  );

  SecureStore.deleteItemAsync.mockResolvedValue(
    undefined
  );

  alert = jest
    .spyOn(Alert, "alert")
    .mockImplementation(() => {});

  // ===================================================
  // Mock HTTP Transport
  // ===================================================

  global.fetch = jest.fn(
    async (url, options = {}) => {
      const requestUrl = String(url);

      // -----------------------------------------------
      // Login
      // -----------------------------------------------

      if (
        requestUrl.endsWith(
          "/api/auth/login"
        )
      ) {
        return new Promise((resolve) => {
          finishLogin = () =>
            resolve(
              response(
                loginStatus === 200
                  ? {
                      user,
                      token: "test-token",
                    }
                  : {
                      message:
                        "Invalid credentials",
                    },
                loginStatus
              )
            );
        });
      }

      // -----------------------------------------------
      // Logout
      // -----------------------------------------------

      if (
        requestUrl.endsWith(
          "/api/auth/logout"
        )
      ) {
        return response({});
      }

      // -----------------------------------------------
      // Current User
      // -----------------------------------------------

      if (
        requestUrl.endsWith(
          "/api/users/me"
        )
      ) {
        expect(
          options.headers.Authorization
        ).toBe("Bearer test-token");

        return response({
          user,
        });
      }

      // -----------------------------------------------
      // Review History
      // -----------------------------------------------

      if (
        requestUrl.includes(
          "/api/reviews/mine?"
        )
      ) {
        return response({
          reviews: [],

          pagination: {
            page: 1,
            limit: 20,
            total: 0,
          },
        });
      }

      // -----------------------------------------------
      // Eligible Reviews
      // -----------------------------------------------

      if (
        requestUrl.endsWith(
          "/api/posts/eligible-reviews"
        )
      ) {
        return response({
          items: [],
        });
      }

      // -----------------------------------------------
      // Public Posts
      // -----------------------------------------------

      if (
        requestUrl.includes(
          "/api/posts?"
        ) ||
        requestUrl.endsWith(
          "/api/posts"
        )
      ) {
        return response({
          items: [],
          nextCursor: null,
          hasMore: false,
        });
      }

      // -----------------------------------------------
      // Restaurants
      // -----------------------------------------------

      if (
        requestUrl.endsWith(
          "/api/restaurants"
        )
      ) {
        return response([
          restaurant,
        ]);
      }

      // -----------------------------------------------
      // Dishes
      // -----------------------------------------------

      if (
        requestUrl.includes(
          "/api/dishes"
        )
      ) {
        return response([]);
      }

      // -----------------------------------------------
      // Favorites
      // -----------------------------------------------

      if (
        requestUrl.endsWith(
          "/api/favorites"
        )
      ) {
        return response(
          favoritesStatus === 200
            ? {
                items: [],
              }
            : {
                message:
                  "Your session has expired.",
              },
          favoritesStatus
        );
      }

      // -----------------------------------------------
      // Unexpected Request
      // -----------------------------------------------

      throw new Error(
        `Unexpected test request ${requestUrl}`
      );
    }
  );
});

// =====================================================
// Cleanup
// =====================================================

afterEach(() => {
  global.fetch = originalFetch;

  alert.mockRestore();
});

// =====================================================
// Navigation Helpers
// =====================================================

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

// =====================================================
// Open Bottom Tab
// =====================================================

function openTab(name) {
  fireEvent.press(
    screen.getByRole("tab", {
      name,
    })
  );
}

// =====================================================
// Check Selected Tab
// =====================================================

// Use standard Jest assertions instead of
// toHaveAccessibilityState(), which is not
// registered in the current Jest environment.

function expectSelectedTab(name) {
  const tab = screen.getByRole("tab", {
    name,
  });

  expect(
    tab.props.accessibilityState?.selected
  ).toBe(true);
}

// =====================================================
// Open Profile Login
// =====================================================

async function openProfileLogin() {
  openTab("Profile");

  await waitFor(() => {
    expect(
      screen.getByText(
        "Welcome Back!"
      )
    ).toBeTruthy();

    expect(
      screen.getByLabelText(
        "Email"
      )
    ).toBeTruthy();

    expect(
      screen.getByLabelText(
        "Password"
      )
    ).toBeTruthy();
  });
}

// =====================================================
// Submit Login
// =====================================================

async function submitLogin() {
  fireEvent.changeText(
    screen.getByLabelText(
      "Email"
    ),
    "test@example.com"
  );

  fireEvent.changeText(
    screen.getByLabelText(
      "Password"
    ),
    "synthetic-test-password"
  );

  fireEvent.press(
    screen.getByRole("button", {
      name: "Log In",
    })
  );

  await waitFor(() => {
    expect(
      finishLogin
    ).toEqual(
      expect.any(Function)
    );
  });

  await act(async () => {
    finishLogin();
  });
}

// =====================================================
// Test 1
// Shared Accounts Session
// =====================================================

test(
  "Accounts login uses one shared session across Home and Wheel",
  async () => {
    await readyHome();

    // Home is publicly accessible.

    expect(
      screen.getByRole("tab", {
        name: "Home",
      })
    ).toBeTruthy();

    // Open Accounts login.

    await openProfileLogin();

    // No private favorites request
    // should occur before login.

    expect(
      global.fetch.mock.calls.some(
        ([url]) =>
          String(url).endsWith(
            "/api/favorites"
          )
      )
    ).toBe(false);

    // Complete login.

    await submitLogin();

    await waitFor(() => {
      expect(
        SecureStore.setItemAsync
      ).toHaveBeenCalled();
    });

    // Navigate to Wheel.

    openTab("Wheel");

    await waitFor(() => {
      expectSelectedTab("Wheel");

      expect(
        screen.getAllByText("Decision Wheel").length
      ).toBeGreaterThan(0);
    });

    // No second login should occur.

    expect(
      global.fetch.mock.calls.filter(
        ([url]) =>
          String(url).endsWith(
            "/api/auth/login"
          )
      )
    ).toHaveLength(1);

    expect(
      SecureStore.getItemAsync
    ).toHaveBeenCalledTimes(1);
  }
);

// =====================================================
// Test 2
// Normal Login and Home Navigation
// =====================================================

test(
  "normal Profile login keeps Home accessible",
  async () => {
    await readyHome();

    await openProfileLogin();

    await submitLogin();

    await waitFor(() => {
      expect(
        SecureStore.setItemAsync
      ).toHaveBeenCalled();
    });

    openTab("Home");

    expectSelectedTab("Home");

    expect(
      screen.getByRole("tab", {
        name: "Explore",
      })
    ).toBeTruthy();
  }
);

// =====================================================
// Test 3
// Leaving Login Does Not Authenticate
// =====================================================

test(
  "leaving Profile login does not authenticate the user",
  async () => {
    await readyHome();

    await openProfileLogin();

    // Leave login without submitting.

    openTab("Home");

    expectSelectedTab("Home");

    expect(
      SecureStore.setItemAsync
    ).not.toHaveBeenCalled();

    expect(
      global.fetch.mock.calls.some(
        ([url]) =>
          String(url).endsWith(
            "/api/auth/login"
          )
      )
    ).toBe(false);

    expect(
      global.fetch.mock.calls.some(
        ([url]) =>
          String(url).endsWith(
            "/api/favorites"
          )
      )
    ).toBe(false);
  }
);

// =====================================================
// Test 4
// Restored Session
// =====================================================

test(
  "a restored session opens Wheel without another login",
  async () => {
    SecureStore.getItemAsync.mockResolvedValue(
      "test-token"
    );

    await readyHome();

    // Wait until the session is restored.

    await waitFor(() => {
      expect(
        global.fetch.mock.calls.some(
          ([url]) =>
            String(url).endsWith(
              "/api/users/me"
            )
        )
      ).toBe(true);
    });

    // Navigate to Wheel.

    openTab("Wheel");

    await waitFor(() => {
      expectSelectedTab("Wheel");

      expect(
        screen.getAllByText("Decision Wheel").length
      ).toBeGreaterThan(0);
    });

    // Restore must not trigger another login.

    expect(
      global.fetch.mock.calls.some(
        ([url]) =>
          String(url).endsWith(
            "/api/auth/login"
          )
      )
    ).toBe(false);

    expect(
      SecureStore.getItemAsync
    ).toHaveBeenCalledTimes(1);

    expect(
      SecureStore.setItemAsync
    ).not.toHaveBeenCalled();
  }
);

// =====================================================
// Test 5
// Failed Login
// =====================================================

test(
  "failed login stays in Accounts and never stores a session",
  async () => {
    loginStatus = 401;

    await readyHome();

    await openProfileLogin();

    await submitLogin();

    await waitFor(() => {
      expect(alert).toHaveBeenCalledWith(
        "Login failed",
        "Invalid credentials"
      );
    });

    // Remain on Accounts login screen.

    expect(
      screen.getByText(
        "Welcome Back!"
      )
    ).toBeTruthy();

    // No successful session stored.

    expect(
      SecureStore.setItemAsync
    ).not.toHaveBeenCalled();

    // No authenticated favorites request.

    expect(
      global.fetch.mock.calls.some(
        ([url]) =>
          String(url).endsWith(
            "/api/favorites"
          )
      )
    ).toBe(false);
  }
);

// =====================================================
// Test 6
// Expired Favorites Session
// =====================================================

test(
  "expired Favorites session uses Accounts cleanup",
  async () => {
    favoritesStatus = 401;

    SecureStore.getItemAsync.mockResolvedValue(
      "test-token"
    );

    await readyHome();

    // Wait for restored Accounts session.

    await waitFor(() => {
      expect(
        global.fetch.mock.calls.some(
          ([url]) =>
            String(url).endsWith(
              "/api/users/me"
            )
        )
      ).toBe(true);
    });

    // Wheel uses private Favorites data.

    openTab("Wheel");

    // Confirm the 401 scenario was exercised.

    await waitFor(() => {
      expect(
        global.fetch.mock.calls.some(
          ([url]) =>
            String(url).endsWith(
              "/api/favorites"
            )
        )
      ).toBe(true);
    });

    // Expired credentials must be removed.

    await waitFor(() => {
      expect(
        SecureStore.deleteItemAsync
      ).toHaveBeenCalled();
    });

    // Expiration must not create another session.

    expect(
      SecureStore.setItemAsync
    ).not.toHaveBeenCalled();

    // Home remains accessible.

    openTab("Home");

    expectSelectedTab("Home");
  }
);