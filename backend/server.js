require("dotenv").config();

const path = require("path");
const express = require("express");
const mongoose = require("mongoose");

const connectDB = require("./database/connect");

// =====================================================
// 1. Restaurant Module
// =====================================================

const restaurantRoutes = require(
  "./modules/restaurants/routes/restaurant.routes"
);

const restaurantPhotoRoutes = require(
  "./modules/restaurants/routes/restaurantPhoto.routes"
);

const Restaurant = require(
  "./modules/restaurants/models/Restaurant"
);

// =====================================================
// 2. Admin Module
// =====================================================

const photoReviewRoutes = require(
  "./modules/admin/routes/photoReview.routes"
);

// =====================================================
// 3. Accounts Module
// =====================================================

const authRoutes = require(
  "./modules/accounts/routes/authRoutes"
);

const userRoutes = require(
  "./modules/accounts/routes/userRoutes"
);

const authenticate = require(
  "./modules/accounts/middleware/authMiddleware"
);

const {
  AVATAR_DIRECTORY,
} = require(
  "./modules/accounts/services/avatarService"
);

// =====================================================
// 4. Reviews Module
// =====================================================

const {
  mountReviewModule,
} = require("./modules/reviews/app");

// =====================================================
// 5. Favorites Module
// =====================================================

const {
  mountFavoritesModule,
} = require("./modules/feed");

// =====================================================
// 6. Posts Module
// =====================================================

const postRoutes = require(
  "./modules/posts/routes/postRoutes"
);

// =====================================================
// 7. Express
// =====================================================

const app = express();

// =====================================================
// 8. CORS
// =====================================================

app.use((req, res, next) => {
  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, PATCH, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

// =====================================================
// 9. JSON Middleware
// =====================================================

app.use(express.json());

// =====================================================
// 10. Avatar File Security
// =====================================================

// Allowed filename:
// 24-character hexadecimal user ID
// followed by a UUIDv4 and .jpg extension.

const AVATAR_PATH_PATTERN =
  /^\/?[a-f0-9]{24}-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.jpg$/i;

function allowAvatarRequest(req, res, next) {
  if (
    req.method !== "GET" &&
    req.method !== "HEAD"
  ) {
    res.setHeader("Allow", "GET, HEAD");

    return res.status(405).json({
      message: "Method not allowed",
    });
  }

  const match = AVATAR_PATH_PATTERN.exec(
    req.path
  );

  if (
    !match ||
    match[0] !== req.path
  ) {
    return res.status(404).json({
      message: "Not found",
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
    },
  })
);

// =====================================================
// 11. Accounts API
// =====================================================

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/users",
  userRoutes
);

// =====================================================
// 12. Admin Dashboard
// =====================================================

app.get("/admin/photos", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "modules/admin/views/photoReview.html"
    )
  );
});

// =====================================================
// 13. Reviews API
// =====================================================

// Register the Review, Dish, ReviewLike,
// and ReviewPhoto models on the shared
// Mongoose connection before handling
// post creation requests.

mountReviewModule(app, {
  mongoose,
  Restaurant,
  authenticate,
});

// =====================================================
// 14. Restaurants API
// =====================================================

app.use(
  "/api/restaurants",
  restaurantRoutes
);

app.use(
  "/api/restaurants",
  restaurantPhotoRoutes
);

// =====================================================
// 15. Posts API
// =====================================================

// Public:
// GET /api/posts
// GET /api/posts/:id
// GET /api/posts/photos/:photoId
//
// Authenticated:
// POST /api/posts
// PUT /api/posts/:id/like
// DELETE /api/posts/:id/like
// DELETE /api/posts/:id

app.use(
  "/api/posts",
  postRoutes
);

// =====================================================
// 16. Admin Photo Review API
// =====================================================

app.use(
  "/api/admin/photos",
  photoReviewRoutes
);

// =====================================================
// 17. Avatar Error Handler
// =====================================================

app.use(
  "/uploads/avatars",
  (error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }

    const status =
      error.status === 404
        ? 404
        : 500;

    if (status === 500) {
      console.error(
        "Avatar file request failed:",
        error
      );
    }

    return res.status(status).json({
      message:
        status === 404
          ? "Not found"
          : "Could not load avatar.",
    });
  }
);

// =====================================================
// 18. Server Configuration
// =====================================================

function readServerPort() {
  for (const name of [
    "MONGO_URI",
    "JWT_SECRET",
  ]) {
    if (
      typeof process.env[name] !== "string" ||
      !process.env[name].trim()
    ) {
      throw new Error(
        name + " is required."
      );
    }
  }

  const port = Number(
    process.env.PORT || 3000
  );

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

// =====================================================
// 19. Favorites Initialization
// =====================================================

async function initializeFavorites() {
  if (
    mongoose.connection.readyState !== 1
  ) {
    throw new Error(
      "MongoDB must be connected before initializing Favorites."
    );
  }

  // Dish is created by the Reviews module.
  const Dish =
    mongoose.connection.models.Dish;

  if (!Dish) {
    throw new Error(
      "Favorites initialization failed: Dish model is not registered."
    );
  }

  if (
    !Restaurant ||
    typeof Restaurant.findById !== "function"
  ) {
    throw new Error(
      "Favorites initialization failed: Restaurant model is unavailable."
    );
  }

  if (
    typeof authenticate !== "function"
  ) {
    throw new Error(
      "Favorites initialization failed: authentication middleware is unavailable."
    );
  }

  await mountFavoritesModule(app, {
    connection: mongoose.connection,
    authenticate,
    Restaurant,
    Dish,
  });

  console.log(
    "Favorites API initialized: /api/favorites"
  );
}

// =====================================================
// 20. Validate Posts Dependencies
// =====================================================

function validatePostsDependencies() {
  const requiredModels = [
    "User",
    "Restaurant",
    "Review",
    "ReviewPhoto",
    "Post",
    "PostLike",
    "PostPhoto",
  ];

  const missing = requiredModels.filter(
    (name) =>
      !mongoose.connection.models[name]
  );

  if (missing.length > 0) {
    throw new Error(
      "Posts initialization failed. Missing models: " +
        missing.join(", ")
    );
  }

  console.log(
    "Posts API initialized: /api/posts"
  );
}

// =====================================================
// 21. Start Server
// =====================================================

async function startServer() {
  try {
    const port = readServerPort();

    // Step 1: Connect to MongoDB.
    await connectDB();

    console.log(
      "MongoDB connected."
    );

    // Step 2: Initialize Favorites.
    await initializeFavorites();

    // Step 3: Check Posts dependencies.
    validatePostsDependencies();

    // Step 4: Start HTTP server.
    const server = app.listen(port);

    server.once("listening", () => {
      console.log(
        "Server running on port " + port
      );
    });

    server.once("error", (error) => {
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

// =====================================================
// 22. Entry Point
// =====================================================

if (require.main === module) {
  startServer();
}

module.exports = app;