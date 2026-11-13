import React from "react";

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";

import RestaurantDetailScreen from "../../src/modules/restaurants/screens/RestaurantDetailScreen";

jest.mock(
  "../../modules/restaurants/components/PhotoUploadButton",
  () => () => null
);

const restaurant = {
  _id: "rest-1",
  name: "Sushi One",
  address: "123 Main St",
  cuisineType: "Japanese",
  priceRange: "$$",
  rating: null,
  reviewCount: 0,
  openingHours: "10 AM - 9 PM",
};

let previousFetch;

beforeEach(() => {
  previousFetch = global.fetch;

  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => restaurant,
  }));
});

afterEach(() => {
  global.fetch = previousFetch;
});

test("shows restaurant details, unrated state, and browse action", async () => {
  const onViewDishes = jest.fn();
  const onBack = jest.fn();

  render(
    <RestaurantDetailScreen
      restaurantId="rest-1"
      onBack={onBack}
      onViewDishes={onViewDishes}
    />
  );

  await waitFor(() =>
    expect(
      screen.getByText("Sushi One")
    ).toBeTruthy()
  );

  expect(
    screen.getByText("No ratings yet")
  ).toBeTruthy();

  expect(
    screen.getAllByText("123 Main St").length
  ).toBeGreaterThan(0);

  fireEvent.press(
    screen.getByRole("button", {
      name: "Browse dishes and reviews",
    })
  );

  expect(
    onViewDishes
  ).toHaveBeenCalledTimes(1);

  fireEvent.press(
    screen.getByRole("button", {
      name: "Back to restaurants",
    })
  );

  expect(
    onBack
  ).toHaveBeenCalledTimes(1);
});

test("shows an error and a retry action if restaurant fetch fails", async () => {
  global.fetch.mockResolvedValueOnce({
    ok: false,
    status: 404,
  });

  render(
    <RestaurantDetailScreen
      restaurantId="missing"
      onBack={jest.fn()}
    />
  );

  await waitFor(() =>
    expect(
      screen.getByText("Restaurant unavailable")
    ).toBeTruthy()
  );

  expect(
    screen.getByText("Restaurant not found")
  ).toBeTruthy();
});