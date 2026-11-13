import React from "react";

import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react-native";

import NotificationCenterScreen from "../../src/modules/notifications/screens/NotificationCenterScreen";

test("notification center can return to Home", () => {
  const onBack = jest.fn();

  render(
    <NotificationCenterScreen
      onBack={onBack}
    />
  );

  const button =
    screen.queryByRole("button", {
      name: /back/i,
    });

  if (!button) {
    throw new Error(
      'Give the notification Back control an accessibilityLabel containing "Back"'
    );
  }

  fireEvent.press(button);

  expect(
    onBack
  ).toHaveBeenCalledTimes(1);
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