import React from "react";

import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react-native";

import ProfileScreen from "../../src/modules/accounts/screens/ProfileScreen";

jest.mock(
  "../../modules/accounts/screens/ReviewHistorySection",
  () => {
    const React = require("react");
    const { Text } = require("react-native");

    return () => (
      <Text>Review history fixture</Text>
    );
  }
);

jest.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: jest.fn(),
}));

const user = {
  id: "user-1",
  username: "Alice",
  email: "alice@example.test",
  bio: "Loves noodles",
  favoriteCuisines: ["Japanese"],
  foodPreferences: ["Mild"],
};

test("profile displays user details and opens editor", () => {
  render(
    <ProfileScreen
      user={user}
      token="token"
      onLogout={jest.fn()}
      onSave={jest.fn()}
      onChangeAvatar={jest.fn()}
    />
  );

  expect(
    screen.getByText("Alice")
  ).toBeTruthy();

  expect(
    screen.getByText("alice@example.test")
  ).toBeTruthy();

  expect(
    screen.getByText("Loves noodles")
  ).toBeTruthy();

  fireEvent.press(
    screen.getByText("Edit Profile")
  );

  expect(
    screen.getByText("Save Changes")
  ).toBeTruthy();
});

test("collections callbacks lead to the existing favorites navigation", () => {
  const onOpenFavorites = jest.fn();
  const onOpenWantToTry = jest.fn();

  render(
    <ProfileScreen
      user={user}
      token="token"
      onLogout={jest.fn()}
      onSave={jest.fn()}
      onOpenFavorites={onOpenFavorites}
      onOpenWantToTry={onOpenWantToTry}
    />
  );

  fireEvent.press(
    screen.getByRole("button", {
      name: "View Favorites",
    })
  );

  fireEvent.press(
    screen.getByRole("button", {
      name: "View Want to Try",
    })
  );

  expect(
    onOpenFavorites
  ).toHaveBeenCalledTimes(1);

  expect(
    onOpenWantToTry
  ).toHaveBeenCalledTimes(1);
});