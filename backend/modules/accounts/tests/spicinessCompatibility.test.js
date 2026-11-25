const { getDishSpicinessCompatibility } = require("../services/spicinessCompatibility");

const answers = { preferredSpiciness: 2, maximumSpiciness: 4, spicyFoodFrequency: "sometimes" };
const dish = { medianSpiciness: 3, spicinessRatingCount: 1 };

test("compares the public median to preferred heat without a minimum sample size", () => {
    expect(getDishSpicinessCompatibility(answers, dish)).toBe("Above Preference");
    expect(getDishSpicinessCompatibility({ ...answers, preferredSpiciness: 3 }, dish))
        .toBe("Within Preference");
    expect(getDishSpicinessCompatibility({ ...answers, preferredSpiciness: 4 }, dish))
        .toBe("Within Preference");
});

test("uses the public median even when the internal ranking disagrees", () => {
    const rankedDish = { ...dish, spicinessRanking: { median: 1, sampleCount: 100 } };
    expect(getDishSpicinessCompatibility(answers, rankedDish)).toBe("Above Preference");
    expect(getDishSpicinessCompatibility(answers, { spicinessRanking: rankedDish.spicinessRanking }))
        .toBe("Unknown");
});

test.each([
    [1, 1, "Within Preference"],
    [2, 2.5, "Above Preference"],
    [3, 2.5, "Within Preference"],
    [5, 5, "Within Preference"]
])("compares preferred %p and median %p across the rating scale", (preferredSpiciness, medianSpiciness, label) => {
    expect(getDishSpicinessCompatibility({ preferredSpiciness }, { ...dish, medianSpiciness }))
        .toBe(label);
});

test.each([undefined, null, 0, 6, 2.5, "2", NaN, Infinity])(
    "returns Unknown for invalid preferred heat %p",
    preferredSpiciness => {
        expect(getDishSpicinessCompatibility({ ...answers, preferredSpiciness }, dish)).toBe("Unknown");
    }
);

test.each([undefined, null, 0, 6, "3", NaN, Infinity])(
    "returns Unknown for invalid public median %p",
    medianSpiciness => {
        expect(getDishSpicinessCompatibility(answers, { ...dish, medianSpiciness })).toBe("Unknown");
    }
);

test.each([undefined, null, 0, -1, 1.5, "1", NaN, Infinity])(
    "returns Unknown for invalid public rating count %p",
    spicinessRatingCount => {
        expect(getDishSpicinessCompatibility(answers, { ...dish, spicinessRatingCount })).toBe("Unknown");
    }
);

test("returns Unknown when either input is absent", () => {
    expect(getDishSpicinessCompatibility(null, dish)).toBe("Unknown");
    expect(getDishSpicinessCompatibility(answers, null)).toBe("Unknown");
    expect(getDishSpicinessCompatibility()).toBe("Unknown");
});
