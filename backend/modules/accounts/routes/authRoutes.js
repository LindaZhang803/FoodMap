const express = require("express");
const router = express.Router();

const {
    register,
    login,
    logout
} = require("../controllers/authController");

const authMiddleware = require("../middleware/authMiddleware");

const {
    registerLimiter,
    loginLimiter
} = require("../middleware/authRateLimit");

router.post("/register", registerLimiter, register);
router.post("/login", loginLimiter, login);
router.post("/logout", authMiddleware, logout);

module.exports = router;