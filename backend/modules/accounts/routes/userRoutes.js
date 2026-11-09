const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
    getMyProfile,
    updateMyProfile
} = require("../controllers/userController");

const {
    avatarUploadLimiter,
    receiveAvatar
} = require("../middleware/avatarUpload");

const {
    uploadMyAvatar
} = require("../controllers/avatarController");

router.get("/me", authMiddleware, getMyProfile);
router.put("/me", authMiddleware, updateMyProfile);

router.post(
    "/me/avatar",
    authMiddleware,
    avatarUploadLimiter,
    receiveAvatar,
    uploadMyAvatar
);

module.exports = router;