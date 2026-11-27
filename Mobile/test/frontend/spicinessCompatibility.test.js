import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";

import PostDetailScreen from "../../src/modules/posts/screens/PostDetailScreen";
import PostFeedScreen from "../../src/modules/posts/screens/PostFeedScreen";
import RestaurantDetailScreen from "../../src/modules/restaurants/screens/RestaurantDetailScreen";
import DishBrowserScreen from "../../src/modules/reviews/screens/DishBrowserScreen";

jest.mock("../../src/config/api", () => ({ API_ORIGIN: "http://foodmap.test" }));
jest.mock("../../src/modules/reviews/components/ReviewPanel", () => () => null);
jest.mock("../../src/modules/restaurants/components/PhotoUploadButton", () => () => null);

const token = "test-session";
const note = "Spiciness compatibility is based on community ratings and is not a medical or allergen safety guarantee.";
const restaurant = { _id: "r1", name: "Noodle House" };
const dish = {
  id: "d1",
  name: "Chili noodles",
  restaurantId: "r1",
  averageRating: 4,
  reviewCount: 7,
  medianSpiciness: 5,
  spicinessRatingCount: 7,
  reviews: [],
};

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = jest.fn(async (url, options) => {
    const { pathname } = new URL(url);
    const signedIn = options?.headers?.Authorization === `Bearer ${token}`;
    const ratedDish = {
      ...dish,
      spicinessCompatibility: signedIn ? "Above Preference" : "Unknown",
      spicinessCompatibilityNote: note,
    };
    const post = { id: "p1", title: "Lunch", restaurant, dish: ratedDish };
    const payloads = {
      "/api/restaurants/r1": restaurant,
      "/api/dishes": [ratedDish],
      "/api/dishes/d1": ratedDish,
      "/api/posts": {
        items: [
          post,
          { ...post, id: "p2", title: "Dinner" },
          { id: "p3", title: "Restaurant review", restaurant },
        ],
      },
      "/api/posts/p1": { post },
    };
    if (!Object.hasOwn(payloads, pathname)) {
      throw new Error(`Unexpected request: ${url}`);
    }
    return { ok: true, json: async () => payloads[pathname] };
  });
});

afterEach(() => {
  global.fetch = originalFetch;
});

test("dish list and detail display the signed-in label and reset to a guest result on logout", async () => {
  const { rerender } = render(
    <DishBrowserScreen restaurantId="r1" isAuthenticated authToken={token} />
  );
  expect(await screen.findByText("Above Preference")).toBeOnTheScreen();
  expect(screen.getByText(note)).toBeOnTheScreen();

  fireEvent.press(screen.getByText("Chili noodles"));
  expect(await screen.findByText("Median Spiciness")).toBeOnTheScreen();
  expect(screen.getByText("5")).toBeOnTheScreen();
  expect(screen.getByText("Above Preference")).toBeOnTheScreen();
  expect(screen.getByText(note)).toBeOnTheScreen();

  rerender(<DishBrowserScreen restaurantId="r1" />);
  expect(screen.queryByText("Above Preference")).toBeNull();
  expect(await screen.findByText("Unknown")).toBeOnTheScreen();
});

test("the inline restaurant menu uses the signed-in compatibility result", async () => {
  const { rerender } = render(<RestaurantDetailScreen restaurantId="r1" token={token} />);
  expect(await screen.findByText("Above Preference")).toBeOnTheScreen();
  expect(screen.getByText(note)).toBeOnTheScreen();

  rerender(<RestaurantDetailScreen restaurantId="r1" />);
  expect(screen.queryByText("Above Preference")).toBeNull();
  expect(await screen.findByText("Unknown")).toBeOnTheScreen();
});

test("Home cards show each result with one community-rating note for the feed", async () => {
  const { rerender } = render(<PostFeedScreen token={token} />);
  expect(await screen.findAllByText("Above Preference")).toHaveLength(2);
  expect(screen.getAllByText(note)).toHaveLength(1);

  rerender(<PostFeedScreen />);
  expect(screen.queryByText("Above Preference")).toBeNull();
  expect(await screen.findAllByText("Unknown")).toHaveLength(2);
});

test("post detail displays the dish compatibility result beside its note", async () => {
  const { rerender } = render(<PostDetailScreen postId="p1" token={token} />);
  expect(await screen.findByText("Above Preference")).toBeOnTheScreen();
  expect(screen.getByText(note)).toBeOnTheScreen();

  rerender(<PostDetailScreen postId="p1" />);
  expect(screen.queryByText("Above Preference")).toBeNull();
  expect(await screen.findByText("Unknown")).toBeOnTheScreen();
});
