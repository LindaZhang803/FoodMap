const Restaurant = require("../models/Restaurant");
const mongoose = require("mongoose");
const { parseCatalogQuery, filterCatalog } = require('./catalogQuery');

// Get all restaurants
async function getAllRestaurants(query = {}) {
    const options = parseCatalogQuery(query);
    // Keep the existing bare-array contract for current mobile consumers.
    const restaurants = await Restaurant.find();
    let dishRestaurantIds = new Set();
    if (options.q) {
        const Dish = mongoose.models.Dish;
        if (Dish) {
            const literal = options.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const dishes = await Dish.find({ name: { $regex: literal, $options: 'i' } }).select('restaurantId').lean();
            dishRestaurantIds = new Set(dishes.map(dish => String(dish.restaurantId)));
        }
    }
    return filterCatalog(restaurants, options, dishRestaurantIds);
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
