const express = require("express");
const request = require("supertest");

jest.mock("../middleware/authMiddleware", () => (
    req,
    res,
    next
) => {
    if (!req.headers.authorization) {
        return res.status(401).json({
            message: "Authentication required"
        });
    }

    req.user = {
        id: "507f1f77bcf86cd799439011"
    };

    next();
});

jest.mock("../../reviews/models", () => ({
    createModels: jest.fn(() => ({}))
}));

jest.mock("../../reviews/services/review.service", () => ({
    createReviewService: jest.fn(() => ({
        mine: jest.fn()
    }))
}));

const {
    createReviewService
} = require("../../reviews/services/review.service");

const router = require("../routes/reviewHistoryRoutes");
const service = createReviewService.mock.results[0].value;

const app = express();
app.use("/api/reviews", router);

beforeEach(() => {
    service.mine.mockReset();

    service.mine.mockResolvedValue({
        reviews: [],
        pagination: {
            page: 1,
            limit: 20,
            total: 0
        }
    });

    jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

function getHistory(query = "") {
    return request(app)
        .get("/api/reviews/mine" + query)
        .set("Authorization", "Bearer test-placeholder");
}

describe("Personal review history route", () => {
    test("requires authentication", async () => {
        const response = await request(app)
            .get("/api/reviews/mine");

        expect(response.status).toBe(401);
        expect(service.mine).not.toHaveBeenCalled();
    });

    test("loads the authenticated user's first page", async () => {
        const response = await getHistory();

        expect(response.status).toBe(200);
        expect(response.headers["cache-control"]).toBe("no-store");

        expect(service.mine).toHaveBeenCalledWith(
            {},
            "507f1f77bcf86cd799439011"
        );

        expect(response.body.reviews).toEqual([]);
    });

    test("passes the requested page to the service", async () => {
        await getHistory("?page=2");

        expect(service.mine).toHaveBeenCalledWith(
            { page: "2" },
            "507f1f77bcf86cd799439011"
        );
    });

    test("ignores another user ID supplied in the query", async () => {
        await getHistory("?userId=another-user");

        expect(service.mine).toHaveBeenCalledWith(
            {},
            "507f1f77bcf86cd799439011"
        );
    });

    test.each([
        "?page=0",
        "?page=-1",
        "?page=1.5",
        "?page=abc",
        "?page=10001",
        "?page=1&page=2"
    ])("rejects invalid pagination: %s", async query => {
        const response = await getHistory(query);

        expect(response.status).toBe(400);
        expect(service.mine).not.toHaveBeenCalled();
    });

    test.each([400, 401])(
        "handles a service error with status %s",
        async status => {
            service.mine.mockRejectedValue(
                Object.assign(new Error("Test error"), {
                    status
                })
            );

            const response = await getHistory();

            expect(response.status).toBe(status);
        }
    );

    test("hides internal database errors", async () => {
        service.mine.mockRejectedValue(
            new Error("Private database details")
        );

        const response = await getHistory();

        expect(response.status).toBe(500);
        expect(JSON.stringify(response.body))
            .not.toContain("Private database details");
    });
});