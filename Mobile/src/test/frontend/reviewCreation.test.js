import React from "react";

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";

import ReviewPanel from "../../src/modules/reviews/components/ReviewPanel";

jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
}));

function makeRepository() {
  return {
    list: jest.fn(async () => ({
      reviews: [],
      statistics: {
        averageRating: null,
        reviewCount: 0,
      },
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
      },
    })),

    create: jest.fn(async () => ({
      statistics: {
        averageRating: 5,
        reviewCount: 1,
      },
    })),

    edit: jest.fn(),
    remove: jest.fn(),
    like: jest.fn(),
    uploadPhoto: jest.fn(),
  };
}

test("invalid review is blocked locally before API submission", async () => {
  const repository = makeRepository();

  render(
    <ReviewPanel
      restaurantId="r-1"
      repository={repository}
      token="test-token"
      origin="https://example.test"
    />
  );

  await waitFor(() =>
    expect(
      screen.getByText("Write a restaurant review")
    ).toBeTruthy()
  );

  fireEvent.press(
    screen.getByText("Submit Review")
  );

  expect(
    repository.create
  ).not.toHaveBeenCalled();

  expect(
    screen.getByText(
      "Please enter a review title."
    )
  ).toBeTruthy();
});

test("overall rating and optional spiciness controls can be selected independently", async () => {
  const repository = makeRepository();

  render(
    <ReviewPanel
      restaurantId="r-1"
      repository={repository}
      token="test-token"
      origin="https://example.test"
    />
  );

  await waitFor(() =>
    expect(
      screen.getByText("Write a restaurant review")
    ).toBeTruthy()
  );

  fireEvent.press(
    screen.getByRole("button", {
      name: "4 stars",
    })
  );

  fireEvent.press(
    screen.getByRole("button", {
      name: "2 spiciness",
    })
  );

  expect(
    screen.getByRole("button", {
      name: "4 stars",
    }).props.accessibilityState.selected
  ).toBe(true);

  expect(
    screen.getByRole("button", {
      name: "2 spiciness",
    }).props.accessibilityState.selected
  ).toBe(true);

  fireEvent.press(
    screen.getByRole("button", {
      name: "Clear spiciness rating",
    })
  );

  expect(
    screen.getByRole("button", {
      name: "2 spiciness",
    }).props.accessibilityState.selected
  ).toBe(false);
});