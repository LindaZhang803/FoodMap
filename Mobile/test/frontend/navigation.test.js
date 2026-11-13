import React from "react";

import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react-native";

import App from "../../App";

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");

  const insets = {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  };

  const SafeAreaInsetsContext =
    React.createContext(insets);

  return {
    SafeAreaProvider: ({ children }) => (
      <SafeAreaInsetsContext.Provider value={insets}>
        <View>{children}</View>
      </SafeAreaInsetsContext.Provider>
    ),

    SafeAreaView: ({ children, ...props }) => (
      <View {...props}>{children}</View>
    ),

    SafeAreaInsetsContext,

    useSafeAreaInsets: () => insets,
  };
});

jest.mock(
  "../../src/modules/accounts/hooks/useAuthSession",
  () => ({
    __esModule: true,
    default: () => ({
      auth: { phase: "signedOut" },
      logout: jest.fn(),
      login: jest.fn(),
    }),
  })
);

jest.mock(
  "../../src/modules/feed/favorites/useLiveSavedPlaces",
  () => ({
    __esModule: true,
    default: () => ({
      isSaved: () => false,
      isPending: () => false,
      canMutate: false,
      toggleFavorite: jest.fn(),
      toggleFavoriteDish: jest.fn(),
    }),
  })
);

jest.mock("../../RestaurantBrowser", () => {
  const React = require("react");
  const { Text } = require("react-native");

  return () => <Text>Explore fixture</Text>;
});

jest.mock("../../AccountApp", () => {
  const React = require("react");
  const { Text } = require("react-native");

  return () => <Text>Account fixture</Text>;
});

jest.mock(
  "../../src/modules/posts/screens/PostFeedScreen",
  () => {
    const React = require("react");
    const { Text } = require("react-native");

    return () => <Text>Home posts fixture</Text>;
  }
);

jest.mock(
  "../../src/modules/posts/screens/CreatePostScreen",
  () => () => null
);

jest.mock(
  "../../src/modules/feed/screens/FeedRouteScreen",
  () => () => null
);

jest.mock(
  "../../src/modules/posts/screens/PostDetailScreen",
  () => () => null
);

jest.mock(
  "../../src/modules/restaurants/screens/RestaurantDetailScreen",
  () => () => null
);

jest.mock(
  "../../src/modules/reviews/screens/DishBrowserScreen",
  () => () => null
);

jest.mock(
  "../../src/modules/notifications/screens/NotificationCenterScreen",
  () => () => null
);

test("bottom tabs exist and Explore can be selected", () => {
  render(<App />);

  for (const label of [
    "Home",
    "Explore",
    "Create",
    "Wheel",
    "Profile",
  ]) {
    expect(
      screen.getByRole("tab", { name: label })
    ).toBeTruthy();
  }

  fireEvent.press(
    screen.getByRole("tab", {
      name: "Explore",
    })
  );

  expect(
    screen.getByRole("tab", {
      name: "Explore",
    }).props.accessibilityState.selected
  ).toBe(true);
});

test("logged-out Create redirects to account without claiming authentication", () => {
  render(<App />);

  fireEvent.press(
    screen.getByRole("tab", {
      name: "Create",
    })
  );

  expect(
    screen.getByRole("tab", {
      name: "Profile",
    }).props.accessibilityState.selected
  ).toBe(true);

  expect(
    screen.getByText("Account fixture")
  ).toBeTruthy();
});