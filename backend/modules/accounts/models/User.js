
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        trim: true
    },

    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },

    passwordHash: {
        type: String,
        required: true,
        select: false
    },

    profileImage: {
        type: String,
        default: ""
    },

    bio: {
        type: String,
        default: ""
    },

    foodPreferences: {
        type: [String],
        default: []
    }

}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
