const RestaurantPhoto = require("../models/RestaurantPhoto");
const Restaurant = require("../models/Restaurant");

async function createPhoto(restaurantId, imageUrl) {
  const restaurant = await Restaurant.findById(restaurantId);

  if (!restaurant) {
    const error = new Error("Restaurant not found");
    error.status = 404;
    throw error;
  }

  return RestaurantPhoto.create({
    restaurantId,
    imageUrl,
    status: "pending",
  });
}

module.exports = {
  createPhoto,
};