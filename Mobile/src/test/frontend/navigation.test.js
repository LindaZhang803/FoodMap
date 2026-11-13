import React from "react";

import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react-native";

import App from "../../App";

jest.mock(
  "../../modules/accounts/hooks/useAuthSession",
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
  "../../modules/feed/favorites/useLiveSavedPlaces",
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

jest.mock("../../../RestaurantBrowser", () => {
  const React = require("react");
  const { Text } = require("react-native");

  return () => <Text>Explore fixture</Text>;
});

jest.mock("../../../AccountApp", () => {
  const React = require("react");
  const { Text } = require("react-native");

  return () => <Text>Account fixture</Text>;
});

jest.mock(
  "../../modules/posts/screens/PostFeedScreen",
  () => {
    const React = require("react");
    const { Text } = require("react-native");

    return () => <Text>Home posts fixture</Text>;
  }
);

jest.mock(
  "../../modules/posts/screens/CreatePostScreen",
  () => () => null
);

jest.mock(
  "../../modules/feed/screens/FeedRouteScreen",
  () => () => null
);

jest.mock(
  "../../modules/posts/screens/PostDetailScreen",
  () => () => null
);

jest.mock(
  "../../modules/restaurants/screens/RestaurantDetailScreen",
  () => () => null
);

jest.mock(
  "../../modules/reviews/screens/DishBrowserScreen",
  () => () => null
);

jest.mock(
  "../../modules/notifications/screens/NotificationCenterScreen",
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