import { sortRestaurants } from "../utils/restaurantSorting";

const restaurants = [
  {
    _id: "1",
    name: "Sushi House",
    rating: 4.5,
    reviewCount: 100,
    priceRange: "$$",
    latitude: 33.9806,
    longitude: -117.3755,
  },
  {
    _id: "2",
    name: "Taco Place",
    rating: 4.0,
    reviewCount: 250,
    priceRange: "$",
    latitude: 33.9906,
    longitude: -117.3755,
  },
  {
    _id: "3",
    name: "Pizza Palace",
    rating: 3.5,
    reviewCount: 50,
    priceRange: "$$$",
    latitude: 34.0522,
    longitude: -118.2437,
  },
];

const userLocation = {
  latitude: 33.9806,
  longitude: -117.3755,
};

describe("Restaurant Sorting", () => {
  test("keeps original order by default", () => {
    const result = sortRestaurants(restaurants, "default", null);

    expect(result.map((r) => r.name)).toEqual([
      "Sushi House",
      "Taco Place",
      "Pizza Palace",
    ]);
  });

  test("sorts by highest rating", () => {
    const result = sortRestaurants(restaurants, "rating", null);

    expect(result.map((r) => r.name)).toEqual([
      "Sushi House",
      "Taco Place",
      "Pizza Palace",
    ]);
  });

  test("sorts by popularity", () => {
    const result = sortRestaurants(restaurants, "popular", null);

    expect(result.map((r) => r.name)).toEqual([
      "Taco Place",
      "Sushi House",
      "Pizza Palace",
    ]);
  });

  test("sorts by nearest distance", () => {
    const result = sortRestaurants(restaurants, "nearest", userLocation);

    expect(result.map((r) => r.name)).toEqual([
      "Sushi House",
      "Taco Place",
      "Pizza Palace",
    ]);
  });

  test("sorts price from low to high", () => {
    const result = sortRestaurants(restaurants, "priceAsc", null);

    expect(result.map((r) => r.name)).toEqual([
      "Taco Place",
      "Sushi House",
      "Pizza Palace",
    ]);
  });

  test("sorts price from high to low", () => {
    const result = sortRestaurants(restaurants, "priceDesc", null);

    expect(result.map((r) => r.name)).toEqual([
      "Pizza Palace",
      "Sushi House",
      "Taco Place",
    ]);
  });

  test("does not modify original restaurant data", () => {
    const original = restaurants.map((r) => r.name);

    sortRestaurants(restaurants, "rating", null);

    expect(restaurants.map((r) => r.name)).toEqual(original);
  });

  test("places restaurants without ratings last", () => {
    const data = [
      {
        _id: "4",
        name: "Unknown Restaurant",
        rating: null,
      },
      ...restaurants,
    ];

    const result = sortRestaurants(data, "rating", null);

    expect(result[result.length - 1].name).toBe(
      "Unknown Restaurant"
    );
  });
});