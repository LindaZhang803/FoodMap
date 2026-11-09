const restaurantService = require("../services/restaurant.service");

// Get all restaurants
async function getRestaurants(req, res) {
    try {
        const restaurants = await restaurantService.getAllRestaurants();

        res.status(200).json(restaurants);
    } catch (error) {
        console.error("Error fetching restaurants:", error);

        res.status(500).json({
            message: "Failed to fetch restaurants"
        });
    }
}

// Get restaurant by ID
async function getRestaurantDetail(req, res) {
    try {
        const restaurant = await restaurantService.getRestaurantById(
            req.params.id
        );

        return res.status(200).json(restaurant);
    } catch (error) {
        return res.status(error.status || 500).json({
            message: error.status
                ? error.message
                : "Failed to load restaurant"
        });
    }
}

module.exports = {
    getRestaurants,
    getRestaurantDetail
};