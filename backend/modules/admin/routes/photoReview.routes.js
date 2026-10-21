const express = require("express");

const requireAdmin = require("../middleware/requireAdmin");

const {
    getPhotos,
    approvePhoto,
    rejectPhoto,
    setCover,
    previewPhoto,
} = require("../controllers/photoReview.controller");

const router = express.Router();

// All routes require administrator authentication
router.use(requireAdmin);

// Get photos by status
router.get("/", getPhotos);

// Preview uploaded photo
router.get("/:id/image", previewPhoto);

// Approve photo
router.patch("/:id/approve", approvePhoto);

// Reject photo
router.patch("/:id/reject", rejectPhoto);

// Set restaurant cover
router.patch("/:id/set-cover", setCover);

module.exports = router;