const User = require("../models/User");

const {
    AvatarInputError,
    createAvatar,
    deleteAvatar
} = require("../services/avatarService");

const PROFILE_FIELDS =
    "username email profileImage bio favoriteCuisines foodPreferences createdAt";

function publicProfile(user, profileImage) {
    return {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        profileImage,
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

async function removeAvatarSafely(userId, profileImage) {
    if (typeof profileImage !== "string" || !profileImage) {
        return;
    }

    try {
        await deleteAvatar(userId, profileImage);
    } catch (error) {
        console.error(
            "Avatar file cleanup failed:",
            { userId, profileImage },
            error
        );
    }
}

async function replaceAvatarInDatabase(userId, profileImage) {
    try {
        return await User.findByIdAndUpdate(
            userId,
            { $set: { profileImage } },
            {
                returnDocument: "before",
                runValidators: true,
                upsert: false,
                maxTimeMS: 5000
            }
        )
            .select(PROFILE_FIELDS)
            .lean()
            .exec();
    } catch (error) {
        // The update may have succeeded before a connection error.
        // Retain the new file until the database result is confirmed.
        throw new Error(
            "Avatar update could not be confirmed. Retained image: " +
                profileImage,
            { cause: error }
        );
    }
}

async function uploadMyAvatar(req, res) {
    const userId = req.user?.id;

    if (
        typeof userId !== "string" ||
        userId.length !== 24 ||
        !/^[a-f0-9]{24}$/i.test(userId)
    ) {
        return res.status(401).json({
            message: "Authentication required"
        });
    }

    if (
        !Buffer.isBuffer(req.file?.buffer) ||
        req.file.buffer.length === 0
    ) {
        return res.status(400).json({
            message: "Please select a non-empty image to upload."
        });
    }

    try {
        const avatar = await createAvatar(
            userId,
            req.file.buffer
        );

        const previous = await replaceAvatarInDatabase(
            userId,
            avatar.profileImage
        );

        if (!previous) {
            await removeAvatarSafely(
                userId,
                avatar.profileImage
            );

            return res.status(404).json({
                message: "User not found"
            });
        }

        await removeAvatarSafely(
            userId,
            previous.profileImage
        );

        return res.status(200).json({
            message: "Avatar updated successfully",
            user: publicProfile(previous, avatar.profileImage)
        });
    } catch (error) {
        if (error instanceof AvatarInputError) {
            return res.status(error.status).json({
                message: error.message
            });
        }

        console.error("Upload avatar error:", error);

        return res.status(500).json({
            message: "Could not update your avatar. Please try again."
        });
    }
}

module.exports = {
    uploadMyAvatar
};