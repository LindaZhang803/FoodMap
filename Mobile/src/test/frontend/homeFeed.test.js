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
    }),
  })
);

jest.mock(
  "../../modules/posts/screens/PostFeedScreen",
  () => {
    const React = require("react");
    const {
      Pressable,
      Text,
    } = require("react-native");

    return ({ onPostPress }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open test post"
        onPress={() =>
          onPostPress({ id: "post-123" })
        }
      >
        <Text>Feed post item</Text>
      </Pressable>
    );
  }
);

jest.mock(
  "../../modules/posts/screens/PostDetailScreen",
  () => {
    const React = require("react");
    const {
      Pressable,
      Text,
    } = require("react-native");

    return ({ postId, onBack }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to feed"
        onPress={onBack}
      >
        <Text>{`Post detail ${postId}`}</Text>
      </Pressable>
    );
  }
);

jest.mock("../../../RestaurantBrowser", () => () => null);
jest.mock("../../../AccountApp", () => () => null);

jest.mock(
  "../../modules/posts/screens/CreatePostScreen",
  () => () => null
);

jest.mock(
  "../../modules/feed/screens/FeedRouteScreen",
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

test("Home post card opens a detail and returns without changing bottom tab", () => {
  render(<App />);

  fireEvent.press(
    screen.getByRole("button", {
      name: "Open test post",
    })
  );

  expect(
    screen.getByText("Post detail post-123")
  ).toBeTruthy();

  fireEvent.press(
    screen.getByRole("button", {
      name: "Back to feed",
    })
  );

  expect(
    screen.getByText("Feed post item")
  ).toBeTruthy();

  expect(
    screen.getByRole("tab", {
      name: "Home",
    }).props.accessibilityState.selected
  ).toBe(true);
});