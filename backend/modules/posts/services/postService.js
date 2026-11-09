const mongoose = require("mongoose");
const sharp = require("sharp");

const User = require("../../accounts/models/User");

const Restaurant = require(
  "../../restaurants/models/Restaurant"
);

const Post = require("../models/Post");
const PostLike = require("../models/PostLike");

// =====================================================
// Configuration
// =====================================================

const MAX_PAGE_SIZE = 30;
const DEFAULT_PAGE_SIZE = 12;

const PHOTO_PREFIX = "/api/posts/photos/";

const REVIEW_PHOTO_PATTERN =
  /^\/api\/review-photos\/([a-f0-9]{24})\/image$/i;

const ID_PATTERN = /^[a-f0-9]{24}$/i;

// =====================================================
// 1. Persistent Post Photo Model
// =====================================================

const postPhotoSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null,
      index: true,
    },

    data: {
      type: Buffer,
      required: true,
      select: false,
    },

    contentType: {
      type: String,
      enum: ["image/jpeg"],
      default: "image/jpeg",
    },
  },
  {
    timestamps: true,
    collection: "post_photos",
  }
);

const PostPhoto =
  mongoose.models.PostPhoto ||
  mongoose.model("PostPhoto", postPhotoSchema);

// =====================================================
// 2. Errors
// =====================================================

class PostError extends Error {
  constructor(status, message) {
    super(message);

    this.name = "PostError";
    this.status = status;
  }
}

// =====================================================
// 3. Validate ObjectId
// =====================================================

function requireId(value, label = "ID") {
  if (
    typeof value !== "string" ||
    !ID_PATTERN.test(value)
  ) {
    throw new PostError(
      400,
      `Invalid ${label}.`
    );
  }

  return value;
}

// =====================================================
// 4. Validate Text
// =====================================================

function requireText(
  value,
  label,
  maxLength
) {
  if (typeof value !== "string") {
    throw new PostError(
      400,
      `${label} is required.`
    );
  }

  const text = value.trim();

  if (
    !text ||
    text.length > maxLength
  ) {
    throw new PostError(
      400,
      `${label} must contain 1–${maxLength} characters.`
    );
  }

  return text;
}

// =====================================================
// 5. Convert MongoDB Binary Data to Buffer
// =====================================================

function toImageBuffer(data) {
  if (!data) {
    throw new PostError(
      400,
      "The selected review photo contains no image data."
    );
  }

  // Native Node.js Buffer.
  if (Buffer.isBuffer(data)) {
    return data;
  }

  // MongoDB BSON Binary.
  if (
    typeof data.value === "function"
  ) {
    try {
      const value = data.value(true);

      if (Buffer.isBuffer(value)) {
        return value;
      }

      if (value instanceof Uint8Array) {
        return Buffer.from(value);
      }
    } catch {
      // Continue checking other supported formats.
    }
  }

  // Uint8Array.
  if (data instanceof Uint8Array) {
    return Buffer.from(data);
  }

  // BSON Binary with underlying buffer.
  if (Buffer.isBuffer(data.buffer)) {
    return data.buffer;
  }

  if (
    data.buffer instanceof Uint8Array
  ) {
    return Buffer.from(data.buffer);
  }

  if (
    data.buffer instanceof ArrayBuffer
  ) {
    return Buffer.from(data.buffer);
  }

  // Raw ArrayBuffer.
  if (data instanceof ArrayBuffer) {
    return Buffer.from(data);
  }

  throw new PostError(
    400,
    "The selected review photo could not be read."
  );
}

// =====================================================
// 6. Pagination Cursor
// =====================================================

function readCursor(value) {
  if (!value) {
    return 0;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(
        String(value),
        "base64url"
      ).toString("utf8")
    );

    if (
      !Number.isSafeInteger(decoded.offset) ||
      decoded.offset < 0 ||
      decoded.offset > 1000000
    ) {
      throw new Error("Invalid cursor");
    }

    return decoded.offset;
  } catch {
    throw new PostError(
      400,
      "Invalid pagination cursor."
    );
  }
}

function makeCursor(offset) {
  return Buffer.from(
    JSON.stringify({
      offset,
    }),
    "utf8"
  ).toString("base64url");
}

// =====================================================
// 7. Geographic Distance
// =====================================================

