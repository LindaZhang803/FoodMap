const express = require("express");

const router = express.Router();

const restaurantController = require(
    "../controllers/restaurant.controller"
);

// Get all restaurants
router.get("/", restaurantController.getRestaurants);

// Get restaurant by ID
router.get("/:id", restaurantController.getRestaurantDetail);

module.exports = router;