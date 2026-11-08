const { rateLimit } = require("express-rate-limit");

const AUTH_WINDOW_MS = 15 * 60 * 1000;

const commonOptions = Object.freeze({
    windowMs: AUTH_WINDOW_MS,
    statusCode: 429,
    standardHeaders: "draft-8",
    legacyHeaders: false
});

const registerLimiter = rateLimit({
    ...commonOptions,
    identifier: "account-registration",
    limit: 10,
    message: {
        message:
            "Too many registration attempts. Please try again later."
    }
});

const loginLimiter = rateLimit({
    ...commonOptions,
    identifier: "account-login",
    limit: 10,
    skipSuccessfulRequests: true,
    requestWasSuccessful: (_req, res) => res.statusCode === 200,
    message: {
        message:
            "Too many login attempts. Please try again later."
    }
});

module.exports = {
    registerLimiter,
    loginLimiter
};