function distanceExpression(
  latitude,
  longitude
) {
  const latitude1 = {
    $degreesToRadians: latitude,
  };

  const latitude2 = {
    $degreesToRadians:
      "$restaurant.latitude",
  };

  const longitudeDifference = {
    $degreesToRadians: {
      $subtract: [
        "$restaurant.longitude",
        longitude,
      ],
    },
  };

  const cosine = {
    $add: [
      {
        $multiply: [
          {
            $sin: latitude1,
          },
          {
            $sin: latitude2,
          },
        ],
      },

      {
        $multiply: [
          {
            $cos: latitude1,
          },
          {
            $cos: latitude2,
          },
          {
            $cos: longitudeDifference,
          },
        ],
      },
    ],
  };

  return {
    $multiply: [
      6371,

      {
        $acos: {
          $max: [
            -1,

            {
              $min: [
                1,
                cosine,
              ],
            },
          ],
        },
      },
    ],
  };
}

// =====================================================
// 8. Normalize Post
// =====================================================

function normalizePost(
  record,
  liked = false
) {
  const author =
    record.author ||
    record.authorId;

  const restaurant =
    record.restaurant ||
    record.restaurantId;

  return {
    id: String(record._id),

    title: record.title,

    caption:
      record.caption || "",

    imageUrls:
      record.imageUrls || [],

    coverImageUrl:
      record.imageUrls?.[0] || null,

    coverAspectRatio:
      Number(record.coverAspectRatio) || 1,

    author: {
      id: author?._id
        ? String(author._id)
        : null,

      username:
        author?.username ||
        "FoodMap User",

      avatarUrl:
        author?.profileImage || null,
    },

    restaurant: {
      id: restaurant?._id
        ? String(restaurant._id)
        : null,

      name:
        restaurant?.name ||
        "Restaurant",

      cuisineType:
        restaurant?.cuisineType ||
        "Unknown",

      latitude:
        restaurant?.latitude ?? null,

      longitude:
        restaurant?.longitude ?? null,
    },

    reviewId:
      String(record.reviewId),

    likeCount:
      Number(record.likeCount) || 0,

    likedByMe:
      Boolean(liked),

    // Fix: missing distance must remain null.
    distanceKm:
      record.distanceKm != null &&
      Number.isFinite(
        Number(record.distanceKm)
      )
        ? Number(record.distanceKm)
        : null,

    createdAt:
      record.createdAt,

    updatedAt:
      record.updatedAt,
  };
}

// =====================================================
// 9. Read User Likes
// =====================================================

async function getLikedIds(
  posts,
  userId
) {
  if (
    !userId ||
    posts.length === 0
  ) {
    return new Set();
  }

  const likes = await PostLike.find({
    userId,

    postId: {
      $in: posts.map(
        (post) => post._id
      ),
    },
  })
    .select("postId")
    .lean();

  return new Set(
    likes.map(
      (like) =>
        String(like.postId)
    )
  );
}

// =====================================================
// 10. List Public Posts
// =====================================================

