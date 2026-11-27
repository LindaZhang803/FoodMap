const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const request = require("supertest");
const User = require("../models/User");
const userRoutes = require("../routes/userRoutes");

const PATH = "/api/users/me/spiciness-questionnaire";
const USER_ID = new mongoose.Types.ObjectId();
const OTHER_ID = new mongoose.Types.ObjectId();
const JWT_SECRET = "questionnaire-test-secret";
const answers = {
    preferredSpiciness: 2,
    maximumSpiciness: 4,
    spicyFoodFrequency: "sometimes"
};
const savedAt = new Date("2026-11-01T00:00:00.000Z");

const app = express();
app.use(express.json());
app.use("/api/users", userRoutes);

function bearer(id = String(USER_ID)) {
    return "Bearer " + jwt.sign({ id, tokenVersion: 0 }, JWT_SECRET);
}

let users;
let updateUser;

function selectUser(user, options) {
    const projection = options?.projection;
    if (!user || !projection) return user;

    const inclusive = Object.values(projection).includes(1);
    return Object.fromEntries(Object.entries(user).filter(([key]) => (
        inclusive ? key === "_id" || projection[key] === 1 : projection[key] !== 0
    )));
}

beforeEach(() => {
    jest.replaceProperty(process, "env", { ...process.env, JWT_SECRET });
    users = new Map([
        [String(USER_ID), { _id: USER_ID, favoriteCuisines: ["Chinese"] }],
        [String(OTHER_ID), { _id: OTHER_ID }]
    ]);

    // Keep route, auth, Mongoose casting, and serialization in the test path.
    jest.spyOn(User.collection, "findOne").mockImplementation(async (filter, options) => (
        selectUser(users.get(String(filter._id)) || null, options)
    ));
    updateUser = jest.spyOn(User.collection, "findOneAndUpdate")
        .mockImplementation(async (filter, update, options) => {
            const user = users.get(String(filter._id));
            if (!user) return null;
            const changes = { ...update.$set };
            if (changes.spicinessQuestionnaire) {
                changes.spicinessQuestionnaire = changes.spicinessQuestionnaire.toBSON();
            }
            Object.assign(user, changes);
            for (const [key, amount] of Object.entries(update.$inc || {})) {
                user[key] = (user[key] ?? 0) + amount;
            }
            return selectUser(user, options);
        });
});

afterEach(() => jest.restoreAllMocks());

test("questionnaire reads and writes require authentication", async () => {
    await request(app).get(PATH).expect(401);
    await request(app).put(PATH).send({ version: 1, answers }).expect(401);
});

test.each(["malformed-id", "z".repeat(24), 42, null])(
    "rejects an invalid signed user ID before querying MongoDB (%#)", async id => {
        const response = await request(app).get(PATH).set("Authorization", bearer(id)).expect(401);

        expect(response.body).toEqual({ message: "Invalid token" });
        expect(User.collection.findOne).not.toHaveBeenCalled();
    }
);

test("existing accounts have no questionnaire and start at revision zero", async () => {
    const response = await request(app).get(PATH).set("Authorization", bearer()).expect(200);
    expect(response.body).toEqual({
        questionnaire: null,
        supportedVersion: 1,
        questionnaireCompleted: false,
        spicinessQuestionnaireRevision: 0
    });
});

test("saves and replaces the authenticated user's questionnaire with an atomic revision increment", async () => {
    const first = await request(app).put(PATH).set("Authorization", bearer())
        .send({ version: 1, answers }).expect(200);

    expect(first.body).toEqual({
        questionnaire: { version: 1, answers, savedAt: expect.any(String) },
        supportedVersion: 1,
        questionnaireCompleted: true,
        spicinessQuestionnaireRevision: 1
    });
    expect(Number.isFinite(Date.parse(first.body.questionnaire.savedAt))).toBe(true);
    expect(updateUser).toHaveBeenLastCalledWith(
        { _id: USER_ID },
        expect.objectContaining({
            $set: expect.objectContaining({ spicinessQuestionnaire: expect.any(Object) }),
            $inc: { spicinessQuestionnaireRevision: 1 }
        }),
        expect.objectContaining({ returnDocument: "after" })
    );

    const editedAnswers = { preferredSpiciness: 5, maximumSpiciness: 5, spicyFoodFrequency: "everyDay" };
    const second = await request(app).put(PATH).set("Authorization", bearer())
        .send({ version: 1, answers: editedAnswers }).expect(200);
    expect(second.body.questionnaire.answers).toEqual(editedAnswers);
    expect(second.body.spicinessQuestionnaireRevision).toBe(2);

    const self = await request(app).get(PATH).set("Authorization", bearer()).expect(200);
    expect(self.body).toEqual(second.body);
    const other = await request(app).get(PATH).set("Authorization", bearer(String(OTHER_ID))).expect(200);
    expect(other.body.questionnaire).toBeNull();
    expect(other.body.spicinessQuestionnaireRevision).toBe(0);
});

