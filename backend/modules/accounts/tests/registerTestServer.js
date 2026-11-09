require("dotenv").config();

const express = require("express");
const connectDB = require("../../../database/connect");

const authRoutes = require("../routes/authRoutes");
const authMiddleware = require("../middleware/authMiddleware");
const userRoutes = require("../routes/userRoutes");
const reviewHistoryRoutes = require("../routes/reviewHistoryRoutes");

const {
    AVATAR_DIRECTORY
} = require("../services/avatarService");

const app = express();

const AVATAR_PATH_PATTERN = /^\/[a-f0-9]{24}-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.jpg$/;

const ERROR_MESSAGES = Object.freeze({
    400: "Invalid request.",
    403: "Access denied.",
    404: "Not found",
    405: "Method not allowed",
    413: "Request is too large.",
    415: "Unsupported request format.",
    429: "Too many requests. Please try again later.",
    500: "Internal server error"
});

function allowAvatarRequest(req, res, next) {
    if (req.method !== "GET" && req.method !== "HEAD") {
        res.setHeader("Allow", "GET, HEAD");

        return res.status(405).json({
            message: "Method not allowed"
        });
    }

    const match = AVATAR_PATH_PATTERN.exec(req.path);

    if (!match || match[0] !== req.path) {
        return res.status(404).json({
            message: "Not found"
        });
    }

    next();
}

app.disable("x-powered-by");

app.use(express.json({
    limit: "100kb"
}));

app.use(
    "/uploads/avatars",
    allowAvatarRequest,
    express.static(AVATAR_DIRECTORY, {
        dotfiles: "deny",
        index: false,
        redirect: false,
        fallthrough: false,
        maxAge: "1h",
        immutable: true,
        setHeaders(res) {
            res.setHeader(
                "X-Content-Type-Options",
                "nosniff"
            );
        }
    })
);

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/reviews", reviewHistoryRoutes);

app.get("/api/auth/test", authMiddleware, (req, res) => {
    res.status(200).json({
        message: "Authentication successful",
        user: req.user
    });
});

app.use((req, res) => {
    res.status(404).json({
        message: "Not found"
    });
});

app.use((error, req, res, next) => {
    if (res.headersSent) {
        return next(error);
    }

    const status = (
        Number.isInteger(error.status) &&
        error.status >= 400 &&
        error.status < 500
    ) ? error.status : 500;

    if (status === 500) {
        console.error("Request failed:", error);
    }

    res.status(status).json({
        message: ERROR_MESSAGES[status] || "Invalid request."
    });
});

function readServerPort() {
    for (const name of ["MONGO_URI", "JWT_SECRET"]) {
        if (
            typeof process.env[name] !== "string" ||
            !process.env[name].trim()
        ) {
            throw new Error(name + " is required.");
        }
    }

    const port = Number(process.env.PORT || 3000);

    if (
        !Number.isInteger(port) ||
        port < 1 ||
        port > 65535
    ) {
        throw new Error(
            "PORT must be an integer between 1 and 65535."
        );
    }

    return port;
}

async function startServer() {
    try {
        const port = readServerPort();

        await connectDB();

        const server = app.listen(port);

        server.once("listening", () => {
            console.log(
                "Server running on port " + port
            );
        });

        server.once("error", error => {
            console.error(
                "Server failed:",
                error.code || "Listen error"
            );

            process.exit(1);
        });
    } catch (error) {
        console.error(
            "Server failed:",
            error.message
        );

        process.exit(1);
    }
}

if (require.main === module) {
    startServer();
}

module.exports = app;