async function listPosts({
  category = "forYou",
  limit = DEFAULT_PAGE_SIZE,
  cursor,
  userId = null,
  latitude,
  longitude,
} = {}) {
  if (
    ![
      "forYou",
      "nearby",
      "trending",
    ].includes(category)
  ) {
    throw new PostError(
      400,
      "Invalid feed category."
    );
  }

  const pageSize = Number(limit);

  if (
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > MAX_PAGE_SIZE
  ) {
    throw new PostError(
      400,
      `Limit must be between 1 and ${MAX_PAGE_SIZE}.`
    );
  }

  const offset = readCursor(cursor);

  let lat = null;
  let lon = null;

  // ===================================================
  // Nearby Location Validation
  // ===================================================

  if (category === "nearby") {
    lat = Number(latitude);
    lon = Number(longitude);

    if (
      latitude == null ||
      longitude == null ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      throw new PostError(
        400,
        "Valid latitude and longitude are required for Nearby."
      );
    }
  }

  // ===================================================
  // User Cuisine Preferences
  // ===================================================

  let cuisines = [];

  if (
    category === "forYou" &&
    userId
  ) {
    const user = await User.findById(
      userId
    )
      .select("favoriteCuisines")
      .lean();

    cuisines =
      Array.isArray(
        user?.favoriteCuisines
      )
        ? user.favoriteCuisines
            .filter(
              (value) =>
                typeof value === "string"
            )
            .map(
              (value) =>
                value.trim().toLowerCase()
            )
            .filter(Boolean)
        : [];
  }

  // ===================================================
  // Aggregation
  // ===================================================

  const pipeline = [
    {
      $match: {
        status: "published",
      },
    },

    {
      $lookup: {
        from: User.collection.name,
        localField: "authorId",
        foreignField: "_id",
        as: "author",
      },
    },

    {
      $unwind: "$author",
    },

    {
      $lookup: {
        from: Restaurant.collection.name,
        localField: "restaurantId",
        foreignField: "_id",
        as: "restaurant",
      },
    },

    {
      $unwind: "$restaurant",
    },
  ];

  // ===================================================
  // For You
  // ===================================================

  if (category === "forYou") {
    pipeline.push({
      $addFields: {
        preferenceMatch: {
          $cond: [
            {
              $in: [
                {
                  $toLower: {
                    $ifNull: [
                      "$restaurant.cuisineType",
                      "",
                    ],
                  },
                },

                cuisines,
              ],
            },
            1,
            0,
          ],
        },
      },
    });

    pipeline.push({
      $sort: {
        preferenceMatch: -1,
        createdAt: -1,
        _id: -1,
      },
    });
  }

  // ===================================================
  // Trending
  // ===================================================

  if (category === "trending") {
    pipeline.push({
      $sort: {
        likeCount: -1,
        createdAt: -1,
        _id: -1,
      },
    });
  }

  // ===================================================
  // Nearby
  // ===================================================

  if (category === "nearby") {
    pipeline.push({
      $addFields: {
        distanceKm:
          distanceExpression(
            lat,
            lon
          ),
      },
    });

    pipeline.push({
      $sort: {
        distanceKm: 1,
        createdAt: -1,
        _id: -1,
      },
    });
  }

  // ===================================================
  // Pagination
  // ===================================================

  pipeline.push(
    {
      $skip: offset,
    },

    {
      $limit: pageSize + 1,
    }
  );

  const rows = await Post.aggregate(
    pipeline
  );

  const hasMore =
    rows.length > pageSize;

  const page = rows.slice(
    0,
    pageSize
  );

  const likedIds =
    await getLikedIds(
      page,
      userId
    );

  return {
    items: page.map(
      (post) =>
        normalizePost(
          post,
          likedIds.has(
            String(post._id)
          )
        )
    ),

    nextCursor: hasMore
      ? makeCursor(
          offset + pageSize
        )
      : null,

    hasMore,
  };
}

// =====================================================
// 11. Get Post Details
// =====================================================

async function getPost(
  id,
  userId = null
) {
  requireId(
    id,
    "post ID"
  );

  const post = await Post.findOne({
    _id: id,
    status: "published",
  })
    .populate(
      "authorId",
      "username profileImage"
    )
    .populate(
      "restaurantId",
      "name cuisineType latitude longitude"
    )
    .lean();

  if (!post) {
    throw new PostError(
      404,
      "Post not found."
    );
  }

  const likedIds =
    await getLikedIds(
      [post],
      userId
    );

  return normalizePost(
    post,
    likedIds.has(
      String(post._id)
    )
  );
}

// =====================================================
// 12. Create Post from Existing Review
// =====================================================

