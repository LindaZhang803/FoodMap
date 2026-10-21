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
        required: true
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
        required: true
    },

    priceRange: {
        type: String
    },

    rating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },

    reviewCount: {
        type: Number,
        default: 0,
        min: 0
    },

    imageUrl: {
        type: String
    },

    openingHours: {
        type: String
    }
}, {
    timestamps: true
});

module.exports = mongoose.model("Restaurant", restaurantSchema);