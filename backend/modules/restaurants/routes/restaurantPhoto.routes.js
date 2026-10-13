const express = require("express");
const multer = require("multer");
const rateLimit = require("express-rate-limit");

const {
    uploadPhoto,
    getApprovedPhotoImage,
} = require("../controllers/restaurantPhoto.controller");

const router = express.Router();

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },

  fileFilter(req, file, callback) {
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(
        file.mimetype
      )
    ) {
      return callback(new Error("Unsupported image type"));
    }

    callback(null, true);
  },
});

router.post(
  "/:id/photos",
  uploadLimiter,
  (req, res, next) => {
    upload.single("photo")(req, res, (error) => {
      if (error) {
        return res.status(400).json({
          message: error.message,
        });
      }

      next();
    });
  },
  uploadPhoto
);

// Public access to approved restaurant photos
router.get(
    "/photos/:photoId/image",
    getApprovedPhotoImage
);

module.exports = router;