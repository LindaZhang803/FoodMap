const User = require("../models/User");

const PROFILE_FIELDS =
    "username email profileImage bio favoriteCuisines foodPreferences createdAt";

const EDITABLE_FIELDS = Object.freeze([
    "username",
    "bio",
    "favoriteCuisines",
    "foodPreferences"
]);

class ProfileInputError extends Error {
    constructor(message) {
        super(message);
        this.name = "ProfileInputError";
    }
}

function authenticatedUserId(req) {
    const id = req.user?.id;

    return (
        typeof id === "string" &&
        id.length === 24 &&
        /^[a-f0-9]{24}$/i.test(id)
    ) ? id.toLowerCase() : null;
}

function publicProfile(user) {
    return {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        profileImage: typeof user.profileImage === "string"
            ? user.profileImage
            : "",
        bio: typeof user.bio === "string" ? user.bio : "",
        favoriteCuisines: Array.isArray(user.favoriteCuisines)
            ? [...user.favoriteCuisines]
            : [],
        foodPreferences: Array.isArray(user.foodPreferences)
            ? [...user.foodPreferences]
            : [],
        createdAt: user.createdAt
    };
}

function validateProfileData(data) {
    if (
        data === null ||
        typeof data !== "object" ||
        Array.isArray(data)
    ) {
        throw new ProfileInputError(
            "Profile data must be an object."
        );
    }

    if (Object.hasOwn(data, "profileImage")) {
        throw new ProfileInputError(
            "Please use avatar upload to change your profile image."
        );
    }

    if (Object.keys(data).some(key => !EDITABLE_FIELDS.includes(key))) {
        throw new ProfileInputError(
            "Only username, bio, favorite cuisines and food preferences can be changed."
        );
    }

    if (
        Object.hasOwn(data, "username") &&
        (typeof data.username !== "string" || !data.username.trim())
    ) {
        throw new ProfileInputError("Invalid username");
    }

    if (
        Object.hasOwn(data, "bio") &&
        typeof data.bio !== "string"
    ) {
        throw new ProfileInputError("Invalid bio");
    }

    if (
        Object.hasOwn(data, "favoriteCuisines") &&
        (
            !Array.isArray(data.favoriteCuisines) ||
            !data.favoriteCuisines.every(
                item => typeof item === "string"
            )
        )
    ) {
        throw new ProfileInputError("Invalid favorite cuisines");
    }

    if (
        Object.hasOwn(data, "foodPreferences") &&
        (
            !Array.isArray(data.foodPreferences) ||
            !data.foodPreferences.every(
                item => typeof item === "string"
            )
        )
    ) {
        throw new ProfileInputError("Invalid food preferences");
    }
}

function readProfileChanges(data = {}) {
    validateProfileData(data);

    return {
        ...(Object.hasOwn(data, "username")
            ? { username: data.username.trim() }
            : {}),
        ...(Object.hasOwn(data, "bio")
            ? { bio: data.bio }
            : {}),
        ...(Object.hasOwn(data, "favoriteCuisines")
            ? { favoriteCuisines: [...data.favoriteCuisines] }
            : {}),
        ...(Object.hasOwn(data, "foodPreferences")
            ? { foodPreferences: [...data.foodPreferences] }
            : {})
    };
}

function readProfileRecord(userId) {
    return User.findById(userId)
        .select(PROFILE_FIELDS)
        .lean()
        .exec();
}

function updateProfileRecord(userId, changes) {
    if (Object.keys(changes).length === 0) {
        return readProfileRecord(userId);
    }

    return User.findByIdAndUpdate(
        userId,
        { $set: changes },
        {
            returnDocument: "after",
            runValidators: true,
            upsert: false,
            maxTimeMS: 5000
        }
    )
        .select(PROFILE_FIELDS)
        .lean()
        .exec();
}

function sendProfile(res, user, message) {
    if (!user) {
        return res.status(404).json({
            message: "User not found"
        });
    }

    return res.status(200).json({
        message,
        user: publicProfile(user)
    });
}

async function getMyProfile(req, res) {
    const userId = authenticatedUserId(req);

    if (!userId) {
        return res.status(401).json({
            message: "Authentication required"
        });
    }

    try {
        const user = await readProfileRecord(userId);

        return sendProfile(
            res,
            user,
            "Profile retrieved successfully"
        );
    } catch (error) {
        console.error("Get profile error:", error);

        return res.status(500).json({
            message: "Internal server error"
        });
    }
}

async function updateMyProfile(req, res) {
    const userId = authenticatedUserId(req);

    if (!userId) {
        return res.status(401).json({
            message: "Authentication required"
        });
    }

    try {
        const changes = readProfileChanges(req.body);
        const user = await updateProfileRecord(userId, changes);

        return sendProfile(
            res,
            user,
            "Profile updated successfully"
        );
    } catch (error) {
        if (error instanceof ProfileInputError) {
            return res.status(400).json({
                message: error.message
            });
        }

        console.error("Update profile error:", error);

        return res.status(500).json({
            message: "Internal server error"
        });
    }
}

module.exports = {
    getMyProfile,
    updateMyProfile
};