test.each([
    ["version", { version: 2, answers }],
    ["version", { version: "1", answers }],
    ["answers", { version: 1 }],
    ["answers", { version: 1, answers: [] }],
    ["userId", { version: 1, answers, userId: String(OTHER_ID) }],
    ["savedAt", { version: 1, answers, savedAt }],
    ["answers.extra", { version: 1, answers: { ...answers, extra: true } }],
    ["answers.preferredSpiciness", { version: 1, answers: { ...answers, preferredSpiciness: 0 } }],
    ["answers.maximumSpiciness", { version: 1, answers: { ...answers, maximumSpiciness: 6 } }],
    ["answers.maximumSpiciness", { version: 1, answers: { ...answers, maximumSpiciness: "3" } }],
    ["answers.maximumSpiciness", { version: 1, answers: { ...answers, maximumSpiciness: 3.5 } }],
    ["answers.maximumSpiciness", { version: 1, answers: { ...answers, maximumSpiciness: 1 } }],
    ["answers.spicyFoodFrequency", { version: 1, answers: { ...answers, spicyFoodFrequency: undefined } }],
    ["answers.spicyFoodFrequency", { version: 1, answers: { ...answers, spicyFoodFrequency: "daily" } }]
])("rejects invalid input at %s before a write (%#)", async (field, body) => {
    const response = await request(app).put(PATH).set("Authorization", bearer())
        .send(body).expect(400);

    expect(response.body).toEqual({ field, message: expect.any(String) });
    expect(updateUser).not.toHaveBeenCalled();
});

test.each([
    { version: 2, answers, savedAt },
    { version: 1, answers: { preferredSpiciness: 2 }, savedAt },
    { version: 1, answers: { ...answers, maximumSpiciness: "4" }, savedAt },
    { version: 1, answers: { ...answers, extra: true }, savedAt },
    { version: 1, answers, savedAt: savedAt.toISOString() },
    { version: 1, answers }
])("treats invalid stored data as incomplete on both self routes (%#)", async (questionnaire) => {
    Object.assign(users.get(String(USER_ID)), {
        spicinessQuestionnaire: questionnaire,
        spicinessQuestionnaireRevision: 7
    });
    const self = await request(app).get(PATH).set("Authorization", bearer()).expect(200);
    expect(self.body).toMatchObject({
        questionnaire: null,
        questionnaireCompleted: false,
        spicinessQuestionnaireRevision: 7
    });

    const profile = await request(app).get("/api/users/me").set("Authorization", bearer()).expect(200);
    expect(profile.body.user).toMatchObject({
        favoriteCuisines: ["Chinese"],
        questionnaireCompleted: false,
        spicinessQuestionnaireRevision: 7
    });
});

test("profile returns completion metadata without exposing the saved answers", async () => {
    Object.assign(users.get(String(USER_ID)), {
        spicinessQuestionnaire: { version: 1, answers, savedAt },
        spicinessQuestionnaireRevision: 2
    });
    const profile = await request(app).get("/api/users/me").set("Authorization", bearer()).expect(200);
    expect(profile.body.user).toMatchObject({
        questionnaireCompleted: true,
        spicinessQuestionnaireRevision: 2
    });
    expect(profile.body.user).not.toHaveProperty("spicinessQuestionnaire");
    expect(profile.body.user).not.toHaveProperty("answers");
});

test.each([{}, { bio: "Updated bio" }])(
    "profile updates return questionnaire metadata without exposing the answers (%#)", async changes => {
        Object.assign(users.get(String(USER_ID)), {
            spicinessQuestionnaire: { version: 1, answers, savedAt },
            spicinessQuestionnaireRevision: 2
        });
        const profile = await request(app).put("/api/users/me").set("Authorization", bearer())
            .send(changes).expect(200);

        expect(profile.body.user).toMatchObject({
            bio: changes.bio ?? "",
            questionnaireCompleted: true,
            spicinessQuestionnaireRevision: 2
        });
        expect(profile.body.user).not.toHaveProperty("spicinessQuestionnaire");
        expect(profile.body.user).not.toHaveProperty("answers");
    }
);

test("profile updates preserve incomplete status for malformed stored answers", async () => {
    Object.assign(users.get(String(USER_ID)), {
        spicinessQuestionnaire: { version: 1, answers: { ...answers, maximumSpiciness: "4" }, savedAt },
        spicinessQuestionnaireRevision: 2
    });
    const profile = await request(app).put("/api/users/me").set("Authorization", bearer())
        .send({ bio: "Updated bio" }).expect(200);

    expect(profile.body.user).toMatchObject({
        questionnaireCompleted: false,
        spicinessQuestionnaireRevision: 2
    });
});
