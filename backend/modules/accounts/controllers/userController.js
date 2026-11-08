const User = require("../models/User");

const PROFILE_FIELDS =
    "username email profileImage bio favoriteCuisines foodPreferences createdAt";

function publicProfile(user) {
    return {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        profileImage: user.profileImage || "",
        bio: user.bio || "",
        favoriteCuisines: Array.isArray(user.favoriteCuisines)
            ? [...user.favoriteCuisines]
            : [],
        foodPreferences: Array.isArray(user.foodPreferences)
            ? [...user.foodPreferences]
            : [],
        createdAt: user.createdAt
    };
}

function readChanges(data) {
    if (
        !data ||
        typeof data !== "object" ||
        Array.isArray(data)
    ) {
        return {
            error: "Profile data must be an object."
        };
    }

    if (
        data.username !== undefined &&
        (
            typeof data.username !== "string" ||
            !data.username.trim()
        )
    ) {
        return { error: "Invalid username" };
    }

    if (
        data.bio !== undefined &&
        typeof data.bio !== "string"
    ) {
        return { error: "Invalid bio" };
    }

    if (
        data.profileImage !== undefined &&
        typeof data.profileImage !== "string"
    ) {
        return { error: "Invalid profile image" };
    }

    for (const field of [
        "favoriteCuisines",
        "foodPreferences"
    ]) {
        if (
            data[field] !== undefined &&
            (
                !Array.isArray(data[field]) ||
                !data[field].every(
                    item => typeof item === "string"
                )
            )
        ) {
            return {
                error: field === "favoriteCuisines"
                    ? "Invalid favorite cuisines"
                    : "Invalid food preferences"
            };
        }
    }

    return {
        changes: {
            ...(data.username !== undefined
                ? { username: data.username.trim() }
                : {}),
            ...(data.bio !== undefined
                ? { bio: data.bio }
                : {}),
            ...(data.profileImage !== undefined
                ? { profileImage: data.profileImage }
                : {}),
            ...(data.favoriteCuisines !== undefined
                ? {
                    favoriteCuisines: [
                        ...data.favoriteCuisines
                    ]
                }
                : {}),
            ...(data.foodPreferences !== undefined
                ? {
                    foodPreferences: [
                        ...data.foodPreferences
                    ]
                }
                : {})
        }
    };
}

async function getMyProfile(req, res) {
    if (!req.user?.id) {
        return res.status(401).json({
            message: "Authentication required"
        });
    }

    try {
        const user = await User.findById(req.user.id)
            .select(PROFILE_FIELDS);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        return res.status(200).json({
            message: "Profile retrieved successfully",
            user: publicProfile(user)
        });
    } catch (error) {
        console.error("Get profile error:", error);

        return res.status(500).json({
            message: "Internal server error"
        });
    }
}

async function updateMyProfile(req, res) {
    if (!req.user?.id) {
        return res.status(401).json({
            message: "Authentication required"
        });
    }

    try {
        const input = readChanges(req.body || {});

        if (input.error) {
            return res.status(400).json({
                message: input.error
            });
        }

        const changes = input.changes;

        const user = Object.keys(changes).length === 0
            ? await User.findById(req.user.id)
                .select(PROFILE_FIELDS)
            : await User.findByIdAndUpdate(
                req.user.id,
                { $set: changes },
                {
                    returnDocument: "after",
                    runValidators: true,
                    upsert: false,
                    maxTimeMS: 5000
                }
            ).select(PROFILE_FIELDS);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        return res.status(200).json({
            message: "Profile updated successfully",
            user: publicProfile(user)
        });
    } catch (error) {
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