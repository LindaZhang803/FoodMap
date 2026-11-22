const User = require("../models/User");
const {
    QUESTIONNAIRE_VERSION,
    validateSpicinessQuestionnaire,
    readSpicinessQuestionnaire
} = require("../validators/spicinessQuestionnaire");

const PROFILE_FIELDS =
    "username email profileImage bio favoriteCuisines foodPreferences createdAt";
const QUESTIONNAIRE_FIELDS = "spicinessQuestionnaire spicinessQuestionnaireRevision";

function questionnaireResponse(user) {
    const questionnaire = readSpicinessQuestionnaire(user.spicinessQuestionnaire);
    return {
        questionnaire,
        supportedVersion: QUESTIONNAIRE_VERSION,
        questionnaireCompleted: questionnaire !== null,
        spicinessQuestionnaireRevision: user.spicinessQuestionnaireRevision ?? 0
    };
}

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
            .select(`${PROFILE_FIELDS} ${QUESTIONNAIRE_FIELDS}`)
            .lean();

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        const { questionnaireCompleted, spicinessQuestionnaireRevision } = questionnaireResponse(user);
        return res.status(200).json({
            message: "Profile retrieved successfully",
            user: { ...publicProfile(user), questionnaireCompleted, spicinessQuestionnaireRevision }
        });
    } catch (error) {
        console.error("Get profile error:", error);

        return res.status(500).json({
            message: "Internal server error"
        });
    }
}

async function respondWithQuestionnaire(res, query) {
    try {
        const user = await query.select(QUESTIONNAIRE_FIELDS).lean();
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        return res.status(200).json(questionnaireResponse(user));
    } catch (error) {
        console.error("Spiciness questionnaire error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

function getMySpicinessQuestionnaire(req, res) {
    return respondWithQuestionnaire(res, User.findById(req.user.id));
}

function putMySpicinessQuestionnaire(req, res) {
    const error = validateSpicinessQuestionnaire(req.body);
    if (error) {
        return res.status(400).json(error);
    }

    const { version, answers } = req.body;
    const query = User.findByIdAndUpdate(req.user.id, {
        $set: { spicinessQuestionnaire: { version, answers, savedAt: new Date() } },
        $inc: { spicinessQuestionnaireRevision: 1 }
    }, { returnDocument: "after", runValidators: true, maxTimeMS: 5000 });

    return respondWithQuestionnaire(res, query);
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
    updateMyProfile,
    getMySpicinessQuestionnaire,
    putMySpicinessQuestionnaire
};
