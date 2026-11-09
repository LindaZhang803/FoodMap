require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("../../../database/connect");
const Restaurant = require("../models/Restaurant");

async function testPersistence() {
    try {
        await connectDB();

        const restaurants = await Restaurant.find();

        console.log("Saved restaurants:");
        console.log(restaurants);

        console.log("Total restaurants:", restaurants.length);

    } catch (error) {
        console.error("Persistence test failed:", error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

testPersistence();