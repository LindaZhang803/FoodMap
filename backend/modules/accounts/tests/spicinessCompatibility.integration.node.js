const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createCatalogFixture } = require("../../reviews/tests/catalogIntegrationFixture");

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
        async function request(path, { method = "GET", token, body, status = 200 } = {}) {
            const headers = {};
            if (token) headers.Authorization = `Bearer ${token}`;
            if (body) headers["Content-Type"] = "application/json";
            const response = await fetch(origin + path, {
                method, headers, body: JSON.stringify(body)
            });
            const data = await response.json();
            assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(data)}`);
            if (path.startsWith("/api/dishes") || path.startsWith("/api/recommendations/dishes")) {
                assert.match(response.headers.get("vary") || "", /\bAuthorization\b/i);
                if (token) {
                    assert.match(response.headers.get("cache-control") || "", /\bprivate\b/);
                    assert.match(response.headers.get("cache-control") || "", /\bno-store\b/);
                }
            }
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
        const dishId = String(fixture.ids.dishes[0]);
        const dishPath = `/api/dishes/${dishId}`;
        const listPath = `/api/dishes?restaurantId=${fixture.ids.restaurants[0]}`;
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
            return request(dishPath, { token });
        }

        async function assertCompatibility(sessionToken, label) {
            const options = { token: sessionToken };
            const menu = await request(listPath, options);
            const dish = await request(dishPath, options);
            assert.equal(menu.find(item => item.id === dishId).spicinessCompatibility, label);
            assert.equal(dish.spicinessCompatibility, label);
            assert.match(dish.spicinessCompatibilityNote, /community ratings/);
            assert.equal(Object.hasOwn(dish, "spicinessRanking"), false);
            assert.equal(Object.hasOwn(dish, "statisticsRevision"), false);

            const recommendation = await request("/api/recommendations/dishes?limit=50", options);
            const rankedDish = recommendation.dishes.find(item => item.dish.id === dishId);
            assert.equal(rankedDish.spicinessCompatibility, label);
        }

        const ratedDish = await setReviewSpiciness(3);
        assert.equal(ratedDish.medianSpiciness, 3);
        assert.equal(ratedDish.spicinessRatingCount, 1);
        assert.equal(Object.hasOwn(ratedDish, "spicinessRanking"), false);
        await assertCompatibility(undefined, "Unknown");
        await assertCompatibility(token, "Unknown");
        await request(listPath, { token: "invalid", status: 401 });
        await request(dishPath, { token: "invalid", status: 401 });

        const first = await savePreference(token, 2);
        assert.equal(first.spicinessQuestionnaireRevision, 1);
        assert.deepEqual(await request(questionnairePath, { token }), first);
        await assertCompatibility(token, "Above Preference");

        const otherBeforeSave = await request(questionnairePath, { token: otherToken });
        assert.equal(otherBeforeSave.questionnaire, null);
        assert.equal(otherBeforeSave.spicinessQuestionnaireRevision, 0);
        await assertCompatibility(otherToken, "Unknown");

        const other = await savePreference(otherToken, 1);
        assert.equal(other.spicinessQuestionnaireRevision, 1);

        const retake = await savePreference(token, 3);
        assert.equal(retake.spicinessQuestionnaireRevision, 2);
        assert.deepEqual(await request(questionnairePath, { token }), retake);
        await assertCompatibility(token, "Within Preference");
        await assertCompatibility(undefined, "Unknown");

        const otherAfterRetake = await request(questionnairePath, { token: otherToken });
        assert.deepEqual(otherAfterRetake, other);
        await assertCompatibility(otherToken, "Above Preference");

        const clearedDish = await setReviewSpiciness(null);
        assert.equal(clearedDish.medianSpiciness, null);
        assert.equal(clearedDish.spicinessRatingCount, 0);
        await assertCompatibility(token, "Unknown");
        await assertCompatibility(otherToken, "Unknown");
    } finally {
        try {
            await User.deleteOne({ _id: otherId });
        } finally {
            await fixture.cleanup();
        }
    }
});