async function createPost({
  userId,
  reviewId,
  title,
  caption = "",
}) {
  requireId(
    userId,
    "user ID"
  );

  requireId(
    reviewId,
    "review ID"
  );

  const safeTitle =
    requireText(
      title,
      "Title",
      120
    );

  if (
    typeof caption !== "string" ||
    caption.length > 2000
  ) {
    throw new PostError(
      400,
      "Caption must be 2000 characters or fewer."
    );
  }

  // ===================================================
  // Load Existing Review Models
  // ===================================================

  const Review =
    mongoose.models.Review;

  const ReviewPhoto =
    mongoose.models.ReviewPhoto;

  if (
    !Review ||
    !ReviewPhoto
  ) {
    throw new PostError(
      503,
      "The Reviews module is not initialized."
    );
  }

  // ===================================================
  // Verify Review Ownership
  // ===================================================

  const review = await Review.findOne({
    _id: reviewId,
    userId,
  }).lean();

  if (!review) {
    throw new PostError(
      404,
      "Your published review was not found."
    );
  }

  // ===================================================
  // Prevent Duplicate Posts
  // ===================================================

  const existing =
    await Post.exists({
      reviewId,
    });

  if (existing) {
    throw new PostError(
      409,
      "A post already exists for this review."
    );
  }

  // ===================================================
  // Read Review Photo URLs
  // ===================================================

  const urls =
    Array.isArray(review.photoUrls)
      ? review.photoUrls
      : [];

  if (
    urls.length < 1 ||
    urls.length > 5
  ) {
    throw new PostError(
      400,
      "The review must contain 1–5 photos."
    );
  }

  const photoIds = urls.map(
    (url) => {
      const match =
        typeof url === "string"
          ? REVIEW_PHOTO_PATTERN.exec(
              url
            )
          : null;

      if (!match) {
        throw new PostError(
          400,
          "This review contains an unsupported photo URL."
        );
      }

      return match[1];
    }
  );

  // ===================================================
  // Read Source Photos
  // ===================================================

  // Photo ownership is mandatory.
  //
  // Some existing reviews may have photos whose
  // reviewId was never written after upload.
  //
  // We therefore verify:
  // 1. The review belongs to this user.
  // 2. The photo belongs to this user.
  // 3. The photo URL is referenced by this review.
  // 4. If photo.reviewId is present, it must match.

  const sourcePhotos =
    await ReviewPhoto.find({
      _id: {
        $in: photoIds,
      },

      userId,
    })
      .select("+data")
      .lean();

  const sourceMap = new Map(
    sourcePhotos.map(
      (photo) => [
        String(photo._id),
        photo,
      ]
    )
  );

  // ===================================================
  // Persistent Photo Copy
  // ===================================================

  const copied = [];

  let post = null;

  try {
    let coverAspectRatio = 1;

    const now = new Date();

    for (
      const [index, photoId]
      of photoIds.entries()
    ) {
      const source =
        sourceMap.get(photoId);

      if (!source) {
        throw new PostError(
          400,
          "A review photo was not found or does not belong to your account."
        );
      }

      // Reject a photo explicitly bound to
      // another review.
      if (
        source.reviewId &&
        String(source.reviewId) !==
          String(review._id)
      ) {
        throw new PostError(
          400,
          "A photo belongs to another review."
        );
      }

      // Do not publish expired temporary photos.
      if (
        source.expiresAt &&
        new Date(source.expiresAt) <= now
      ) {
        throw new PostError(
          400,
          "A review photo has expired. Please upload a new photo."
        );
      }

      // -----------------------------------------------
      // Convert BSON / Mongoose Binary to Buffer
      // -----------------------------------------------

      const imageBuffer =
        toImageBuffer(
          source.data
        );

      if (
        imageBuffer.length === 0
      ) {
        throw new PostError(
          400,
          "A review photo is empty."
        );
      }

      // -----------------------------------------------
      // Validate Image with Sharp
      // -----------------------------------------------

      let metadata;

      try {
        metadata =
          await sharp(
            imageBuffer,
            {
              limitInputPixels:
                25000000,
            }
          ).metadata();
      } catch (error) {
        console.error(
          "[Post Photo Decode Failed]",
          error.message
        );

        throw new PostError(
          400,
          "The selected review contains an invalid photo."
        );
      }

      if (
        metadata.format !== "jpeg"
      ) {
        throw new PostError(
          400,
          "The review photo must be a JPEG image."
        );
      }

      // -----------------------------------------------
      // Cover Aspect Ratio
      // -----------------------------------------------

      if (index === 0) {
        const ratio =
          metadata.width &&
          metadata.height
            ? metadata.width /
              metadata.height
            : 1;

        coverAspectRatio =
          Math.max(
            0.5,
            Math.min(
              2,
              ratio
            )
          );
      }

      // -----------------------------------------------
      // Create Persistent Photo
      // -----------------------------------------------

      const photo =
        await PostPhoto.create({
          data: imageBuffer,

          contentType:
            "image/jpeg",
        });

      copied.push(photo);
    }

    // =================================================
    // Build Persistent Image URLs
    // =================================================

    const persistentUrls =
      copied.map(
        (photo) =>
          `${PHOTO_PREFIX}${photo._id}`
      );

    // =================================================
    // Create Published Post
    // =================================================

    post = await Post.create({
      authorId: userId,

      restaurantId:
        review.restaurantId,

      reviewId,

      title: safeTitle,

      caption:
        caption.trim(),

      imageUrls:
        persistentUrls,

      coverAspectRatio,

      status: "published",
    });

    // =================================================
    // Link Permanent Photos to Post
    // =================================================

    await PostPhoto.updateMany(
      {
        _id: {
          $in: copied.map(
            (photo) => photo._id
          ),
        },
      },

      {
        $set: {
          postId: post._id,
        },
      }
    );

    // =================================================
    // Return Created Post
    // =================================================

    return await getPost(
      String(post._id),
      userId
    );
  } catch (error) {
    // =================================================
    // Debug Real Server Error
    // =================================================

    console.error(
      "[Post Creation Failed]",
      error
    );

    // =================================================
    // Roll Back Post
    // =================================================

    if (post) {
      try {
        await Post.deleteOne({
          _id: post._id,
        });
      } catch (cleanupError) {
        console.error(
          "[Post Cleanup Failed]",
          cleanupError
        );
      }
    }

    // =================================================
    // Roll Back Persistent Photos
    // =================================================

    if (
      copied.length > 0
    ) {
      try {
        await PostPhoto.deleteMany({
          _id: {
            $in: copied.map(
              (photo) =>
                photo._id
            ),
          },
        });
      } catch (cleanupError) {
        console.error(
          "[Post Photo Cleanup Failed]",
          cleanupError
        );
      }
    }

    // =================================================
    // Duplicate Post
    // =================================================

    if (
      error.code === 11000
    ) {
      throw new PostError(
        409,
        "A post already exists for this review."
      );
    }

    throw error;
  }
}

