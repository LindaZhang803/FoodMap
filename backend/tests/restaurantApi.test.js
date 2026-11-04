const request = require("supertest");
const mongoose = require("mongoose");

// Mock the restaurant service.
// No real MongoDB connection is needed.
jest.mock("../modules/restaurants/services/restaurant.service", () => ({
  getAllRestaurants: jest.fn(),
  getRestaurantById: jest.fn(),
}));

const restaurantService = require(
  "../modules/restaurants/services/restaurant.service"
);

// Import Express app without starting the server.
const app = require("../server");

describe("Restaurant API Tests", () => {
  const validId = new mongoose.Types.ObjectId().toString();

  const mockRestaurant = {
    _id: validId,
    name: "Sushi House",
    description: "Japanese restaurant",
    address: "Riverside, CA",
    cuisineType: "japanese",
    priceRange: "$$",
    rating: 4.5,
    reviewCount: 100,
    latitude: 33.9806,
    longitude: -117.3755,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // Test 1: Restaurant List
  // ========================================

  test("GET /api/restaurants returns all restaurants", async () => {
    restaurantService.getAllRestaurants.mockResolvedValue([
      mockRestaurant,
    ]);

    const response = await request(app)
      .get("/api/restaurants");

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].name).toBe("Sushi House");

    expect(
      restaurantService.getAllRestaurants
    ).toHaveBeenCalledTimes(1);
  });

  // ========================================
  // Test 2: Restaurant Details
  // ========================================

  test("GET /api/restaurants/:id returns restaurant details", async () => {
    restaurantService.getRestaurantById.mockResolvedValue(
      mockRestaurant
    );

    const response = await request(app)
      .get(`/api/restaurants/${validId}`);

    expect(response.status).toBe(200);
    expect(response.body.name).toBe("Sushi House");
    expect(response.body.rating).toBe(4.5);

    expect(
      restaurantService.getRestaurantById
    ).toHaveBeenCalledWith(validId);
  });

  // ========================================
  // Test 3: Invalid Restaurant ID
  // ========================================

  test("GET /api/restaurants/invalid-id returns 400", async () => {
    const error = new Error("Invalid restaurant ID");
    error.status = 400;

    restaurantService.getRestaurantById.mockRejectedValue(
      error
    );

    const response = await request(app)
      .get("/api/restaurants/invalid-id");

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      message: "Invalid restaurant ID",
    });
  });

  // ========================================
  // Test 4: Restaurant Not Found
  // ========================================

  test("GET /api/restaurants/:id returns 404 when missing", async () => {
    const error = new Error("Restaurant not found");
    error.status = 404;

    restaurantService.getRestaurantById.mockRejectedValue(
      error
    );

    const response = await request(app)
      .get(`/api/restaurants/${validId}`);

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      message: "Restaurant not found",
    });
  });

  // ========================================
  // Test 5: Server Error
  // ========================================

  test("GET /api/restaurants returns 500 on service failure", async () => {
    restaurantService.getAllRestaurants.mockRejectedValue(
      new Error("Database unavailable")
    );

    // Suppress the expected error log for this test.
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    try {
      const response = await request(app)
        .get("/api/restaurants");

      expect(response.status).toBe(500);

      expect(response.body).toEqual({
        message: "Failed to fetch restaurants",
      });
    } finally {
      consoleSpy.mockRestore();
    }
  });
});