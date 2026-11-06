const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const validateRegisterInput = require("../vaildators/registerValidator");
const { getPasswordError } = require("../services/passwordPolicy");

async function register(req, res) {
    try {
        const data = req.body || {};
        const errors = validateRegisterInput(data);

        if (errors.length > 0) {
            return res.status(400).json({
                message: "Invalid registration input",
                errors
            });
        }

        const username = data.username.trim();
        const email = data.email.trim().toLowerCase();
        const password = data.password;

        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.status(409).json({
                message: "Email already registered"
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const user = await User.create({
            username,
            email,
            passwordHash
        });

        return res.status(201).json({
            message: "User registered successfully",
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        });
    } catch (error) {
        if (error?.code === 11000) {
            return res.status(409).json({
                message: "Email already registered"
            });
        }

        console.error("Registration error:", error);

        return res.status(500).json({
            message: "Internal server error"
        });
    }
}

async function login(req, res) {
    try {
        const data = req.body || {};

        const email = typeof data.email === "string"
            ? data.email.trim().toLowerCase()
            : "";

        const password = typeof data.password === "string"
            ? data.password
            : "";

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        const passwordError = getPasswordError(password, {
            requireMinimum: false
        });

        if (passwordError) {
            return res.status(400).json({
                message: passwordError
            });
        }

        const user = await User.findOne({ email })
            .select("+passwordHash");

        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const isMatch = await bcrypt.compare(
            password,
            user.passwordHash
        );

        if (!isMatch) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is missing");
        }

        const token = jwt.sign(
            {
                id: user._id.toString(),
                tokenVersion: user.tokenVersion ?? 0
            },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        return res.status(200).json({
            message: "Login successful",
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                profileImage: user.profileImage
            }
        });
    } catch (error) {
        console.error("Login error:", error);

        return res.status(500).json({
            message: "Internal server error"
        });
    }
}

async function logout(req, res) {
    try {
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { $inc: { tokenVersion: 1 } },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        return res.status(200).json({
            message: "Logout successful"
        });
    } catch (error) {
        console.error("Logout error:", error);

        return res.status(500).json({
            message: "Internal server error"
        });
    }
}

module.exports = {
    register,
    login,
    logout
};