const mongoose = require("mongoose");

const fs = require("fs");
const path = require("path");

const RestaurantPhoto = require(
  "../../restaurants/models/RestaurantPhoto"
);

const Restaurant = require(
  "../../restaurants/models/Restaurant"
);

async function getPhotos(req, res) {
  try {
    const status = req.query.status || "pending";

    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({
        message: "Invalid status",
      });
    }

    const photos = await RestaurantPhoto.find({ status })
      .populate("restaurantId", "name address cuisineType")
      .sort({ createdAt: -1 });

    res.json(photos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load photos" });
  }
}

async function approvePhoto(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid photo ID",
      });
    }

    const photo = await RestaurantPhoto.findOneAndUpdate(
      { _id: req.params.id, status: "pending" },
      {
        $set: {
          status: "approved",
          reviewedAt: new Date(),
          rejectionReason: null,
        },
      },
      { new: true }
    );

    if (!photo) {
      return res.status(404).json({
        message: "Pending photo not found",
      });
    }

    res.json(photo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Approval failed" });
  }
}

async function rejectPhoto(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid photo ID",
      });
    }

    const photo = await RestaurantPhoto.findOneAndUpdate(
      { _id: req.params.id, status: "pending" },
      {
        $set: {
          status: "rejected",
          reviewedAt: new Date(),
          rejectionReason: req.body.reason || null,
        },
      },
      { new: true }
    );

    if (!photo) {
      return res.status(404).json({
        message: "Pending photo not found",
      });
    }

    res.json(photo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Rejection failed" });
  }
}

async function setCover(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid photo ID",
      });
    }

    const photo = await RestaurantPhoto.findOne({
      _id: req.params.id,
      status: "approved",
    });

    if (!photo) {
      return res.status(404).json({
        message: "Approved photo not found",
      });
    }

    const restaurant = await Restaurant.findById(photo.restaurantId);

    if (!restaurant) {
      return res.status(404).json({
        message: "Restaurant not found",
      });
    }

    // Important: use a single source of truth for the current cover.
    await RestaurantPhoto.updateMany(
      { restaurantId: photo.restaurantId },
      { $set: { isCover: false } }
    );

    photo.isCover = true;
    await photo.save();

    restaurant.imageUrl = `/api/restaurants/photos/${photo._id}/image`;
    await restaurant.save();

    res.json({
      message: "Restaurant cover updated",
      restaurantId: restaurant._id,
      imageUrl: restaurant.imageUrl,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to set cover" });
  }
}

async function previewPhoto(req, res) {
    try {
        const RestaurantPhoto = require(
            "../../restaurants/models/RestaurantPhoto"
        );

        const photo = await RestaurantPhoto.findById(req.params.id);

        if (!photo) {
            return res.status(404).json({
                message: "Photo not found"
            });
        }

        const filename = path.basename(photo.imageUrl);

        const filePath = path.join(
            __dirname,
            "../../../uploads/restaurant",
            filename
        );

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                message: "Image file not found"
            });
        }

        res.type("image/jpeg");
        res.sendFile(filePath);

    } catch (error) {
        console.error("Preview error:", error);

        res.status(500).json({
            message: "Failed to load image"
        });
    }
}

module.exports = {
    getPhotos,
    approvePhoto,
    rejectPhoto,
    setCover,
    previewPhoto,
};