require("dotenv").config();

const express = require("express");
const connectDB = require("../../../database/connect");
const authRoutes = require("../routes/authRoutes");
const authMiddleware = require("../middleware/authMiddleware");
const userRoutes = require("../routes/userRoutes");

const app = express();

app.use(express.json());


app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.get("/api/auth/test", authMiddleware, (req, res) => {
    res.status(200).json({
        message: "Authentication successful",
        user: req.user
    });
});


async function startServer() {
    try {
        await connectDB();

        const PORT = process.env.PORT || 3000;

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Server failed:", error.message);
    }
}

startServer();
