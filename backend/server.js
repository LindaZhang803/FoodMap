require("dotenv").config();
const path = require("path");

const express = require("express");
const connectDB = require("./database/connect");

const restaurantRoutes = require(
    "./modules/restaurants/routes/restaurant.routes"
);

// Restaurant Photo Upload Routes
const restaurantPhotoRoutes = require(
    "./modules/restaurants/routes/restaurantPhoto.routes"
);

// Admin Photo Review Routes
const photoReviewRoutes = require(
    "./modules/admin/routes/photoReview.routes"
);

const app = express();

app.use(express.json());

// Admin dashboard page
app.get("/admin/photos", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "modules/admin/views/photoReview.html"
        )
    );
});

// Restaurant API
app.use("/api/restaurants", restaurantRoutes);

// Restaurant Photo Upload API
app.use("/api/restaurants", restaurantPhotoRoutes);

// Admin Photo Review API
app.use("/api/admin/photos", photoReviewRoutes);

const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        await connectDB();

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error.message);
        process.exit(1);
    }
}

startServer();