require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const Restaurant = require("../models/Restaurant");

const {
    convertOSMToRestaurant
} = require("../services/osm.service");

const filePath = path.resolve(
    __dirname,
    "../../../../data/riverside-restaurants-with-id.geojson"
);

async function importOSM() {
    try {
        // 1. Read GeoJSON
        const data = JSON.parse(
            fs.readFileSync(filePath, "utf8")
        );

        // 2. Convert OSM data
        const restaurants = data.features
            .map(convertOSMToRestaurant)
            .filter(Boolean);

        // 3. Check duplicate IDs
        const ids = restaurants.map(
            r => `${r.osmType}/${r.osmId}`
        );

        if (new Set(ids).size !== restaurants.length) {
            throw new Error("Duplicate OSM IDs found");
        }

        console.log("Restaurants ready:", restaurants.length);

        // 4. Validate against Mongoose Schema
        for (const restaurant of restaurants) {
            const document = new Restaurant(restaurant);
            await document.validate();
        }

        console.log("Schema validation passed!");

        // 5. Dry Run
        if (!process.argv.includes("--import")) {
            console.log("DRY RUN: No data was written.");
            return;
        }

        // 6. Connect MongoDB
        if (!process.env.MONGO_URI) {
            throw new Error("MONGO_URI is missing from .env");
        }

        await mongoose.connect(process.env.MONGO_URI);

        // 7. Import restaurants
        let imported = 0;
        let updated = 0;

        for (const restaurant of restaurants) {
            const result = await Restaurant.updateOne(
                {
                    osmId: restaurant.osmId,
                    osmType: restaurant.osmType,
                    dataSource: "osm"
                },
                {
                    $setOnInsert: restaurant
                },
                {
                    upsert: true
                }
            );

            if (result.upsertedCount > 0) {
                imported++;
            } else {
                updated++;
            }
        }

        console.log("New restaurants:", imported);
        console.log("Existing restaurants skipped:", updated);

    } catch (error) {
        console.error("Import failed:", error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

importOSM();