const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function authMiddleware(req, res, next) {
    // 1. Get JWT from request header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            message: "Authentication required"
        });
    }

    const token = authHeader.slice(7);

    if (!token) {
        return res.status(401).json({
            message: "Authentication required"
        });
    }

    if (!process.env.JWT_SECRET) {
        return res.status(500).json({
            message: "Authentication service unavailable"
        });
    }

    // 2. Verify JWT
    let decoded;

    try {
        decoded = jwt.verify(
            token,
            process.env.JWT_SECRET,
            { algorithms: ["HS256"] }
        );
    } catch (error) {
        return res.status(401).json({
            message: "Invalid or expired token"
        });
    }

    // 3. Find the logged-in user
    try {
        if (!decoded.id) {
            return res.status(401).json({
                message: "Invalid token"
            });
        }

        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({
                message: "User not found"
            });
        }

        // 4. Provide user information to other routes
        req.user = {
            id: user._id.toString(),
            username: user.username,
            profileImage: user.profileImage || ""
        };

        next();

    } catch (error) {
        console.error("Authentication error:", error);
        return res.status(500).json({
            message: "Internal server error"
        });
    }
}

module.exports = authMiddleware;
