const crypto = require("node:crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

jest.mock("../models/User", () => ({
    findOne: jest.fn(),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn()
}));

const User = require("../models/User");
const {
    register,
    login,
    logout
} = require("../controllers/authController");

const USER_ID = "507f1f77bcf86cd799439011";
const TEST_PASSWORD = "ExamplePass123!";
const originalSecret = process.env.JWT_SECRET;

let passwordHash;

function makeResponse() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    };
}

function registration() {
    return {
        username: "TestUser",
        email: "test@example.com",
        password: TEST_PASSWORD,
        confirmPassword: TEST_PASSWORD
    };
}

beforeAll(async () => {
    passwordHash = await bcrypt.hash(TEST_PASSWORD, 4);
});

beforeEach(() => {
    jest.resetAllMocks();

    process.env.JWT_SECRET =
        crypto.randomBytes(32).toString("hex");
});

afterAll(() => {
    if (originalSecret === undefined) {
        delete process.env.JWT_SECRET;
    } else {
        process.env.JWT_SECRET = originalSecret;
    }
});

describe("Account authentication controller", () => {
    test("registers a user with a hash and hides the password", async () => {
        User.findOne.mockResolvedValue(null);

        User.create.mockImplementation(async data => ({
            _id: USER_ID,
            ...data
        }));

        const res = makeResponse();

        await register({ body: registration() }, res);

        expect(res.status).toHaveBeenCalledWith(201);

        const saved = User.create.mock.calls[0][0];

        expect(saved).not.toHaveProperty("password");
        expect(saved.passwordHash).not.toBe(TEST_PASSWORD);

        expect(
            await bcrypt.compare(
                TEST_PASSWORD,
                saved.passwordHash
            )
        ).toBe(true);

        const response = res.json.mock.calls[0][0];

        expect(response.user).not.toHaveProperty("password");
        expect(response.user).not.toHaveProperty("passwordHash");
    });

    test("rejects a duplicate email without creating a user", async () => {
        User.findOne.mockResolvedValue({
            _id: USER_ID
        });

        const res = makeResponse();

        await register({ body: registration() }, res);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(User.create).not.toHaveBeenCalled();
    });

    test("returns a verifiable token for a correct password", async () => {
        User.findOne.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: USER_ID,
                username: "TestUser",
                email: "test@example.com",
                passwordHash,
                profileImage: "",
                tokenVersion: 3
            })
        });

        const res = makeResponse();

        await login({
            body: {
                email: "test@example.com",
                password: TEST_PASSWORD
            }
        }, res);

        expect(res.status).toHaveBeenCalledWith(200);

        const response = res.json.mock.calls[0][0];

        const decoded = jwt.verify(
            response.token,
            process.env.JWT_SECRET,
            { algorithms: ["HS256"] }
        );

        expect(decoded.id).toBe(USER_ID);
        expect(decoded.tokenVersion).toBe(3);

        expect(response.user).not.toHaveProperty("password");
        expect(response.user).not.toHaveProperty("passwordHash");
    });

    test("rejects an incorrect password without issuing a token", async () => {
        User.findOne.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: USER_ID,
                passwordHash,
                tokenVersion: 3
            })
        });

        const res = makeResponse();

        await login({
            body: {
                email: "test@example.com",
                password: "WrongPassword123!"
            }
        }, res);

        expect(res.status).toHaveBeenCalledWith(401);

        const response = res.json.mock.calls[0][0];
        expect(response).not.toHaveProperty("token");
    });

    test("logout increments the authenticated user's token version", async () => {
        User.findByIdAndUpdate.mockResolvedValue({
            _id: USER_ID,
            tokenVersion: 4
        });

        const res = makeResponse();

        await logout({
            user: { id: USER_ID }
        }, res);

        expect(res.status).toHaveBeenCalledWith(200);

        expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
            USER_ID,
            { $inc: { tokenVersion: 1 } },
            expect.any(Object)
        );
    });
});