const Restaurant = require("../models/Restaurant");
const mongoose = require("mongoose");

// Get all restaurants
async function getAllRestaurants() {
    return await Restaurant.find();
}

// Get restaurant by ID
async function getRestaurantById(id) {

    if (!mongoose.isValidObjectId(id)) {
        const error = new Error("Invalid restaurant ID");
        error.status = 400;
        throw error;
    }

    const restaurant = await Restaurant.findById(id);

    if (!restaurant) {
        const error = new Error("Restaurant not found");
        error.status = 404;
        throw error;
    }

    return restaurant;
}

module.exports = {
    getAllRestaurants,
    getRestaurantById
};