// =====================================================
// 13. Get Persistent Post Photo
// =====================================================

async function getPostPhoto(id) {
  requireId(
    id,
    "photo ID"
  );

  const photo =
    await PostPhoto.findById(id)
      .select("+data")
      .lean();

  if (
    !photo ||
    !photo.postId ||
    !photo.data
  ) {
    throw new PostError(
      404,
      "Photo not found."
    );
  }

  // ===================================================
  // Verify Public Post
  // ===================================================

  const published =
    await Post.exists({
      _id: photo.postId,

      status: "published",

      imageUrls:
        `${PHOTO_PREFIX}${id}`,
    });

  if (!published) {
    throw new PostError(
      404,
      "Photo not found."
    );
  }

  // ===================================================
  // Convert Binary to Buffer
  // ===================================================

  const imageBuffer =
    toImageBuffer(
      photo.data
    );

  return {
    data: imageBuffer,
    contentType: "image/jpeg",
  };
}

// =====================================================
// 14. Like / Unlike Post
// =====================================================

async function setPostLike({
  postId,
  userId,
  liked,
}) {
  requireId(
    postId,
    "post ID"
  );

  requireId(
    userId,
    "user ID"
  );

  if (
    typeof liked !== "boolean"
  ) {
    throw new PostError(
      400,
      "Invalid like operation."
    );
  }

  // ===================================================
  // Confirm Post Exists
  // ===================================================

  const post =
    await Post.findOne({
      _id: postId,
      status: "published",
    });

  if (!post) {
    throw new PostError(
      404,
      "Post not found."
    );
  }

  // ===================================================
  // Like
  // ===================================================

  if (liked) {
    try {
      await PostLike.create({
        postId,
        userId,
      });
    } catch (error) {
      if (
        error.code !== 11000
      ) {
        throw error;
      }
    }
  } else {
    // =================================================
    // Unlike
    // =================================================

    await PostLike.deleteOne({
      postId,
      userId,
    });
  }

  // ===================================================
  // Recalculate Like Count
  // ===================================================

  const count =
    await PostLike.countDocuments({
      postId,
    });

  await Post.updateOne(
    {
      _id: postId,
      status: "published",
    },

    {
      $set: {
        likeCount: count,
      },
    }
  );

  // ===================================================
  // Current User Like Status
  // ===================================================

  const currentLike =
    await PostLike.exists({
      postId,
      userId,
    });

  return {
    postId,

    likedByMe:
      Boolean(currentLike),

    likeCount:
      count,
  };
}

// =====================================================
// 15. Delete Own Post
// =====================================================

async function deletePost({
  postId,
  userId,
}) {
  requireId(
    postId,
    "post ID"
  );

  requireId(
    userId,
    "user ID"
  );

  // ===================================================
  // Verify Ownership
  // ===================================================

  const post =
    await Post.findOne({
      _id: postId,
      authorId: userId,
    });

  if (!post) {
    throw new PostError(
      404,
      "Post not found or not owned by you."
    );
  }

  // ===================================================
  // Delete Post
  // ===================================================

  await Post.deleteOne({
    _id: postId,
    authorId: userId,
  });

  // ===================================================
  // Delete Related Likes and Photos
  // ===================================================

  await Promise.all([
    PostLike.deleteMany({
      postId,
    }),

    PostPhoto.deleteMany({
      postId,
    }),
  ]);

  return {
    deleted: true,
  };
}

// =====================================================
// 16. Exports
// =====================================================

module.exports = {
  PostError,

  listPosts,

  getPost,

  createPost,

  getPostPhoto,

  setPostLike,

  deletePost,
};