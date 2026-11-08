jest.mock("../models/User", () => ({
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn()
}));

const User = require("../models/User");

const {
    getMyProfile,
    updateMyProfile
} = require("../controllers/userController");

const USER_ID = "507f1f77bcf86cd799439011";
const OTHER_ID = "507f191e810c19729de860ea";

function profile(changes = {}) {
    return {
        _id: USER_ID,
        username: "TestUser",
        email: "test@example.com",
        profileImage: "",
        bio: "Hello",
        favoriteCuisines: ["Chinese"],
        foodPreferences: ["Vegetarian"],
        createdAt: new Date("2026-01-01"),
        ...changes
    };
}

function queryResult(value) {
    return {
        select: jest.fn().mockResolvedValue(value)
    };
}

function makeResponse() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    };
}

beforeEach(() => {
    jest.resetAllMocks();

    User.findById.mockReturnValue(
        queryResult(profile())
    );

    User.findByIdAndUpdate.mockReturnValue(
        queryResult(profile())
    );
});

describe("Account profile controller", () => {
    test("rejects profile access without authentication", async () => {
        const res = makeResponse();

        await getMyProfile({}, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(User.findById).not.toHaveBeenCalled();
    });

    test("reads the authenticated user's profile", async () => {
        const res = makeResponse();

        await getMyProfile({
            user: { id: USER_ID }
        }, res);

        expect(User.findById).toHaveBeenCalledWith(USER_ID);
        expect(res.status).toHaveBeenCalledWith(200);

        const response = res.json.mock.calls[0][0];

        expect(response.user.id).toBe(USER_ID);
        expect(response.user.favoriteCuisines).toEqual([
            "Chinese"
        ]);
    });

    test("never includes password or token version in the response", async () => {
        User.findById.mockReturnValue(
            queryResult(profile({
                passwordHash: "private-test-value",
                tokenVersion: 5
            }))
        );

        const res = makeResponse();

        await getMyProfile({
            user: { id: USER_ID }
        }, res);

        const response = res.json.mock.calls[0][0];

        expect(response.user).not.toHaveProperty("password");
        expect(response.user).not.toHaveProperty("passwordHash");
        expect(response.user).not.toHaveProperty("tokenVersion");
    });

    test("saves cuisines and food preferences separately", async () => {
        const res = makeResponse();

        const changes = {
            username: "UpdatedUser",
            bio: "Updated bio",
            favoriteCuisines: ["Japanese"],
            foodPreferences: ["Mild"]
        };

        User.findByIdAndUpdate.mockReturnValue(
            queryResult(profile(changes))
        );

        await updateMyProfile({
            user: { id: USER_ID },
            body: changes
        }, res);

        expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
            USER_ID,
            { $set: changes },
            expect.objectContaining({
                runValidators: true,
                upsert: false
            })
        );

        expect(res.status).toHaveBeenCalledWith(200);

        const response = res.json.mock.calls[0][0];

        expect(response.user.favoriteCuisines).toEqual([
            "Japanese"
        ]);
        expect(response.user.foodPreferences).toEqual([
            "Mild"
        ]);
    });

    test("ignores a supplied user ID and protected fields", async () => {
        const res = makeResponse();

        await updateMyProfile({
            user: { id: USER_ID },
            body: {
                id: OTHER_ID,
                userId: OTHER_ID,
                email: "other@example.com",
                passwordHash: "replacement",
                tokenVersion: 0,
                bio: "My new bio"
            }
        }, res);

        expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
            USER_ID,
            { $set: { bio: "My new bio" } },
            expect.any(Object)
        );
    });

    test("rejects invalid preferences without saving", async () => {
        const res = makeResponse();

        await updateMyProfile({
            user: { id: USER_ID },
            body: {
                foodPreferences: "Vegetarian"
            }
        }, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    test("returns 404 when the user no longer exists", async () => {
        User.findById.mockReturnValue(queryResult(null));

        const res = makeResponse();

        await getMyProfile({
            user: { id: USER_ID }
        }, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });
});