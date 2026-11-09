const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");

jest.mock("../models/User", () => ({
    findById: jest.fn()
}));

const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");

const USER_ID = "507f1f77bcf86cd799439011";
const originalSecret = process.env.JWT_SECRET;

function makeResponse() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    };
}

function makeToken(payload = {}, options = {}) {
    return jwt.sign(
        {
            id: USER_ID,
            tokenVersion: 2,
            ...payload
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "1h",
            ...options
        }
    );
}

async function callMiddleware(authorization) {
    const req = {
        headers: authorization
            ? { authorization }
            : {}
    };

    const res = makeResponse();
    const next = jest.fn();

    await authMiddleware(req, res, next);

    return { req, res, next };
}

beforeEach(() => {
    jest.clearAllMocks();

    process.env.JWT_SECRET =
        crypto.randomBytes(32).toString("hex");

    User.findById.mockResolvedValue({
        _id: USER_ID,
        username: "TestUser",
        profileImage: "",
        tokenVersion: 2
    });
});

afterAll(() => {
    if (originalSecret === undefined) {
        delete process.env.JWT_SECRET;
    } else {
        process.env.JWT_SECRET = originalSecret;
    }
});

describe("Account authentication middleware", () => {
    test("rejects requests without a token", async () => {
        const { res, next } = await callMiddleware();

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
        expect(User.findById).not.toHaveBeenCalled();
    });

    test("rejects a malformed token", async () => {
        const { res, next } = await callMiddleware(
            "Bearer invalid-token"
        );

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
        expect(User.findById).not.toHaveBeenCalled();
    });

    test("rejects a token signed with another secret", async () => {
        const token = jwt.sign(
            { id: USER_ID, tokenVersion: 2 },
            crypto.randomBytes(32).toString("hex")
        );

        const { res, next } = await callMiddleware(
            "Bearer " + token
        );

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
        expect(User.findById).not.toHaveBeenCalled();
    });

    test("rejects an expired token", async () => {
        const token = makeToken({}, { expiresIn: -1 });

        const { res, next } = await callMiddleware(
            "Bearer " + token
        );

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
        expect(User.findById).not.toHaveBeenCalled();
    });

    test("rejects a token for a deleted user", async () => {
        User.findById.mockResolvedValue(null);

        const { res, next } = await callMiddleware(
            "Bearer " + makeToken()
        );

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    test("rejects an old token after logout", async () => {
        const { res, next } = await callMiddleware(
            "Bearer " + makeToken({ tokenVersion: 1 })
        );

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    test("allows a valid token and supplies its user identity", async () => {
        const { req, res, next } = await callMiddleware(
            "Bearer " + makeToken()
        );

        expect(User.findById).toHaveBeenCalledWith(USER_ID);
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();

        expect(req.user).toEqual({
            id: USER_ID,
            username: "TestUser",
            profileImage: ""
        });
    });
});