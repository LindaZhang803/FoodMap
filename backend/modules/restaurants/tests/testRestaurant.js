require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("../../../database/connect");
const Restaurant = require("../models/Restaurant");

async function testRestaurant() {
    try {
        await connectDB();

        // Create a restaurant
        const restaurant = await Restaurant.create({
            name: "Sushi House",
            description: "Japanese restaurant",
            address: "Riverside, CA",
            latitude: 33.9806,
            longitude: -117.3755,
            cuisineType: "Japanese",
            priceRange: "$$",
            rating: 4.5,
            reviewCount: 100,
            imageUrl: "https://example.com/sushi.jpg",
            openingHours: "10:00 AM - 9:00 PM"
        });

        console.log("Restaurant created successfully!");
        console.log("Restaurant ID:", restaurant._id);

        // Read the restaurant
        const savedRestaurant = await Restaurant.findById(
            restaurant._id
        );

        console.log("Restaurant retrieved successfully!");
        console.log(savedRestaurant);

    } catch (error) {
        console.error("Restaurant test failed:", error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

testRestaurant();