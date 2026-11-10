const express = require("express");
const mongoose = require("mongoose");

const authenticate = require(
  "../../accounts/middleware/authMiddleware"
);

const Post = require("../models/Post");

const router = express.Router();

const { Schema } = mongoose;

const ID_PATTERN = /^[a-f0-9]{24}$/i;

// =====================================================
// Models
// =====================================================

const commentSchema = new Schema(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: "Post",
      required: true,
      index: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 1000,
    },
  },
  { timestamps: true }
);

commentSchema.index({
  postId: 1,
  createdAt: 1,
  _id: 1,
});

const favoriteSchema = new Schema(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

favoriteSchema.index(
  { postId: 1, userId: 1 },
  { unique: true }
);

const PostComment =
  mongoose.models.PostComment ||
  mongoose.model("PostComment", commentSchema);

const PostFavorite =
  mongoose.models.PostFavorite ||
  mongoose.model("PostFavorite", favoriteSchema);

// =====================================================
// Helpers
// =====================================================

function optionalAuth(req, res, next) {
  if (req.headers.authorization) {
    return authenticate(req, res, next);
  }

  return next();
}

function validId(id) {
  return typeof id === "string" &&
    ID_PATTERN.test(id);
}

async function findPublishedPost(req, res, next) {
  if (!validId(req.params.id)) {
    return res.status(400).json({
      message: "Invalid post ID.",
    });
  }

  try {
    const post = await Post.findOne({
      _id: req.params.id,
      status: "published",
    }).select("_id");

    if (!post) {
      return res.status(404).json({
        message: "Post not found.",
      });
    }

    return next();
  } catch (error) {
    return next(error);
  }
}

function normalizeComment(comment) {
  return {
    id: String(comment._id),
    content: comment.content,
    author: {
      id: String(
        comment.authorId?._id ??
        comment.authorId
      ),
      username:
        comment.authorId?.username ??
        "FoodMap User",
    },
    createdAt: comment.createdAt,
  };
}

// =====================================================
// Read Comments and Favorite Status
// =====================================================

router.get(
  "/:id/social",
  optionalAuth,
  findPublishedPost,
  async (req, res, next) => {
    try {
      const postId = req.params.id;
      const userId = req.user?.id ?? null;

      const [
        comments,
        commentCount,
        favoriteCount,
        favorite,
      ] = await Promise.all([
        PostComment.find({ postId })
          .sort({ createdAt: 1, _id: 1 })
          .limit(100)
          .populate("authorId", "username")
          .lean(),

        PostComment.countDocuments({ postId }),

        PostFavorite.countDocuments({ postId }),

        userId
          ? PostFavorite.exists({ postId, userId })
          : Promise.resolve(null),
      ]);

      return res.json({
        items: comments.map(normalizeComment),
        commentCount,
        favoriteCount,
        savedByMe: Boolean(favorite),
      });
    } catch (error) {
      next(error);
    }
  }
);

// =====================================================
// Create Comment
// =====================================================

router.post(
  "/:id/comments",
  authenticate,
  findPublishedPost,
  async (req, res, next) => {
    try {
      const content =
        typeof req.body?.content === "string"
          ? req.body.content.trim()
          : "";

      if (!content || content.length > 1000) {
        return res.status(400).json({
          message:
            "Comment must contain 1–1000 characters.",
        });
      }

      const comment = await PostComment.create({
        postId: req.params.id,
        authorId: req.user.id,
        content,
      });

      await comment.populate(
        "authorId",
        "username"
      );

      return res.status(201).json(
        normalizeComment(comment)
      );
    } catch (error) {
      next(error);
    }
  }
);

// =====================================================
// Save Post
// =====================================================

router.put(
  "/:id/favorite",
  authenticate,
  findPublishedPost,
  async (req, res, next) => {
    try {
      const postId = req.params.id;
      const userId = req.user.id;

      await PostFavorite.updateOne(
        { postId, userId },
        { $setOnInsert: { postId, userId } },
        { upsert: true }
      );

      const favoriteCount =
        await PostFavorite.countDocuments({
          postId,
        });

      return res.json({
        saved: true,
        favoriteCount,
      });
    } catch (error) {
      next(error);
    }
  }
);

// =====================================================
// Unsave Post
// =====================================================

router.delete(
  "/:id/favorite",
  authenticate,
  findPublishedPost,
  async (req, res, next) => {
    try {
      const postId = req.params.id;
      const userId = req.user.id;

      await PostFavorite.deleteOne({
        postId,
        userId,
      });

      const favoriteCount =
        await PostFavorite.countDocuments({
          postId,
        });

      return res.json({
        saved: false,
        favoriteCount,
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;