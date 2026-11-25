const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createCatalogFixture } = require("../../reviews/tests/catalogIntegrationFixture");
const { getDishSpicinessCompatibility } = require("../services/spicinessCompatibility");

const questionnairePath = "/api/users/me/spiciness-questionnaire";

test("saved heat preferences compare with real public dish ratings per account", {
    skip: process.env.RUN_REVIEW_DB_TESTS !== "1",
    timeout: 120000
}, async () => {
    const mongoose = require("mongoose");
    const bcrypt = require("bcrypt");
    const otherId = new mongoose.Types.ObjectId();
    const otherEmail = `compatibility-${otherId}@example.invalid`;
    const fixture = await createCatalogFixture();
    const { User } = mongoose.models;

    try {
        await User.create({
            _id: otherId,
            username: "Second compatibility tester",
            email: otherEmail,
            passwordHash: await bcrypt.hash(fixture.password, 10)
        });

        const origin = await fixture.listen();
        async function request(path, { method = "GET", token, body } = {}) {
            const headers = {};
            if (token) headers.Authorization = `Bearer ${token}`;
            if (body) headers["Content-Type"] = "application/json";
            const response = await fetch(origin + path, {
                method, headers, body: JSON.stringify(body)
            });
            const data = await response.json();
            assert.equal(response.status, 200, `${method} ${path}: ${JSON.stringify(data)}`);
            return data;
        }

        async function login(email) {
            const { token } = await request("/api/auth/login", {
                method: "POST",
                body: { email, password: fixture.password }
            });
            assert.ok(token);
            return token;
        }

        const token = await login(fixture.email);
        const otherToken = await login(otherEmail);
        const dishPath = `/api/dishes/${fixture.ids.dishes[0]}`;
        const reviewPath = `/api/reviews/${fixture.ids.reviews[0]}`;

        function savePreference(sessionToken, preferredSpiciness) {
            return request(questionnairePath, {
                method: "PUT",
                token: sessionToken,
                body: {
                    version: 1,
                    answers: { preferredSpiciness, maximumSpiciness: 4, spicyFoodFrequency: "sometimes" }
                }
            });
        }

        async function setReviewSpiciness(spicinessRating) {
            await request(reviewPath, { method: "PUT", token, body: { spicinessRating } });
            return request(dishPath);
        }

        const ratedDish = await setReviewSpiciness(3);
        assert.equal(ratedDish.medianSpiciness, 3);
        assert.equal(ratedDish.spicinessRatingCount, 1);
        assert.equal(Object.hasOwn(ratedDish, "spicinessRanking"), false);
        assert.equal(getDishSpicinessCompatibility(null, ratedDish), "Unknown");

        const first = await savePreference(token, 2);
        assert.equal(first.spicinessQuestionnaireRevision, 1);
        assert.deepEqual(await request(questionnairePath, { token }), first);
        assert.equal(getDishSpicinessCompatibility(first.questionnaire.answers, ratedDish), "Above Preference");

        const otherBeforeSave = await request(questionnairePath, { token: otherToken });
        assert.equal(otherBeforeSave.questionnaire, null);
        assert.equal(otherBeforeSave.spicinessQuestionnaireRevision, 0);
        assert.equal(getDishSpicinessCompatibility(otherBeforeSave.questionnaire?.answers, ratedDish), "Unknown");

        const other = await savePreference(otherToken, 1);
        assert.equal(other.spicinessQuestionnaireRevision, 1);

        const retake = await savePreference(token, 3);
        assert.equal(retake.spicinessQuestionnaireRevision, 2);
        assert.deepEqual(await request(questionnairePath, { token }), retake);
        assert.equal(getDishSpicinessCompatibility(retake.questionnaire.answers, ratedDish), "Within Preference");

        const otherAfterRetake = await request(questionnairePath, { token: otherToken });
        assert.deepEqual(otherAfterRetake, other);
        assert.equal(getDishSpicinessCompatibility(otherAfterRetake.questionnaire.answers, ratedDish), "Above Preference");

        const clearedDish = await setReviewSpiciness(null);
        assert.equal(clearedDish.medianSpiciness, null);
        assert.equal(clearedDish.spicinessRatingCount, 0);
        assert.equal(getDishSpicinessCompatibility(retake.questionnaire.answers, clearedDish), "Unknown");
    } finally {
        try {
            await User.deleteOne({ _id: otherId });
        } finally {
            await fixture.cleanup();
        }
    }
});
