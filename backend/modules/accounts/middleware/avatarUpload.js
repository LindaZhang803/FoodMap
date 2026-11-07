const multer = require("multer");
const { rateLimit } = require("express-rate-limit");

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = Object.freeze([
    "image/jpeg",
    "image/png",
    "image/webp"
]);

class UnsupportedAvatarTypeError extends Error {
    constructor() {
        super("Please choose a JPG, PNG, or WebP image.");
        this.name = "UnsupportedAvatarTypeError";
    }
}

function hasUser(req) {
    return (
        typeof req.user?.id === "string" &&
        req.user.id.length > 0
    );
}

const limitUploads = rateLimit({
    windowMs: 60 * 1000,
    limit: 5,
    keyGenerator: req => req.user.id,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        message: "Too many avatar uploads. Please try again in a minute."
    }
});

function avatarUploadLimiter(req, res, next) {
    if (!hasUser(req)) {
        return res.status(401).json({
            message: "Authentication required"
        });
    }

    return limitUploads(req, res, next);
}

function acceptImage(req, file, callback) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
        return callback(new UnsupportedAvatarTypeError());
    }

    callback(null, true);
}

const parseAvatar = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: MAX_AVATAR_BYTES,
        files: 1,
        fields: 0,
        parts: 1,
        fieldNameSize: 40
    },
    fileFilter: acceptImage
}).single("avatar");

function sendUploadError(error, res) {
    if (error instanceof UnsupportedAvatarTypeError) {
        return res.status(415).json({
            message: error.message
        });
    }

    if (error instanceof multer.MulterError) {
        const tooLarge = error.code === "LIMIT_FILE_SIZE";

        return res.status(tooLarge ? 413 : 400).json({
            message: tooLarge
                ? "Please choose an image no larger than 5 MB."
                : "Please upload exactly one JPG, PNG, or WebP image."
        });
    }

    console.error("Avatar upload parsing failed:", error);

    return res.status(400).json({
        message: "The image upload could not be read. Please try again."
    });
}

function receiveAvatar(req, res, next) {
    if (!hasUser(req)) {
        return res.status(401).json({
            message: "Authentication required"
        });
    }

    if (!req.is("multipart/form-data")) {
        return res.status(415).json({
            message: "Please upload an image as multipart form data."
        });
    }

    parseAvatar(req, res, error => {
        if (error) {
            return sendUploadError(error, res);
        }

        if (!req.file || req.file.size === 0) {
            return res.status(400).json({
                message: "Please select a non-empty image to upload."
            });
        }

        next();
    });
}

module.exports = {
    avatarUploadLimiter,
    receiveAvatar
};