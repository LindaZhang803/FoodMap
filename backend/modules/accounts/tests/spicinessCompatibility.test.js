const { getSpicinessCompatibility, resolveDishHeatSummary } = require("../services/spicinessCompatibility");

const answers = { preferredSpiciness: 2, maximumSpiciness: 4, spicyFoodFrequency: "sometimes" };
const dish = { medianSpiciness: 3, spicinessRatingCount: 1 };
const classify = (userAnswers, value) => {
    const { median, sampleCount } = resolveDishHeatSummary(value);
    return getSpicinessCompatibility(userAnswers, median, sampleCount);
};

test("compares the public median to preferred heat without a minimum sample size", () => {
    expect(classify(answers, dish)).toBe("Above Preference");
    expect(classify({ ...answers, preferredSpiciness: 3 }, dish))
        .toBe("Within Preference");
    expect(classify({ ...answers, preferredSpiciness: 4 }, dish))
        .toBe("Within Preference");
});

test("uses ranking evidence only when its median and sample count are usable together", () => {
    expect(resolveDishHeatSummary({ ...dish, spicinessRanking: { median: 1, sampleCount: 3 } }))
        .toEqual({ median: 1, sampleCount: 3 });
    expect(resolveDishHeatSummary({ ...dish, spicinessRanking: { median: null, sampleCount: 3 } }))
        .toEqual({ median: 3, sampleCount: 1 });
    expect(resolveDishHeatSummary({ ...dish, spicinessRanking: { median: 1, sampleCount: 2 } }))
        .toEqual({ median: 3, sampleCount: 1 });
    expect(resolveDishHeatSummary({ medianSpiciness: 1, spicinessRanking: { median: null, sampleCount: 3 } }))
        .toEqual({ median: 1, sampleCount: 0 });
});

test("returns Unknown when a median is supplied without a count", () => {
    expect(getSpicinessCompatibility(answers, 2)).toBe("Unknown");
});

test.each([
    [1, 1, "Within Preference"],
    [2, 2.5, "Above Preference"],
    [3, 2.5, "Within Preference"],
    [5, 5, "Within Preference"]
])("compares preferred %p and median %p across the rating scale", (preferredSpiciness, medianSpiciness, label) => {
    expect(classify({ preferredSpiciness }, { ...dish, medianSpiciness }))
        .toBe(label);
});

test.each([undefined, null, 0, 6, 2.5, "2", NaN, Infinity])(
    "returns Unknown for invalid preferred heat %p",
    preferredSpiciness => {
        expect(classify({ ...answers, preferredSpiciness }, dish)).toBe("Unknown");
    }
);

test.each([undefined, null, 0, 6, "3", NaN, Infinity])(
    "returns Unknown for invalid public median %p",
    medianSpiciness => {
        expect(classify(answers, { ...dish, medianSpiciness })).toBe("Unknown");
    }
);

test.each([undefined, null, 0, -1, 1.5, "1", NaN, Infinity])(
    "returns Unknown for invalid public rating count %p",
    spicinessRatingCount => {
        expect(classify(answers, { ...dish, spicinessRatingCount })).toBe("Unknown");
    }
);

test("returns Unknown when either input is absent", () => {
    expect(classify(null, dish)).toBe("Unknown");
    expect(classify(answers, null)).toBe("Unknown");
    expect(classify()).toBe("Unknown");
});
