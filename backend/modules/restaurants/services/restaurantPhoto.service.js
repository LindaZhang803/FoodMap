const RestaurantPhoto = require("../models/RestaurantPhoto");
const Restaurant = require("../models/Restaurant");
// Create a new photo review record
async function createPhoto(restaurantId, imageUrl) {
    // Check whether the restaurant exists
    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant) {
        const error = new Error("Restaurant not found");
        error.status = 404;
        throw error;
    }

    // Save the uploaded photo as pending
    const photo = await RestaurantPhoto.create({
        restaurantId,
        imageUrl,
        status: "pending",
    });

    return photo;
}

module.exports = {
    createPhoto,
};