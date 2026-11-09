const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");
const mongoose = require("mongoose");

const Restaurant = require("../models/Restaurant");
const photoService = require("../services/restaurantPhoto.service");

async function uploadPhoto(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid restaurant ID",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "Please select an image",
      });
    }

    const restaurant = await Restaurant.findById(req.params.id);

    if (!restaurant) {
      return res.status(404).json({
        message: "Restaurant not found",
      });
    }

    const metadata = await sharp(req.file.buffer).metadata();

    if (!["jpeg", "png", "webp"].includes(metadata.format)) {
      return res.status(400).json({
        message: "Unsupported image format",
      });
    }

    const filename = `${require("crypto").randomUUID()}.jpg`;

    const uploadDir = path.join(
      __dirname,
      "../../../uploads/restaurant"
    );

    await fs.mkdir(uploadDir, { recursive: true });

    const fullPath = path.join(uploadDir, filename);

    await sharp(req.file.buffer)
      .rotate()
      .resize(1600, 1600, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80 })
      .toFile(fullPath);

    const imageUrl = `/uploads/restaurant/${filename}`;

    try {
      const photo = await photoService.createPhoto(
        req.params.id,
        imageUrl
      );

      return res.status(201).json({
        message: "Photo submitted for review",
        photoId: photo._id,
        status: photo.status,
      });
    } catch (error) {
      await fs.unlink(fullPath).catch(() => {});
      throw error;
    }
  } catch (error) {
    console.error("Upload error:", error);

    return res.status(error.status || 500).json({
      message: error.status ? error.message : "Photo upload failed",
    });
  }
}

const RestaurantPhoto = require("../models/RestaurantPhoto");

// Public image access: approved photos only
async function getApprovedPhotoImage(req, res) {
    try {
        const { photoId } = req.params;

        if (!mongoose.isValidObjectId(photoId)) {
            return res.status(400).json({
                message: "Invalid photo ID"
            });
        }

        // Only approved photos are publicly accessible
        const photo = await RestaurantPhoto.findOne({
            _id: photoId,
            status: "approved"
        });

        if (!photo) {
            return res.status(404).json({
                message: "Photo not found"
            });
        }

        // Do not use a path supplied by the client
        const filename = path.basename(photo.imageUrl);

        const filePath = path.join(
            __dirname,
            "../../../uploads/restaurant",
            filename
        );

        await fs.access(filePath);

        res.set("Cache-Control", "no-store");

        return res.sendFile(filePath, {
            headers: {
                "Content-Type": "image/jpeg"
            }
        });

    } catch (error) {
        if (error.code === "ENOENT") {
            return res.status(404).json({
                message: "Image file not found"
            });
        }

        console.error("Public image error:", error);

        return res.status(500).json({
            message: "Failed to load image"
        });
    }
}

module.exports = {
    uploadPhoto,
    getApprovedPhotoImage,
};