jest.mock("../models/User", () => ({
    findByIdAndUpdate: jest.fn()
}));

jest.mock("../services/avatarService", () => {
    const actual = jest.requireActual(
        "../services/avatarService"
    );

    return {
        ...actual,
        createAvatar: jest.fn(),
        deleteAvatar: jest.fn()
    };
});

const User = require("../models/User");

const {
    AvatarInputError,
    createAvatar,
    deleteAvatar
} = require("../services/avatarService");

const {
    uploadMyAvatar
} = require("../controllers/avatarController");

const USER_ID = "507f1f77bcf86cd799439011";
const NEW_IMAGE = "/uploads/avatars/new-test.jpg";
const OLD_IMAGE = "/uploads/avatars/old-test.jpg";

let execute;

function makeRequest(changes = {}) {
    return {
        user: { id: USER_ID },
        file: { buffer: Buffer.from("test-image") },
        ...changes
    };
}

function makeResponse() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    };
}

function previousProfile(changes = {}) {
    return {
        _id: USER_ID,
        username: "TestUser",
        email: "test@example.com",
        profileImage: OLD_IMAGE,
        bio: "Hello",
        favoriteCuisines: ["Japanese"],
        foodPreferences: ["Mild"],
        passwordHash: "private-value",
        ...changes
    };
}

beforeEach(() => {
    jest.resetAllMocks();

    createAvatar.mockResolvedValue({
        profileImage: NEW_IMAGE
    });

    deleteAvatar.mockResolvedValue(true);

    execute = jest.fn().mockResolvedValue(
        previousProfile()
    );

    User.findByIdAndUpdate.mockReturnValue({
        select: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
                exec: execute
            })
        })
    });

    jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe("Avatar upload controller", () => {
    test("rejects an unauthenticated request", async () => {
        const res = makeResponse();

        await uploadMyAvatar(
            makeRequest({ user: undefined }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(401);
        expect(createAvatar).not.toHaveBeenCalled();
    });

    test.each([
        undefined,
        { buffer: Buffer.alloc(0) },
        { buffer: "invalid" }
    ])("rejects a missing or invalid upload: %p", async file => {
        const res = makeResponse();

        await uploadMyAvatar(
            makeRequest({ file }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(createAvatar).not.toHaveBeenCalled();
    });

    test("updates only the avatar and preserves profile fields", async () => {
        const res = makeResponse();

        await uploadMyAvatar(makeRequest(), res);

        expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
            USER_ID,
            { $set: { profileImage: NEW_IMAGE } },
            expect.objectContaining({
                returnDocument: "before",
                runValidators: true,
                upsert: false
            })
        );

        expect(deleteAvatar).toHaveBeenCalledWith(
            USER_ID,
            OLD_IMAGE
        );

        expect(res.status).toHaveBeenCalledWith(200);

        const result = res.json.mock.calls[0][0];

        expect(result.user.profileImage).toBe(NEW_IMAGE);
        expect(result.user.favoriteCuisines).toEqual([
            "Japanese"
        ]);
        expect(result.user.foodPreferences).toEqual(["Mild"]);
        expect(result.user).not.toHaveProperty("passwordHash");
    });

    test("removes the new file if the user no longer exists", async () => {
        execute.mockResolvedValue(null);
        const res = makeResponse();

        await uploadMyAvatar(makeRequest(), res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(deleteAvatar).toHaveBeenCalledWith(
            USER_ID,
            NEW_IMAGE
        );
    });

    test("retains the new file if database success is uncertain", async () => {
        execute.mockRejectedValue(
            new Error("Simulated connection failure")
        );

        const res = makeResponse();

        await uploadMyAvatar(makeRequest(), res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(deleteAvatar).not.toHaveBeenCalled();

        const result = res.json.mock.calls[0][0];
        expect(result.message).not.toContain(NEW_IMAGE);
        expect(result.message).not.toContain("connection failure");
    });

    test("returns image validation errors without updating the database", async () => {
        createAvatar.mockRejectedValue(
            new AvatarInputError("Unsupported image", 415)
        );

        const res = makeResponse();

        await uploadMyAvatar(makeRequest(), res);

        expect(res.status).toHaveBeenCalledWith(415);
        expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    test("still succeeds if old file cleanup fails", async () => {
        deleteAvatar.mockRejectedValue(
            new Error("Simulated cleanup failure")
        );

        const res = makeResponse();

        await uploadMyAvatar(makeRequest(), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(console.error).toHaveBeenCalled();
    });

    test("handles profiles with no previous avatar or optional fields", async () => {
        execute.mockResolvedValue(previousProfile({
            profileImage: "",
            bio: undefined,
            favoriteCuisines: undefined,
            foodPreferences: undefined
        }));

        const res = makeResponse();

        await uploadMyAvatar(makeRequest(), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(deleteAvatar).not.toHaveBeenCalled();

        const result = res.json.mock.calls[0][0];

        expect(result.user.bio).toBe("");
        expect(result.user.favoriteCuisines).toEqual([]);
        expect(result.user.foodPreferences).toEqual([]);
    });
});