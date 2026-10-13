const mongoose = require("mongoose");

const restaurantSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },

    description: {
        type: String,
        default: ""
    },

    address: {
        type: String,
        default: ""
    },

    latitude: {
        type: Number,
        required: true,
        min: -90,
        max: 90
    },

    longitude: {
        type: Number,
        required: true,
        min: -180,
        max: 180
    },

    cuisineType: {
        type: String,
        default: "Unknown"
    },

    priceRange: {
        type: String,
        default: null
    },

    rating: {
        type: Number,
        default: null,
        min: 0,
        max: 5
    },

    reviewCount: {
        type: Number,
        default: 0,
        min: 0
    },

    imageUrl: {
        type: String,
        default: null
    },

    imageSource: {
        type: String,
        default: null
    },

    imageAuthor: {
        type: String,
        default: null
    },

    imageLicense: {
        type: String,
        default: null
    },

    imageLicenseUrl: {
        type: String,
        default: null
    },

    openingHours: {
        type: String,
        default: ""
    },

    // OpenStreetMap information
    osmId: {
        type: String
    },

    osmType: {
        type: String,
        enum: ["node", "way", "relation"]
    },

    dataSource: {
        type: String,
        enum: ["manual", "osm"],
        default: "manual"
    }

}, {
    timestamps: true
});

// Prevent duplicate OSM restaurants
restaurantSchema.index(
    { osmType: 1, osmId: 1 },
    {
        unique: true,
        partialFilterExpression: {
            dataSource: "osm",
            osmType: { $type: "string" },
            osmId: { $type: "string" }
        }
    }
);

module.exports = mongoose.model("Restaurant", restaurantSchema);