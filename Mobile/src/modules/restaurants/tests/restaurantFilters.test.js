import {
  filterRestaurants,
  getDistanceKm,
  DEFAULT_FILTERS,
} from "../utils/restaurantFilters";

const restaurants = [
  {
    _id: "1",
    name: "Sushi House",
    cuisineType: "japanese",
    address: "Riverside, CA",
    priceRange: "$$",
    rating: 4.5,
    latitude: 33.9806,
    longitude: -117.3755,
  },
  {
    _id: "2",
    name: "Taco Place",
    cuisineType: "mexican",
    address: "Riverside, CA",
    priceRange: "$",
    rating: 4.0,
    latitude: 33.9906,
    longitude: -117.3755,
  },
  {
    _id: "3",
    name: "Pizza Palace",
    cuisineType: "italian",
    address: "Los Angeles, CA",
    priceRange: "$$$",
    rating: 3.5,
    latitude: 34.0522,
    longitude: -118.2437,
  },
];

const userLocation = {
  latitude: 33.9806,
  longitude: -117.3755,
};

function makeFilters(overrides = {}) {
  return {
    ...DEFAULT_FILTERS,
    ...overrides,
  };
}

describe("Restaurant Filters", () => {
  test("returns all restaurants when no filters are selected", () => {
    const result = filterRestaurants(
      restaurants,
      "",
      makeFilters(),
      null
    );

    expect(result).toHaveLength(3);
  });

  test("searches restaurants by name", () => {
    const result = filterRestaurants(
      restaurants,
      "sushi",
      makeFilters(),
      null
    );

    expect(result.map((r) => r.name)).toEqual(["Sushi House"]);
  });

  test("searches restaurants by cuisine", () => {
    const result = filterRestaurants(
      restaurants,
      "mexican",
      makeFilters(),
      null
    );

    expect(result.map((r) => r.name)).toEqual(["Taco Place"]);
  });

  test("searches restaurants by address", () => {
    const result = filterRestaurants(
      restaurants,
      "Los Angeles",
      makeFilters(),
      null
    );

    expect(result.map((r) => r.name)).toEqual(["Pizza Palace"]);
  });

  test("filters restaurants by cuisine", () => {
    const result = filterRestaurants(
      restaurants,
      "",
      makeFilters({ cuisine: "japanese" }),
      null
    );

    expect(result.map((r) => r.name)).toEqual(["Sushi House"]);
  });

  test("converts price levels to estimated numeric ranges", () => {
    const result = filterRestaurants(
      restaurants,
      "",
      makeFilters({
        minPrice: "15",
        maxPrice: "25",
      }),
      null
    );

    expect(result.map((r) => r.name)).toEqual(["Sushi House"]);
  });

  test("filters restaurants by minimum rating", () => {
    const result = filterRestaurants(
      restaurants,
      "",
      makeFilters({ minRating: 4.5 }),
      null
    );

    expect(result.map((r) => r.name)).toEqual(["Sushi House"]);
  });

  test("calculates zero distance for identical coordinates", () => {
    const distance = getDistanceKm(
      33.9806,
      -117.3755,
      33.9806,
      -117.3755
    );

    expect(distance).toBeCloseTo(0, 5);
  });

  test("filters restaurants by distance", () => {
    const result = filterRestaurants(
      restaurants,
      "",
      makeFilters({ distance: 5 }),
      userLocation
    );

    expect(result.map((r) => r.name)).toEqual([
      "Sushi House",
      "Taco Place",
    ]);
  });

  test("supports custom distance", () => {
    const result = filterRestaurants(
      restaurants,
      "",
      makeFilters({ customDistance: "0.5" }),
      userLocation
    );

    expect(result.map((r) => r.name)).toEqual(["Sushi House"]);
  });

  test("combines cuisine and distance filters", () => {
    const result = filterRestaurants(
      restaurants,
      "",
      makeFilters({
        cuisine: "mexican",
        distance: 5,
      }),
      userLocation
    );

    expect(result.map((r) => r.name)).toEqual(["Taco Place"]);
  });

  test("returns an empty list when no restaurant matches", () => {
    const result = filterRestaurants(
      restaurants,
      "nonexistent123",
      makeFilters(),
      null
    );

    expect(result).toEqual([]);
  });

  test("excludes restaurants without location when distance is required", () => {
    const result = filterRestaurants(
      restaurants,
      "",
      makeFilters({ distance: 5 }),
      null
    );

    expect(result).toEqual([]);
  });
});