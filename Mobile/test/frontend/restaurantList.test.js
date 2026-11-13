import React from "react";

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";

import RestaurantListScreen from "../../src/modules/restaurants/screens/RestaurantListScreen";

import {
  getRestaurants,
} from "../../src/modules/restaurants/services/restaurantApi";

jest.mock(
  "../../src/modules/restaurants/services/restaurantApi",
  () => ({
    getRestaurants: jest.fn(),
  })
);

jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn(
    async () => ({ status: "denied" })
  ),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

const list = [
  {
    _id: "r-1",
    name: "Sushi One",
    cuisineType: "Japanese",
    priceRange: "$$",
    rating: null,
    reviewCount: 0,
  },
  {
    _id: "r-2",
    name: "Pizza Two",
    cuisineType: "Italian",
    priceRange: "$",
    rating: 4.2,
    reviewCount: 8,
  },
];

beforeEach(() => {
  getRestaurants.mockResolvedValue(list);
});

test("renders restaurant cards and an unrated fallback", async () => {
  const onSelectRestaurant = jest.fn();

  render(
    <RestaurantListScreen
      onSelectRestaurant={onSelectRestaurant}
    />
  );

  await waitFor(() =>
    expect(
      screen.getByText("Sushi One")
    ).toBeTruthy()
  );

  expect(
    screen.getAllByText("No ratings yet").length
  ).toBeGreaterThan(0);

  expect(
    screen.getByText("Pizza Two")
  ).toBeTruthy();

  fireEvent.press(
    screen.getByRole("button", {
      name: "View Sushi One",
    })
  );

  expect(
    onSelectRestaurant
  ).toHaveBeenCalledWith(list[0]);
});

test("keyword search filters the restaurant list", async () => {
  render(
    <RestaurantListScreen
      onSelectRestaurant={jest.fn()}
    />
  );

  await waitFor(() =>
    expect(
      screen.getByText("Sushi One")
    ).toBeTruthy()
  );

  const input =
    screen.queryByPlaceholderText(/search/i);

  if (!input) {
    throw new Error(
      "Update search input selector to match RestaurantListScreen AppInput"
    );
  }

  fireEvent.changeText(input, "Sushi");

  expect(
    screen.getByText("Sushi One")
  ).toBeTruthy();

  expect(
    screen.queryByText("Pizza Two")
  ).toBeNull();
});