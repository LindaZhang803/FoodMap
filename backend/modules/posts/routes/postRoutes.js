const express = require("express");
const mongoose = require("mongoose");

const authenticate = require(
  "../../accounts/middleware/authMiddleware"
);

const controller = require(
  "../controllers/postController"
);

const router = express.Router();

// =====================================================
// Optional Authentication
// =====================================================

function optionalAuth(req, res, next) {
  if (req.headers.authorization) {
    return authenticate(req, res, next);
  }

  return next();
}

// =====================================================
// Public Posts
// =====================================================

router.get(
  "/",
  optionalAuth,
  controller.listPosts
);

// =====================================================
// Eligible Reviews for Creating Posts
// =====================================================

// Read actual reviews from MongoDB instead of relying
// on the account review-history response format.

router.get(
  "/eligible-reviews",
  authenticate,
  async (req, res) => {
    try {
      const Review =
        mongoose.models.Review;

      if (!Review) {
        return res.status(503).json({
          message:
            "Reviews module is unavailable.",
        });
      }

      const reviews = await Review.find({
        userId: req.user.id,

        // The review must contain at least one photo.
        "photoUrls.0": {
          $exists: true,
        },
      })
        .select(
          "_id restaurantId reviewType rating comment photoUrls createdAt"
        )
        .populate(
          "restaurantId",
          "name"
        )
        .sort({
          createdAt: -1,
        })
        .limit(100)
        .lean();

      const items = reviews
        .map((review) => {
          const photoUrls = Array.isArray(
            review.photoUrls
          )
            ? review.photoUrls.filter(
                (url) =>
                  typeof url === "string" &&
                  url.trim() !== ""
              )
            : [];

          return {
            id: String(review._id),

            restaurantName:
              review.restaurantId?.name ||
              "Restaurant",

            reviewType:
              review.reviewType,

            rating:
              review.rating,

            comment:
              review.comment || "",

            photoUrls,

            createdAt:
              review.createdAt,
          };
        })
        .filter(
          (review) =>
            review.photoUrls.length >= 1 &&
            review.photoUrls.length <= 5
        );

      return res.status(200).json({
        items,
      });
    } catch (error) {
      console.error(
        "Eligible reviews error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not load reviews with photos.",
      });
    }
  }
);

// =====================================================
// Public Post Images
// =====================================================

router.get(
  "/photos/:photoId",
  controller.getPostPhoto
);

// =====================================================
// Create Post
// =====================================================

router.post(
  "/",
  authenticate,
  controller.createPost
);

// =====================================================
// Like Post
// =====================================================

router.put(
  "/:id/like",
  authenticate,
  controller.likePost
);

// =====================================================
// Unlike Post
// =====================================================

router.delete(
  "/:id/like",
  authenticate,
  controller.unlikePost
);

// =====================================================
// Delete Post
// =====================================================

router.delete(
  "/:id",
  authenticate,
  controller.deletePost
);

// =====================================================
// Post Details
// =====================================================

router.get(
  "/:id",
  optionalAuth,
  controller.getPost
);

module.exports = router;