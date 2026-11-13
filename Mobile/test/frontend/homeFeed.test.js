import React from "react";

import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react-native";

import App from "../../App";

// Mock Safe Area Context for Jest
jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");

  const SafeAreaInsetsContext =
    React.createContext({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    });

  return {
    SafeAreaProvider: ({ children }) => (
      <SafeAreaInsetsContext.Provider
        value={{
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        }}
      >
        <View>{children}</View>
      </SafeAreaInsetsContext.Provider>
    ),

    SafeAreaView: ({ children, ...props }) => (
      <View {...props}>{children}</View>
    ),

    SafeAreaInsetsContext,

    useSafeAreaInsets: () => ({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    }),
  };
});

jest.mock(
  "../../src/modules/accounts/hooks/useAuthSession",
  () => ({
    __esModule: true,
    default: () => ({
      auth: { phase: "signedOut" },
      logout: jest.fn(),
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
    }),
  })
);

jest.mock(
  "../../src/modules/posts/screens/PostFeedScreen",
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
  "../../src/modules/posts/screens/PostDetailScreen",
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

jest.mock("../../RestaurantBrowser", () => () => null);
jest.mock("../../AccountApp", () => () => null);

jest.mock(
  "../../src/modules/posts/screens/CreatePostScreen",
  () => () => null
);

jest.mock(
  "../../src/modules/feed/screens/FeedRouteScreen",
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