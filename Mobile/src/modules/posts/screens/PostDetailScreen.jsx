import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  StyleSheet,
} from "react-native";

import {
  getPost,
  setPostLike,
  deletePost,
  resolvePostImageUrl,
} from "../services/postApi";

import AppIcon from "../../../shared/components/AppIcon";

import {
  AppButton,
  LoadingState,
  ErrorState,
} from "../../../shared/design/UIComponents";

import {
  colors,
  spacing,
  radius,
  typography,
} from "../../../shared/design/tokens";

// =====================================================
// Helpers
// =====================================================

function getId(value) {
  if (typeof value === "string") {
    return value;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  return value.id ?? value._id ?? value.dishId ?? null;
}

function getDisplayName(value, fallback) {
  if (typeof value === "string") {
    return value;
  }

  if (!value || typeof value !== "object") {
    return fallback;
  }

  return value.name ?? value.title ?? fallback;
}

function formatRating(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "Not rated";
  }

  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return "Not rated";
  }

  return numeric.toFixed(1);
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString();
}

function getReview(post) {
  if (
    post?.review &&
    typeof post.review === "object"
  ) {
    return post.review;
  }

  return {};
}

function getRestaurant(post) {
  return post?.restaurant ?? null;
}

function getDish(post) {
  const review = getReview(post);

  return (
    post?.dish ??
    review?.dish ??
    null
  );
}

// =====================================================
// Review Content
// =====================================================

// The original review and the post caption
// are different pieces of content.

function getReviewContent(post) {
  const review = getReview(post);

  return (
    review.comment ??
    review.content ??
    review.text ??
    post?.reviewContent ??
    ""
  );
}

// =====================================================
// Ratings
// =====================================================

function getOverallRating(post) {
  const review = getReview(post);

  return (
    review.rating ??
    review.overallRating ??
    post?.overallRating ??
    null
  );
}

function getSpicinessRating(post) {
  const review = getReview(post);

  return (
    review.spicinessRating ??
    review.spicyRating ??
    review.spiciness ??
    post?.spicinessRating ??
    null
  );
}

// =====================================================
// Comments
// =====================================================

function getComments(post) {
  if (Array.isArray(post?.comments)) {
    return post.comments;
  }

  return [];
}

function getCommentCount(post) {
  if (
    Number.isInteger(post?.commentCount) &&
    post.commentCount >= 0
  ) {
    return post.commentCount;
  }

  return getComments(post).length;
}

// =====================================================
// Favorites
// =====================================================

function getFavoriteCount(post) {
  const count =
    post?.favoriteCount ??
    post?.saveCount ??
    0;

  return Number.isInteger(count) && count >= 0
    ? count
    : 0;
}

function getFavoriteState(post) {
  return Boolean(
    post?.favoritedByMe ??
    post?.savedByMe ??
    false
  );
}

// =====================================================
// Approved Images
// =====================================================

// Frontend filtering is retained.
//
// IMPORTANT:
// Public access to photos must also be controlled
// by the backend.
//
// String URLs are trusted only because the backend
// is expected to return public, approved images.

function getApprovedImages(post) {
  const raw = Array.isArray(post?.images)
    ? post.images
    : Array.isArray(post?.imageUrls)
      ? post.imageUrls
      : [];

  return raw
    .filter((image) => {
      if (typeof image === "string") {
        return true;
      }

      if (!image || typeof image !== "object") {
        return false;
      }

      const status =
        image.status ??
        image.moderationStatus ??
        image.reviewStatus;

      if (status == null) {
        return true;
      }

      return [
        "approved",
        "accepted",
        "published",
      ].includes(
        String(status).toLowerCase()
      );
    })
    .map((image) => {
      if (typeof image === "string") {
        return image;
      }

      return (
        image.url ??
        image.imageUrl ??
        image.photoUrl ??
        null
      );
    })
    .filter(Boolean);
}

// =====================================================
// Post Detail Screen
// =====================================================

