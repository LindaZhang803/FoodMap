const QUESTIONNAIRE_VERSION = 1;
const SPICY_FOOD_FREQUENCIES = ["never", "rarely", "sometimes", "often", "everyDay"];
const ANSWER_FIELDS = ["preferredSpiciness", "maximumSpiciness", "spicyFoodFrequency"];

const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
const isHeatLevel = value => Number.isInteger(value) && value >= 1 && value <= 5;

function validateSpicinessQuestionnaire(value, stored = false) {
    if (!isRecord(value)) {
        return { field: "questionnaire", message: "Questionnaire must be an object." };
    }

    const allowed = stored ? ["version", "answers", "savedAt"] : ["version", "answers"];
    const extra = Object.keys(value).find(key => !allowed.includes(key));
    if (extra !== undefined) {
        return { field: extra, message: "Unexpected questionnaire field." };
    }
    if (value.version !== QUESTIONNAIRE_VERSION) {
        return { field: "version", message: "Use questionnaire version 1." };
    }
    if (!isRecord(value.answers)) {
        return { field: "answers", message: "Answers must be an object." };
    }

    const { answers } = value;
    const extraAnswer = Object.keys(answers).find(key => !ANSWER_FIELDS.includes(key));
    if (extraAnswer !== undefined) {
        return { field: `answers.${extraAnswer}`, message: "Unexpected answer field." };
    }
    for (const field of ["preferredSpiciness", "maximumSpiciness"]) {
        if (!isHeatLevel(answers[field])) {
            return { field: `answers.${field}`, message: "Choose an integer from 1 to 5." };
        }
    }
    if (answers.maximumSpiciness < answers.preferredSpiciness) {
        return { field: "answers.maximumSpiciness", message: "Maximum heat must be at least the preferred heat." };
    }
    if (!SPICY_FOOD_FREQUENCIES.includes(answers.spicyFoodFrequency)) {
        return { field: "answers.spicyFoodFrequency", message: "Choose a supported frequency." };
    }
    if (stored && !(value.savedAt instanceof Date && Number.isFinite(value.savedAt.getTime()))) {
        return { field: "savedAt", message: "Invalid save time." };
    }
    return null;
}

function readSpicinessQuestionnaire(saved) {
    return validateSpicinessQuestionnaire(saved, true) ? null : saved;
}

module.exports = {
    QUESTIONNAIRE_VERSION,
    SPICY_FOOD_FREQUENCIES,
    validateSpicinessQuestionnaire,
    readSpicinessQuestionnaire
};
