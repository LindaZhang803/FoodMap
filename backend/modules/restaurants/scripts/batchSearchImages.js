require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const Restaurant = require("../models/Restaurant");

const {
    searchRestaurantImages
} = require("../services/restaurantImage.service");

// =====================================================
// Configuration
// =====================================================

const mongoUri =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI;

const outputPath = path.resolve(
    __dirname,
    "../../../../data/image-reviews/batch-image-candidates.json"
);

// Start with 5 restaurants for testing
const MAX_RESTAURANTS = 5;

// Delay between requests in milliseconds
const REQUEST_DELAY = 1500;

// =====================================================
// Helper Functions
// =====================================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeImage(image) {
    return {
        title: image.title,
        imageUrl: image.imageUrl,
        sourceUrl: image.sourceUrl,
        author: image.author,
        license: image.license,
        licenseUrl: image.licenseUrl,
        status: "pending"
    };
}

// =====================================================
// Batch Search
// =====================================================

async function batchSearchImages() {

    try {

        if (!mongoUri) {
            throw new Error("MongoDB URI is missing");
        }

        await mongoose.connect(mongoUri);

        console.log("MongoDB connected.");

        // Fetch OSM restaurants without images
        const restaurants = await Restaurant.find({
            dataSource: "osm",
            $or: [
                { imageUrl: null },
                { imageUrl: "" },
                { imageUrl: { $exists: false } }
            ]
        })
        .sort({ osmType: 1, osmId: 1 })
        .limit(MAX_RESTAURANTS)
        .lean();

        console.log(
            "Restaurants selected:",
            restaurants.length
        );

        const results = [];

        for (let i = 0; i < restaurants.length; i++) {

            const restaurant = restaurants[i];

            console.log(
                `\n[${i + 1}/${restaurants.length}]`,
                restaurant.name
            );

            try {

                const images = await searchRestaurantImages(
                    restaurant.name,
                    "Riverside California"
                );

                console.log(
                    "Candidates:",
                    images.length
                );

                results.push({
                    restaurant: {
                        mongoId: String(restaurant._id),
                        osmId: restaurant.osmId,
                        osmType: restaurant.osmType,
                        name: restaurant.name,
                        address: restaurant.address,
                        latitude: restaurant.latitude,
                        longitude: restaurant.longitude
                    },

                    images: images.map(normalizeImage)
                });

            } catch (error) {

                console.error(
                    "Search failed:",
                    error.message
                );

                results.push({
                    restaurant: {
                        mongoId: String(restaurant._id),
                        osmId: restaurant.osmId,
                        osmType: restaurant.osmType,
                        name: restaurant.name,
                        address: restaurant.address,
                        latitude: restaurant.latitude,
                        longitude: restaurant.longitude
                    },

                    images: [],
                    error: error.message
                });
            }

            // Respect API request limits
            if (i < restaurants.length - 1) {
                await sleep(REQUEST_DELAY);
            }
        }

        // =================================================
        // Save Results
        // =================================================

        fs.mkdirSync(
            path.dirname(outputPath),
            { recursive: true }
        );

        const output = {
            generatedAt: new Date().toISOString(),
            totalRestaurants: results.length,
            restaurants: results
        };

        fs.writeFileSync(
            outputPath,
            JSON.stringify(output, null, 2),
            "utf8"
        );

        console.log("\nBatch search completed.");
        console.log("Output:", outputPath);

        const totalCandidates = results.reduce(
            (total, item) => total + item.images.length,
            0
        );

        console.log(
            "Total image candidates:",
            totalCandidates
        );

    } catch (error) {

        console.error(
            "Batch search failed:",
            error.message
        );

        process.exitCode = 1;

    } finally {

        await mongoose.disconnect();

    }
}

batchSearchImages();