const mongoose = require("mongoose");

const Restaurant = require(
  "../modules/restaurants/models/Restaurant"
);

const restaurantService = require(
  "../modules/restaurants/services/restaurant.service"
);

jest.mock("../modules/restaurants/models/Restaurant");

describe("Restaurant Service Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns all restaurants", async () => {
    const restaurants = [
      { name: "Sushi House" },
      { name: "Pizza Palace" },
    ];

    Restaurant.find.mockResolvedValue(restaurants);

    const result =
      await restaurantService.getAllRestaurants();

    expect(result).toEqual(restaurants);
    expect(Restaurant.find).toHaveBeenCalledTimes(1);
  });

  test("returns restaurant by valid ID", async () => {
    const id = new mongoose.Types.ObjectId().toString();

    const restaurant = {
      _id: id,
      name: "Sushi House",
    };

    Restaurant.findById.mockResolvedValue(restaurant);

    const result =
      await restaurantService.getRestaurantById(id);

    expect(result).toEqual(restaurant);
    expect(Restaurant.findById).toHaveBeenCalledWith(id);
  });

  test("rejects invalid restaurant ID", async () => {
    await expect(
      restaurantService.getRestaurantById("invalid-id")
    ).rejects.toMatchObject({
      status: 400,
      message: "Invalid restaurant ID",
    });

    expect(Restaurant.findById).not.toHaveBeenCalled();
  });

  test("returns 404 when restaurant is missing", async () => {
    const id = new mongoose.Types.ObjectId().toString();

    Restaurant.findById.mockResolvedValue(null);

    await expect(
      restaurantService.getRestaurantById(id)
    ).rejects.toMatchObject({
      status: 404,
      message: "Restaurant not found",
    });
  });

  test("propagates database errors", async () => {
    Restaurant.find.mockRejectedValue(
      new Error("Database unavailable")
    );

    await expect(
      restaurantService.getAllRestaurants()
    ).rejects.toThrow("Database unavailable");
  });
});