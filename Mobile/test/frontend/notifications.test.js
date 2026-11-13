import React from "react";

import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react-native";

import {
  SafeAreaProvider,
} from "react-native-safe-area-context";

import NotificationCenterScreen from "../../src/modules/notifications/screens/NotificationCenterScreen";

const initialMetrics = {
  frame: {
    x: 0,
    y: 0,
    width: 390,
    height: 844,
  },
  insets: {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
};

test("notification center can return to Home", () => {
  const onBack = jest.fn();

  render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <NotificationCenterScreen
        onBack={onBack}
      />
    </SafeAreaProvider>
  );

  const button = screen.queryByRole("button", {
    name: /back/i,
  });

  if (!button) {
    throw new Error(
      'Give the notification Back control an accessibilityLabel containing "Back"'
    );
  }

  fireEvent.press(button);

  expect(onBack).toHaveBeenCalledTimes(1);
});

test.todo(
  "notification center: renders real server notifications"
);

test.todo(
  "notification center: marks a notification read using the API"
);

test.todo(
  "notification center: opens referenced post or restaurant"
);