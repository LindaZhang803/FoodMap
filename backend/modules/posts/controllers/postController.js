const service = require("../services/postService");

// =====================================================
// Error Handler
// =====================================================

function handleError(error, res) {
  const status =
    Number.isInteger(error?.status) &&
    error.status >= 400 &&
    error.status < 600
      ? error.status
      : 500;

  if (status >= 500) {
    console.error("Posts API error:", error);
  }

  return res.status(status).json({
    message:
      status === 500
        ? "Internal server error."
        : error.message,
  });
}

// =====================================================
// Read Public Posts
// =====================================================

async function listPosts(req, res) {
  try {
    const result = await service.listPosts({
      category: req.query.category || "forYou",
      limit:
        req.query.limit == null
          ? 12
          : Number(req.query.limit),
      cursor: req.query.cursor,
      userId: req.user?.id || null,
      latitude: req.query.latitude,
      longitude: req.query.longitude,
    });

    return res.status(200).json(result);
  } catch (error) {
    return handleError(error, res);
  }
}

// =====================================================
// Read Post Details
// =====================================================

async function getPost(req, res) {
  try {
    const post = await service.getPost(
      req.params.id,
      req.user?.id || null
    );

    return res.status(200).json({
      post,
    });
  } catch (error) {
    return handleError(error, res);
  }
}

// =====================================================
// Create Post
// =====================================================

async function createPost(req, res) {
  try {
    const post = await service.createPost({
      userId: req.user.id,
      reviewId: req.body?.reviewId,
      title: req.body?.title,
      caption: req.body?.caption || "",
    });

    return res.status(201).json({
      post,
    });
  } catch (error) {
    return handleError(error, res);
  }
}

// =====================================================
// Post Image
// =====================================================

async function getPostPhoto(req, res) {
  try {
    const photo = await service.getPostPhoto(
      req.params.photoId
    );

    res.setHeader(
      "Content-Type",
      photo.contentType
    );

    res.setHeader(
      "X-Content-Type-Options",
      "nosniff"
    );

    res.setHeader(
      "Cache-Control",
      "no-store"
    );

    return res.send(photo.data);
  } catch (error) {
    return handleError(error, res);
  }
}

// =====================================================
// Like Post
// =====================================================

async function likePost(req, res) {
  try {
    const result = await service.setPostLike({
      postId: req.params.id,
      userId: req.user.id,
      liked: true,
    });

    return res.status(200).json(result);
  } catch (error) {
    return handleError(error, res);
  }
}

// =====================================================
// Unlike Post
// =====================================================

async function unlikePost(req, res) {
  try {
    const result = await service.setPostLike({
      postId: req.params.id,
      userId: req.user.id,
      liked: false,
    });

    return res.status(200).json(result);
  } catch (error) {
    return handleError(error, res);
  }
}

// =====================================================
// Delete Post
// =====================================================

async function deletePost(req, res) {
  try {
    await service.deletePost({
      postId: req.params.id,
      userId: req.user.id,
    });

    return res.sendStatus(204);
  } catch (error) {
    return handleError(error, res);
  }
}

module.exports = {
  listPosts,
  getPost,
  createPost,
  getPostPhoto,
  likePost,
  unlikePost,
  deletePost,
};
