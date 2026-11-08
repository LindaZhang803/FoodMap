require("dotenv").config();

const path = require("path");
const express = require("express");
const connectDB = require("./database/connect");

const restaurantRoutes = require(
    "./modules/restaurants/routes/restaurant.routes"
);

const restaurantPhotoRoutes = require(
    "./modules/restaurants/routes/restaurantPhoto.routes"
);

const photoReviewRoutes = require(
    "./modules/admin/routes/photoReview.routes"
);

const authRoutes = require(
    "./modules/accounts/routes/authRoutes"
);

const userRoutes = require(
    "./modules/accounts/routes/userRoutes"
);

const {
    AVATAR_DIRECTORY
} = require("./modules/accounts/services/avatarService");

const app = express();

app.use(express.json());

const AVATAR_PATH_PATTERN = /^\/[a-f0-9]{24}-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.jpg$/;

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

// Account registration, login, logout and profile.
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);

// Existing admin dashboard.
app.get("/admin/photos", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "modules/admin/views/photoReview.html"
        )
    );
});

// Existing review module, including /api/reviews/mine.
require("./modules/reviews/app").mountReviewModule(app, {
    mongoose: require("mongoose"),
    Restaurant: require(
        "./modules/restaurants/models/Restaurant"
    ),
    authenticate: require(
        "./modules/accounts/middleware/authMiddleware"
    )
});

// Existing restaurant and photo APIs.
app.use("/api/restaurants", restaurantRoutes);
app.use("/api/restaurants", restaurantPhotoRoutes);

// Existing admin photo review API.
app.use("/api/admin/photos", photoReviewRoutes);

// Handle avatar file-serving errors without exposing local paths.
app.use("/uploads/avatars", (error, req, res, next) => {
    if (res.headersSent) {
        return next(error);
    }

    const status = error.status === 404 ? 404 : 500;

    if (status === 500) {
        console.error("Avatar file request failed:", error);
    }

    return res.status(status).json({
        message: status === 404
            ? "Not found"
            : "Could not load avatar."
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
                "Failed to start server:",
                error.code || "Listen error"
            );

            process.exit(1);
        });
    } catch (error) {
        console.error(
            "Failed to start server:",
            error.message
        );

        process.exit(1);
    }
}

if (require.main === module) {
    startServer();
}

module.exports = app;