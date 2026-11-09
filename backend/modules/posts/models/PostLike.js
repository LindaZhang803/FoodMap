const mongoose = require("mongoose");

const postLikeSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

postLikeSchema.index(
  {
    postId: 1,
    userId: 1,
  },
  {
    unique: true,
  }
);

postLikeSchema.index({
  userId: 1,
  createdAt: -1,
});

module.exports =
  mongoose.models.PostLike ||
  mongoose.model("PostLike", postLikeSchema);