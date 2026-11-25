// Compare the saved preferred heat with the public dish rating summary.
function getDishSpicinessCompatibility(userAnswers, dish) {
    const preferred = userAnswers?.preferredSpiciness;
    const median = dish?.medianSpiciness;
    const count = dish?.spicinessRatingCount;

    if (!Number.isInteger(preferred) || preferred < 1 || preferred > 5
        || !Number.isFinite(median) || median < 1 || median > 5
        || !Number.isInteger(count) || count < 1) {
        return "Unknown";
    }

    return median <= preferred ? "Within Preference" : "Above Preference";
}

module.exports = { getDishSpicinessCompatibility };
