import React from "react";

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";

import DishBrowserScreen from "../../src/modules/reviews/screens/DishBrowserScreen";

const mockGetDish = jest.fn();
const mockGetDishes = jest.fn();

jest.mock(
  "../../src/modules/reviews/services/dishRepository",
  () => ({
    createDishRepository: () => ({
      getDish: mockGetDish,
      getDishes: mockGetDishes,
    }),
  })
);

jest.mock(
  "../../src/modules/reviews/services/reviewRepository",
  () => ({
    createReviewRepository: () => ({
      list: jest.fn(),
    }),
  })
);

jest.mock(
  "../../src/modules/reviews/components/ReviewPanel",
  () => {
    const React = require("react");
    const { Text } = require("react-native");

    return () => <Text>Review list fixture</Text>;
  }
);

beforeEach(() => {
  mockGetDish.mockReset().mockResolvedValue({
    id: "dish-1",
    name: "Spicy Ramen",
    description: "Hot noodles",
    price: 12.5,
    averageRating: 4.5,
    reviewCount: 2,
    medianSpiciness: 3,
    spicinessDistribution: {
      "1": 0,
      "3": 2,
    },
  });

  mockGetDishes.mockReset().mockResolvedValue([]);
});

test("dish detail renders price, overall rating and spiciness separately", async () => {
  const onToggleDishFavorite = jest.fn();
  const onAddDishToWheel = jest.fn();

  render(
    <DishBrowserScreen
      restaurantId="r-1"
      initialDishId="dish-1"
      restaurantName="Noodle House"
      isDishFavorite={() => false}
      isDishFavoriteLoading={() => false}
      onToggleDishFavorite={
        onToggleDishFavorite
      }
      onAddDishToWheel={
        onAddDishToWheel
      }
    />
  );

  await waitFor(() =>
    expect(
      screen.getByText("Spicy Ramen")
    ).toBeTruthy()
  );

  expect(
    screen.getByText("Noodle House")
  ).toBeTruthy();

  expect(
    screen.getByText("$12.50")
  ).toBeTruthy();

  expect(
    screen.getByText("Overall Rating")
  ).toBeTruthy();

  expect(
    screen.getByText("Median Spiciness")
  ).toBeTruthy();

  expect(
    screen.getByText("Spiciness Distribution")
  ).toBeTruthy();

  fireEvent.press(
    screen.getByRole("button", {
      name: "Add dish to Want to Try",
    })
  );

  expect(
    onToggleDishFavorite
  ).toHaveBeenCalledWith(
    expect.objectContaining({
      id: "dish-1",
    })
  );

  fireEvent.press(
    screen.getByRole("button", {
      name: "Add dish to Wheel",
    })
  );

  expect(
    onAddDishToWheel
  ).toHaveBeenCalledWith(
    expect.objectContaining({
      id: "dish-1",
    })
  );
});

test("missing dish data shows an explicit empty state", async () => {
  render(
    <DishBrowserScreen
      restaurantId="r-1"
    />
  );

  await waitFor(() =>
    expect(
      screen.getByText("No dishes available")
    ).toBeTruthy()
  );
});