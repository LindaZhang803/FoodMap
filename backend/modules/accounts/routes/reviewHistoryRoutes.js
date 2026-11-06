const express = require("express");
const mongoose = require("mongoose");
const authMiddleware = require("../middleware/authMiddleware");

const {
    createModels
} = require("../../reviews/models");

const {
    createReviewService
} = require("../../reviews/services/review.service");

const models = createModels(mongoose);

const reviewService = createReviewService({
    mongoose,
    ...models
});

const router = express.Router();

router.get("/mine", authMiddleware, async (req, res) => {
    const page = req.query.page;

    if (
        page !== undefined &&
        (
            typeof page !== "string" ||
            !/^[1-9]\d{0,4}$/.test(page) ||
            Number(page) > 10000
        )
    ) {
        return res.status(400).json({
            message: "Invalid page"
        });
    }

    try {
        const result = await reviewService.mine(
            page === undefined ? {} : { page },
            req.user.id
        );

        res.setHeader("Cache-Control", "no-store");

        return res.status(200).json(result);
    } catch (error) {
        if (error.status === 400 || error.status === 401) {
            return res.status(error.status).json({
                message: error.status === 401
                    ? "Authentication required"
                    : "Invalid page"
            });
        }

        console.error("Review history failed:", error);

        return res.status(500).json({
            message: "Could not load your reviews. Please try again."
        });
    }
});

module.exports = router;