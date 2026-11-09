const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },

    reviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Review",
      required: true,
      unique: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 120,
    },

    caption: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },

    imageUrls: {
      type: [String],
      required: true,
      validate: {
        validator(value) {
          return (
            Array.isArray(value) &&
            value.length >= 1 &&
            value.length <= 5
          );
        },
        message: "A post requires 1–5 photos.",
      },
    },

    coverAspectRatio: {
      type: Number,
      default: 1,
      min: 0.5,
      max: 2,
    },

    likeCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: ["published", "hidden"],
      default: "published",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

postSchema.index({
  status: 1,
  createdAt: -1,
  _id: -1,
});

postSchema.index({
  status: 1,
  likeCount: -1,
  createdAt: -1,
  _id: -1,
});

postSchema.index({
  authorId: 1,
  createdAt: -1,
});

module.exports =
  mongoose.models.Post ||
  mongoose.model("Post", postSchema);