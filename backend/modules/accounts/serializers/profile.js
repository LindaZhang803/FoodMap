const {
    QUESTIONNAIRE_VERSION,
    readSpicinessQuestionnaire
} = require("../validators/spicinessQuestionnaire");

const QUESTIONNAIRE_FIELDS = "spicinessQuestionnaire spicinessQuestionnaireRevision";
const PROFILE_FIELDS =
    `username email profileImage bio favoriteCuisines foodPreferences createdAt ${QUESTIONNAIRE_FIELDS}`;

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
    const { questionnaireCompleted, spicinessQuestionnaireRevision } = questionnaireResponse(user);
    return {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        profileImage: typeof user.profileImage === "string" ? user.profileImage : "",
        bio: typeof user.bio === "string" ? user.bio : "",
        favoriteCuisines: Array.isArray(user.favoriteCuisines)
            ? [...user.favoriteCuisines]
            : [],
        foodPreferences: Array.isArray(user.foodPreferences)
            ? [...user.foodPreferences]
            : [],
        createdAt: user.createdAt,
        questionnaireCompleted,
        spicinessQuestionnaireRevision
    };
}

module.exports = {
    PROFILE_FIELDS,
    QUESTIONNAIRE_FIELDS,
    questionnaireResponse,
    publicProfile
};