export default function PostDetailScreen({
  postId,

  token = null,
  currentUserId = null,

  onBack,
  onRestaurantPress,
  onDishPress,
  onLoginRequired,
  onDeleted,

  // Optional backend integrations.
  onToggleFavorite,
  onSubmitComment,
  onLoadComments,
}) {
  // =====================================================
  // State
  // =====================================================

  const [post, setPost] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(null);

  const [retry, setRetry] =
    useState(0);

  const [liking, setLiking] =
    useState(false);

  const [deleting, setDeleting] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [commenting, setCommenting] =
    useState(false);

  const [commentText, setCommentText] =
    useState("");

  const [comments, setComments] =
    useState([]);

  const [commentsError, setCommentsError] =
    useState(null);

  const [failedImages, setFailedImages] =
    useState({});

  const [avatarFailed, setAvatarFailed] =
    useState(false);

  // =====================================================
  // Load Post
  // =====================================================

  useEffect(() => {
    let active = true;

    const controller =
      new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      setPost(null);

      setFailedImages({});
      setAvatarFailed(false);

      setComments([]);
      setCommentsError(null);

      try {
        const result = await getPost(
          postId,
          {
            token,
            signal: controller.signal,
          }
        );

        if (!active) {
          return;
        }

        setPost(result);
        setComments(getComments(result));

        // Load comments when a real reader is connected.

        if (
          typeof onLoadComments === "function"
        ) {
          try {
            const loadedComments =
              await onLoadComments(
                result.id,
                {
                  token,
                  signal: controller.signal,
                }
              );

            if (!active) {
              return;
            }

            if (Array.isArray(loadedComments)) {
              setComments(loadedComments);
            } else if (
              loadedComments &&
              Array.isArray(loadedComments.items)
            ) {
              setComments(loadedComments.items);

              setPost((current) =>
                current
                  ? {
                      ...current,
                      commentCount: loadedComments.commentCount,
                      favoriteCount: loadedComments.favoriteCount,
                      savedByMe: loadedComments.savedByMe,
                      favoritedByMe: loadedComments.savedByMe,
                    }
                  : current
              );
            }
          } catch (commentError) {
            if (
              active &&
              commentError?.name !== "AbortError"
            ) {
              setCommentsError(
                "Comments could not be loaded."
              );
            }
          }
        }
      } catch (err) {
        if (
          active &&
          err?.name !== "AbortError"
        ) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load post."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    if (postId) {
      load();
    } else {
      setLoading(false);
      setError("Post ID is missing.");
    }

    return () => {
      active = false;
      controller.abort();
    };
  }, [
    postId,
    token,
    retry,
    onLoadComments,
  ]);

  // =====================================================
  // Authentication
  // =====================================================

  const requireLogin = useCallback(
    (message) => {
      if (
        typeof onLoginRequired === "function"
      ) {
        onLoginRequired();
      } else {
        Alert.alert(
          "Sign-in required",
          message
        );
      }
    },
    [onLoginRequired]
  );

  // =====================================================
  // Like / Unlike
  // =====================================================

  async function handleLike() {
    if (!post || liking) {
      return;
    }

    if (!token) {
      requireLogin(
        "Sign in to like posts."
      );
      return;
    }

    setLiking(true);

    try {
      const result = await setPostLike(
        post.id,
        !post.likedByMe,
        token
      );

      setPost((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,

          likedByMe:
            result.likedByMe,

          likeCount:
            result.likeCount,
        };
      });
    } catch (err) {
      Alert.alert(
        "Unable to update like",
        err instanceof Error
          ? err.message
          : "Please try again."
      );
    } finally {
      setLiking(false);
    }
  }

  // =====================================================
  // Favorite / Unfavorite
  // =====================================================

  async function handleFavorite() {
    if (!post || saving) {
      return;
    }

    if (!token) {
      requireLogin(
        "Sign in to save posts."
      );
      return;
    }

    if (
      typeof onToggleFavorite !== "function"
    ) {
      Alert.alert(
        "Favorites unavailable",
        "Post favorites are not connected to the server yet."
      );
      return;
    }

    setSaving(true);

    try {
      const nextSavedState =
        !getFavoriteState(post);

      const result =
        await onToggleFavorite({
          postId: post.id,
          saved: nextSavedState,
          token,
        });

      if (
        !result ||
        typeof result !== "object" ||
        typeof result.saved !== "boolean"
      ) {
        throw new Error(
          "Invalid favorite response."
        );
      }

      setPost((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,

          savedByMe:
            result.saved,

          favoritedByMe:
            result.saved,

          favoriteCount:
            Number.isInteger(
              result.favoriteCount
            )
              ? result.favoriteCount
              : getFavoriteCount(current),
        };
      });
    } catch (err) {
      Alert.alert(
        "Unable to update favorite",
        err instanceof Error
          ? err.message
          : "Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  // =====================================================
  // Submit Comment
  // =====================================================

  async function handleSubmitComment() {
    const content =
      commentText.trim();

    if (
      !post ||
      commenting ||
      !content
    ) {
      return;
    }

    if (!token) {
      requireLogin(
        "Sign in to comment."
      );
      return;
    }

    if (
      typeof onSubmitComment !== "function"
    ) {
      Alert.alert(
        "Comments unavailable",
        "Comment publishing is not connected to the server yet."
      );
      return;
    }

    setCommenting(true);

    try {
      const result =
        await onSubmitComment({
          postId: post.id,
          content,
          token,
        });

      if (
        !result ||
        typeof result !== "object"
      ) {
        throw new Error(
          "Invalid comment response."
        );
      }

      setComments((current) => [
        ...current,
        result,
      ]);

      setPost((current) =>
        current
          ? {
              ...current,

              commentCount:
                getCommentCount(current) + 1,
            }
          : current
      );

      setCommentText("");
    } catch (err) {
      Alert.alert(
        "Unable to post comment",
        err instanceof Error
          ? err.message
          : "Please try again."
      );
    } finally {
      setCommenting(false);
    }
  }

  // =====================================================
  // Delete Post
  // =====================================================

  function confirmDelete() {
    if (!post || deleting) {
      return;
    }

    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this post?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: handleDelete,
        },
      ]
    );
  }

  async function handleDelete() {
    if (
      !post ||
      deleting ||
      !token
    ) {
      return;
    }

    setDeleting(true);

    try {
      await deletePost(
        post.id,
        token
      );

      if (
        typeof onDeleted === "function"
      ) {
        onDeleted(post.id);
      } else {
        onBack?.();
      }
    } catch (err) {
      Alert.alert(
        "Unable to delete post",
        err instanceof Error
          ? err.message
          : "Please try again."
      );
    } finally {
      setDeleting(false);
    }
  }

  // =====================================================
  // Restaurant Navigation
  // =====================================================

  function handleRestaurantPress() {
    const restaurantId =
      getId(post?.restaurant);

    if (
      !restaurantId ||
      typeof onRestaurantPress !== "function"
    ) {
      return;
    }

    onRestaurantPress(
      restaurantId
    );
  }

  // =====================================================
  // Dish Navigation
  // =====================================================

  function handleDishPress() {
    const restaurantId =
      getId(post?.restaurant);

    const dishId =
      getId(post?.dish) ??
      getId(post?.review?.dishId);

    if (
      !dishId ||
      !restaurantId
    ) {
      return;
    }

    if (
      typeof onDishPress === "function"
    ) {
      onDishPress(
        dishId,
        restaurantId
      );
    }
  }

  // =====================================================
  // Derived Data
  // =====================================================

  const review = useMemo(
    () => getReview(post),
    [post]
  );

  const restaurant = useMemo(
    () => getRestaurant(post),
    [post]
  );

  const dish = useMemo(
    () => getDish(post),
    [post]
  );

  const images = useMemo(
    () => getApprovedImages(post),
    [post]
  );

  const username =
    post?.author?.username ||
    "FoodMap User";

  const avatarUrl =
    resolvePostImageUrl(
      post?.author?.avatarUrl
    );

  const isOwner =
    Boolean(currentUserId) &&
    getId(post?.author) ===
      currentUserId;

  const restaurantId =
    getId(restaurant);

  const dishId =
    getId(dish) ??
    getId(review?.dishId);

  const restaurantName =
    getDisplayName(
      restaurant,
      "Restaurant unavailable"
    );

  const dishName =
    getDisplayName(
      dish,
      review?.dishName ??
        post?.dishName ??
        "Dish unavailable"
    );

  // Only show the Dish section when
  // a real dish relationship exists.

  const hasDish =
    review?.reviewType === "dish" ||
    Boolean(dishId);

  const overallRating =
    getOverallRating(post);

  const spicinessRating =
    getSpicinessRating(post);

  const reviewContent =
    getReviewContent(post);

  // Post caption remains separate
  // from the original review content.

  const postCaption =
    typeof post?.caption === "string"
      ? post.caption.trim()
      : "";

  const favoriteCount =
    getFavoriteCount(post);

  const isFavorited =
    getFavoriteState(post);

  const displayedCommentCount =
    Math.max(
      getCommentCount(post),
      comments.length
    );

  // =====================================================
  // Header
  // =====================================================

  const header = (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to posts"
        onPress={onBack}
        style={styles.backButton}
      >
        <AppIcon
          name="back"
          size={24}
          color={colors.primary}
        />
      </Pressable>

      <Text style={styles.headerTitle}>
        Post Detail
      </Text>

      <View style={styles.headerSpacer} />
    </View>
  );

  // =====================================================
  // Loading
  // =====================================================

  if (loading) {
    return (
      <View style={styles.screen}>
        {header}

        <LoadingState
          message="Loading post..."
        />
      </View>
    );
  }

  // =====================================================
  // Error
  // =====================================================

  if (error || !post) {
    return (
      <View style={styles.screen}>
        {header}

        <ErrorState
          title="Post Unavailable"
          message={
            error ||
            "This post is unavailable."
          }
          onRetry={() =>
            setRetry(
              (value) => value + 1
            )
          }
        />
      </View>
    );
  }

  // =====================================================
  // Render
  // =====================================================

  return (
    <View style={styles.screen}>
      {header}

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        {/* ============================================
            Post Images
        ============================================ */}

        <View style={styles.photos}>
          {images.length > 0 ? (
            images.map((imageUrl, index) => {
              const url =
                resolvePostImageUrl(
                  imageUrl
                );

              const failed =
                failedImages[index];

              return (
                <View
                  key={`${imageUrl}-${index}`}
                  style={styles.photoContainer}
                >
                  {url && !failed ? (
                    <Image
                      accessibilityLabel={
                        `Post image ${index + 1}`
                      }
                      source={{ uri: url }}
                      style={styles.photo}
                      resizeMode="cover"
                      onError={() =>
                        setFailedImages(
                          (current) => ({
                            ...current,
                            [index]: true,
                          })
                        )
                      }
                    />
                  ) : (
                    <View
                      style={styles.photoFallback}
                    >
                      <AppIcon
                        name="image"
                        size={36}
                        color={colors.textMuted}
                      />

                      <Text style={styles.muted}>
                        Photo unavailable
                      </Text>
                    </View>
                  )}
                </View>
              );
            })
          ) : (
            <View style={styles.photoFallback}>
              <AppIcon
                name="image"
                size={36}
                color={colors.textMuted}
              />

              <Text style={styles.muted}>
                No photos available
              </Text>
            </View>
          )}
        </View>

        {/* ============================================
            Author
        ============================================ */}

        <View style={styles.authorSection}>
          <View style={styles.avatar}>
            {avatarUrl && !avatarFailed ? (
              <Image
                source={{ uri: avatarUrl }}
                style={styles.avatarImage}
                onError={() =>
                  setAvatarFailed(true)
                }
              />
            ) : (
              <Text
                style={styles.avatarInitial}
              >
                {username
                  .charAt(0)
                  .toUpperCase()}
              </Text>
            )}
          </View>

          <View style={styles.authorInfo}>
            <Text style={styles.username}>
              {username}
            </Text>

            <Text style={styles.date}>
              {formatDate(
                post.createdAt
              )}
            </Text>
          </View>
        </View>

        {/* ============================================
            Post Title and Caption
        ============================================ */}

        <View style={styles.section}>
          <Text style={styles.title}>
            {post.title}
          </Text>

          {Boolean(postCaption) && (
            <Text style={styles.caption}>
              {postCaption}
            </Text>
          )}
        </View>

        {/* ============================================
            Restaurant
        ============================================ */}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Restaurant
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              `Open restaurant ${restaurantName}`
            }
            disabled={
              !restaurantId ||
              typeof onRestaurantPress !== "function"
            }
            onPress={
              handleRestaurantPress
            }
            style={styles.linkCard}
          >
            <View style={styles.linkContent}>
              <AppIcon
                name="restaurant"
                size={23}
                color={colors.primary}
              />

              <View style={styles.linkText}>
                <Text style={styles.linkTitle}>
                  {restaurantName}
                </Text>

                {Boolean(
                  restaurant?.cuisineType
                ) && (
                  <Text
                    style={styles.linkSubtitle}
                  >
                    {restaurant.cuisineType}
                  </Text>
                )}
              </View>
            </View>

            <AppIcon
              name="chevronForward"
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        </View>

        {/* ============================================
            Dish

            Only displayed when the post
            is associated with a dish.
        ============================================ */}

        {hasDish && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Dish
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                `Open dish ${dishName}`
              }
              disabled={
                !dishId ||
                !restaurantId ||
                typeof onDishPress !== "function"
              }
              onPress={
                handleDishPress
              }
              style={styles.linkCard}
            >
              <View style={styles.linkContent}>
                <AppIcon
                  name="restaurant"
                  size={23}
                  color={colors.primary}
                />

                <View style={styles.linkText}>
                  <Text style={styles.linkTitle}>
                    {dishName}
                  </Text>
                </View>
              </View>

              <AppIcon
                name="chevronForward"
                size={20}
                color={colors.textMuted}
              />
            </Pressable>
          </View>
        )}

        {/* ============================================
            Ratings
        ============================================ */}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Ratings
          </Text>

          <View style={styles.ratingRow}>
            <View style={styles.ratingCard}>
              <Text style={styles.ratingLabel}>
                Overall Rating
              </Text>

              <View style={styles.ratingValueRow}>
                <AppIcon
                  name="starFilled"
                  size={19}
                  color={colors.primary}
                />

                <Text style={styles.ratingValue}>
                  {formatRating(
                    overallRating
                  )}
                </Text>
              </View>
            </View>

            <View style={styles.ratingCard}>
              <Text style={styles.ratingLabel}>
                Spiciness Rating
              </Text>

              <Text style={styles.ratingValue}>
                {formatRating(
                  spicinessRating
                )}
              </Text>
            </View>
          </View>
        </View>

        {/* ============================================
            Original Review Content
        ============================================ */}

        {Boolean(reviewContent) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Original Review
            </Text>

            <Text style={styles.caption}>
              {reviewContent}
            </Text>
          </View>
        )}

        {/* ============================================
            Likes and Favorites
        ============================================ */}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Engagement
          </Text>

          <View style={styles.actionRow}>
            {/* Like */}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                post.likedByMe
                  ? "Unlike post"
                  : "Like post"
              }
              accessibilityState={{
                disabled: liking,
                selected: Boolean(
                  post.likedByMe
                ),
              }}
              disabled={liking}
              onPress={handleLike}
              style={styles.actionButton}
            >
              <AppIcon
                name={
                  post.likedByMe
                    ? "favoriteFilled"
                    : "favorite"
                }
                size={22}
                color={colors.primary}
              />

              <Text style={styles.actionText}>
                {post.likeCount ?? 0} Likes
              </Text>
            </Pressable>

            {/* Favorite */}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                isFavorited
                  ? "Remove post from favorites"
                  : "Save post to favorites"
              }
              accessibilityState={{
                disabled: saving,
                selected: isFavorited,
              }}
              disabled={saving}
              onPress={handleFavorite}
              style={styles.actionButton}
            >
              <Text style={styles.favoriteSymbol}>
                {isFavorited ? "★" : "☆"}
              </Text>

              <Text style={styles.actionText}>
                {favoriteCount} Favorites
              </Text>
            </Pressable>
          </View>
        </View>

        {/* ============================================
            Comments
        ============================================ */}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Comments ({displayedCommentCount})
          </Text>

          {commentsError && (
            <Text style={styles.errorText}>
              {commentsError}
            </Text>
          )}

          {comments.length === 0 ? (
            <Text style={styles.emptyText}>
              No comments to display.
            </Text>
          ) : (
            comments.map((comment, index) => {
              const authorName =
                comment.author?.username ??
                comment.username ??
                "FoodMap User";

              const content =
                comment.content ??
                comment.text ??
                "";

              return (
                <View
                  key={
                    getId(comment) ??
                    `comment-${index}`
                  }
                  style={styles.commentCard}
                >
                  <Text
                    style={styles.commentAuthor}
                  >
                    {authorName}
                  </Text>

                  <Text
                    style={styles.commentContent}
                  >
                    {content}
                  </Text>

                  <Text
                    style={styles.commentDate}
                  >
                    {formatDate(
                      comment.createdAt
                    )}
                  </Text>
                </View>
              );
            })
          )}

          {/* ========================================
              Comment Input
          ======================================== */}

          <View style={styles.commentInputSection}>
            <TextInput
              accessibilityLabel="Write a comment"
              placeholder="Write a comment..."
              placeholderTextColor={
                colors.textMuted
              }
              multiline
              maxLength={1000}
              value={commentText}
              onChangeText={setCommentText}
              style={styles.commentInput}
              textAlignVertical="top"
            />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Post comment"
              disabled={
                commenting ||
                !commentText.trim()
              }
              onPress={handleSubmitComment}
              style={[
                styles.submitButton,
                (commenting ||
                  !commentText.trim()) &&
                  styles.disabledButton,
              ]}
            >
              <Text
                style={styles.submitButtonText}
              >
                {commenting
                  ? "Posting..."
                  : "Post Comment"}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* ============================================
            Delete Own Post
        ============================================ */}

        {isOwner && (
          <View style={styles.deleteSection}>
            <AppButton
              title={
                deleting
                  ? "Deleting..."
                  : "Delete Post"
              }
              icon="delete"
              variant="danger"
              loading={deleting}
              disabled={deleting}
              onPress={confirmDelete}
              style={styles.deleteButton}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// =====================================================
// Styles
// =====================================================

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  header: {
    minHeight: 54,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    paddingHorizontal: spacing.lg,

    backgroundColor: colors.surface,

    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  backButton: {
    width: 44,
    height: 44,

    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    ...typography.section,
    color: colors.text,
  },

  headerSpacer: {
    width: 44,
  },

  content: {
    paddingBottom: spacing.xxxl,
  },

  // =====================================================
  // Photos
  // =====================================================

  photos: {
    gap: spacing.md,
    backgroundColor: colors.surface,
  },

  photoContainer: {
    width: "100%",
    backgroundColor:
      colors.surfaceSecondary,
  },

  photo: {
    width: "100%",
    height: 320,
  },

  photoFallback: {
    height: 250,

    alignItems: "center",
    justifyContent: "center",

    gap: spacing.md,
  },

  muted: {
    ...typography.body,
    color: colors.textMuted,
  },

  // =====================================================
  // Author
  // =====================================================

  authorSection: {
    backgroundColor: colors.surface,

    padding: spacing.lg,

    flexDirection: "row",
    alignItems: "center",

    gap: spacing.md,
  },

  avatar: {
    width: 44,
    height: 44,

    borderRadius: radius.pill,

    backgroundColor: colors.primaryLight,

    alignItems: "center",
    justifyContent: "center",

    overflow: "hidden",
  },

  avatarImage: {
    width: "100%",
    height: "100%",
  },

  avatarInitial: {
    fontSize: 19,
    fontWeight: "700",
    color: colors.primary,
  },

  authorInfo: {
    flex: 1,
    gap: spacing.xs,
  },

  username: {
    ...typography.cardTitle,
    color: colors.text,
  },

  date: {
    ...typography.caption,
    color: colors.textMuted,
  },

  // =====================================================
  // Shared Sections
  // =====================================================

  section: {
    padding: spacing.lg,

    backgroundColor: colors.surface,

    marginTop: spacing.md,

    gap: spacing.md,
  },

  sectionTitle: {
    ...typography.section,
    color: colors.text,
  },

  title: {
    ...typography.title,
    color: colors.text,
  },

  caption: {
    ...typography.body,
    color: colors.text,
    lineHeight: 24,
  },

  // =====================================================
  // Restaurant / Dish Links
  // =====================================================

  linkCard: {
    minHeight: 64,

    padding: spacing.md,

    borderRadius: radius.lg,

    borderWidth: 1,
    borderColor: colors.border,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  linkContent: {
    flex: 1,

    flexDirection: "row",
    alignItems: "center",

    gap: spacing.md,
  },

  linkText: {
    flex: 1,
  },

  linkTitle: {
    ...typography.cardTitle,
    color: colors.text,
  },

  linkSubtitle: {
    ...typography.caption,

    color: colors.textSecondary,

    marginTop: spacing.xs,
  },

  // =====================================================
  // Ratings
  // =====================================================

  ratingRow: {
    flexDirection: "row",
    gap: spacing.md,
  },

  ratingCard: {
    flex: 1,

    minHeight: 90,

    padding: spacing.md,

    borderWidth: 1,
    borderColor: colors.border,

    borderRadius: radius.lg,

    justifyContent: "center",

    gap: spacing.sm,
  },

  ratingLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  ratingValueRow: {
    flexDirection: "row",
    alignItems: "center",

    gap: spacing.sm,
  },

  ratingValue: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.primary,
  },

  // =====================================================
  // Likes / Favorites
  // =====================================================

  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",

    gap: spacing.md,
  },

  actionButton: {
    flexDirection: "row",
    alignItems: "center",

    gap: spacing.sm,

    padding: spacing.md,

    borderRadius: radius.pill,

    backgroundColor: colors.primaryLight,
  },

  actionText: {
    ...typography.button,
    color: colors.primary,
  },

  favoriteSymbol: {
    fontSize: 25,
    color: colors.primary,
  },

  // =====================================================
  // Comments
  // =====================================================

  commentCard: {
    paddingVertical: spacing.md,

    borderBottomWidth: 1,
    borderBottomColor: colors.border,

    gap: spacing.xs,
  },

  commentAuthor: {
    ...typography.cardTitle,
    color: colors.text,
  },

  commentContent: {
    ...typography.body,
    color: colors.text,
  },

  commentDate: {
    ...typography.caption,
    color: colors.textMuted,
  },

  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },

  errorText: {
    ...typography.caption,
    color: colors.primary,
  },

  commentInputSection: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },

  commentInput: {
    minHeight: 90,

    padding: spacing.md,

    borderRadius: radius.lg,

    borderWidth: 1,
    borderColor: colors.border,

    color: colors.text,
    backgroundColor: colors.background,

    fontSize: 15,
  },

  submitButton: {
    minHeight: 44,

    alignSelf: "flex-end",

    paddingHorizontal: spacing.xl,

    borderRadius: radius.pill,

    backgroundColor: colors.primary,

    justifyContent: "center",
    alignItems: "center",
  },

  submitButtonText: {
    color: colors.white,

    fontWeight: "700",
    fontSize: 14,
  },

  disabledButton: {
    opacity: 0.5,
  },

  // =====================================================
  // Delete
  // =====================================================

  deleteSection: {
    padding: spacing.lg,
  },

  deleteButton: {
    alignSelf: "flex-start",
    minWidth: 140,
  },
});