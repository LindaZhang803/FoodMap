const mongoose = require("mongoose");
const { QUESTIONNAIRE_VERSION, SPICY_FOOD_FREQUENCIES } = require("../validators/spicinessQuestionnaire");

const questionnaireAnswers = new mongoose.Schema({
    preferredSpiciness: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
    maximumSpiciness: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
    spicyFoodFrequency: { type: String, required: true, enum: SPICY_FOOD_FREQUENCIES }
}, { _id: false });

const spicinessQuestionnaire = new mongoose.Schema({
    version: { type: Number, required: true, enum: [QUESTIONNAIRE_VERSION] },
    answers: { type: questionnaireAnswers, required: true },
    savedAt: { type: Date, required: true }
}, { _id: false });

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

    favoriteCuisines: {
        type: [String],
        default: []
    },

    foodPreferences: {
        type: [String],
        default: []
    },

    spicinessQuestionnaire: { type: spicinessQuestionnaire, default: null, select: false },
    spicinessQuestionnaireRevision: { type: Number, default: 0 },

    tokenVersion: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

module.exports = mongoose.model("User", userSchema);
