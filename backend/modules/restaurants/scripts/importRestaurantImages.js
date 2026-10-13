require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const Restaurant = require("../models/Restaurant");

// =====================================================
// 1. Configuration
// =====================================================

const isImport = process.argv.includes("--import");

const reviewFilePath = path.resolve(
    __dirname,
    "../../../../data/image-reviews/restaurant-image-review.json"
);

// Set the exact OSM identity of the restaurant.
// Fill these values after verifying the target in MongoDB.
const TARGET_OSM_TYPE = process.env.TARGET_OSM_TYPE;
const TARGET_OSM_ID = process.env.TARGET_OSM_ID;

// =====================================================
// 2. Validate Image Information
// =====================================================

function validateImage(image) {

    if (!image || image.status !== "approved") {
        throw new Error("Image is not approved");
    }

    if (
        !image.imageUrl ||
        !image.sourceUrl ||
        !image.license ||
        !image.licenseUrl ||
        !image.author
    ) {
        throw new Error("Incomplete image information");
    }

    const imageURL = new URL(image.imageUrl);
    const sourceURL = new URL(image.sourceUrl);
    const licenseURL = new URL(image.licenseUrl);

    const imageHosts = [
        "upload.wikimedia.org",
        "thumb.wikimedia.org"
    ];

    if (
        imageURL.protocol !== "https:" ||
        !imageHosts.includes(imageURL.hostname)
    ) {
        throw new Error("Invalid Wikimedia image URL");
    }

    if (
        sourceURL.protocol !== "https:" ||
        sourceURL.hostname !== "commons.wikimedia.org"
    ) {
        throw new Error("Invalid source URL");
    }

    if (licenseURL.protocol !== "https:") {
        throw new Error("Invalid license URL");
    }

    if (
        image.author === "Unknown" ||
        image.license === "Unknown"
    ) {
        throw new Error("Image attribution is incomplete");
    }

    // Wikimedia may return artist metadata containing HTML.
    // Store a plain-text representation.
    const author = image.author
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    if (!author) {
        throw new Error("Image author is missing");
    }

    return {
        imageUrl: imageURL.href,
        imageSource: sourceURL.href,
        imageAuthor: author,
        imageLicense: image.license,
        imageLicenseUrl: licenseURL.href
    };
}

// =====================================================
// 3. Import Approved Images
// =====================================================

async function importRestaurantImages() {

    try {

        // Read review file
        const reviewData = JSON.parse(
            fs.readFileSync(reviewFilePath, "utf8")
        );

        console.log(
            "Restaurant:",
            reviewData.restaurantName
        );

        const approvedImages = reviewData.images.filter(
            image => image.status === "approved"
        );

        console.log(
            "Approved images:",
            approvedImages.length
        );

        // No approved image
        if (approvedImages.length === 0) {
            console.log(
                "No approved images. Database unchanged."
            );
            return;
        }

        // Only one approved image per restaurant
        if (approvedImages.length > 1) {
            throw new Error(
                "More than one approved image found"
            );
        }

        // Validate image metadata
        const imageData = validateImage(
            approvedImages[0]
        );

        console.log("Image validation passed!");
        console.log("Image URL:", imageData.imageUrl);
        console.log("Source:", imageData.imageSource);
        console.log("License:", imageData.imageLicense);

        // Dry Run
        if (!isImport) {
            console.log("DRY RUN: No data was written.");
            return;
        }

        if (
            !["node", "way", "relation"].includes(TARGET_OSM_TYPE) ||
            !/^\d+$/.test(TARGET_OSM_ID || "")
        ) {
            throw new Error(
                "Set valid TARGET_OSM_TYPE and TARGET_OSM_ID before importing"
            );
        }

        const mongoUri =
            process.env.MONGO_URI ||
            process.env.MONGODB_URI;

        if (!mongoUri) {
            throw new Error("MongoDB URI is missing");
        }

        // Connect to MongoDB
        await mongoose.connect(mongoUri);

        // Find exact restaurant
        const restaurant = await Restaurant.findOne({
            osmType: TARGET_OSM_TYPE,
            osmId: TARGET_OSM_ID,
            dataSource: "osm"
        });

        if (!restaurant) {
            throw new Error("Restaurant not found");
        }

        if (
            restaurant.name.trim().toLowerCase() !==
            reviewData.restaurantName.trim().toLowerCase()
        ) {
            throw new Error(
                "Restaurant name does not match review"
            );
        }

        console.log(
            "Matched restaurant:",
            restaurant.name
        );

        // Do not overwrite an existing image
        if (restaurant.imageUrl) {
            throw new Error(
                "Restaurant already has an image. Review manually before replacing."
            );
        }

        // Update restaurant
        Object.assign(restaurant, imageData);

        await restaurant.save();

        console.log(
            "Restaurant image imported successfully!"
        );

    } catch (error) {

        console.error(
            "Image import failed:",
            error.message
        );

        process.exitCode = 1;

    } finally {

        await mongoose.disconnect();

    }
}

importRestaurantImages();