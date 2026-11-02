const User = require("../models/User");


async function getMyProfile(req, res) {
    try {
      
        const userId = req.user.id;

        const user = await User.findById(userId)
            .select("username email profileImage bio foodPreferences createdAt");

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        return res.status(200).json({
            message: "Profile retrieved successfully",
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                profileImage: user.profileImage,
                bio: user.bio,
                foodPreferences: user.foodPreferences,
                createdAt: user.createdAt
            }
        });

    } catch (error) {
        console.error("Get profile error:", error);

        return res.status(500).json({
            message: "Internal server error"
        });
    }
}


async function updateMyProfile(req, res) {
    try {
        const data = req.body || {};
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        // Update username
        if (data.username !== undefined) {
            if (typeof data.username !== "string" ||
                !data.username.trim()) {
                return res.status(400).json({
                    message: "Invalid username"
                });
            }
            user.username = data.username.trim();
        }

        // Update bio
        if (data.bio !== undefined) {
            if (typeof data.bio !== "string") {
                return res.status(400).json({
                    message: "Invalid bio"
                });
            }
            user.bio = data.bio;
        }

        // Update profile image URL
        if (data.profileImage !== undefined) {
            if (typeof data.profileImage !== "string") {
                return res.status(400).json({
                    message: "Invalid profile image"
                });
            }
            user.profileImage = data.profileImage;
        }

        // Update food preferences
        if (data.foodPreferences !== undefined) {
            if (!Array.isArray(data.foodPreferences) ||
                !data.foodPreferences.every(
                    item => typeof item === "string"
                )) {
                return res.status(400).json({
                    message: "Invalid food preferences"
                });
            }
            user.foodPreferences = data.foodPreferences;
        }

        // Save changes to MongoDB
        await user.save();

        return res.status(200).json({
            message: "Profile updated successfully",
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                profileImage: user.profileImage,
                bio: user.bio,
                foodPreferences: user.foodPreferences
            }
        });

    } catch (error) {
        console.error("Update profile error:", error);

        return res.status(500).json({
            message: "Internal server error"
        });
    }
}

module.exports = { getMyProfile, updateMyProfile };
