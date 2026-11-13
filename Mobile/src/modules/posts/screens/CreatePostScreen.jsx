import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";

import RestaurantBrowser from "../../../../RestaurantBrowser";

import {
  API_ORIGIN,
} from "../../../config/api";

import {
  createPost,
  resolvePostImageUrl,
} from "../services/postApi";

import AppIcon from "../../../shared/components/AppIcon";

import {
  AppButton,
  AppInput,
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../../shared/design/UIComponents";

import {
  colors,
  spacing,
  radius,
  typography,
} from "../../../shared/design/tokens";

// =====================================================
// Read Eligible Reviews
// =====================================================

async function getEligibleReviews(token, signal) {
  const response = await fetch(
    `${String(API_ORIGIN).replace(/\/+$/, "")}/api/posts/eligible-reviews`,
    {
      method: "GET",

      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },

      signal,
    }
  );

  const payload = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    throw new Error(
      payload?.message ||
      `Unable to load reviews (${response.status}).`
    );
  }

  if (!Array.isArray(payload?.items)) {
    throw new Error(
      "Invalid eligible reviews response."
    );
  }

  return payload.items;
}

// =====================================================
// Review Option
// =====================================================

function ReviewOption({
  review,
  selected,
  onPress,
}) {
  const [imageFailed, setImageFailed] =
    useState(false);

  const imageUrl = resolvePostImageUrl(
    review.photoUrls?.[0]
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        `Select review for ${review.restaurantName}`
      }
      accessibilityState={{
        selected,
      }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.reviewCard,

        selected &&
          styles.reviewCardSelected,

        pressed &&
          styles.pressed,
      ]}
    >
      <View style={styles.reviewImage}>
        {imageUrl && !imageFailed ? (
          <Image
            source={{
              uri: imageUrl,
            }}
            style={styles.image}
            resizeMode="cover"
            onError={() =>
              setImageFailed(true)
            }
          />
        ) : (
          <AppIcon
            name="image"
            size={28}
            color={colors.textMuted}
          />
        )}
      </View>

      <View style={styles.reviewInfo}>
        <Text
          style={styles.reviewName}
          numberOfLines={1}
        >
          {review.restaurantName}
        </Text>

        <Text
          style={styles.reviewComment}
          numberOfLines={2}
        >
          {review.comment}
        </Text>

        <View style={styles.reviewMeta}>
          <AppIcon
            name="starFilled"
            size={15}
            color={colors.primary}
          />

          <Text style={styles.metaText}>
            {review.rating}/5
          </Text>

          <AppIcon
            name="image"
            size={15}
            color={colors.textSecondary}
          />

          <Text style={styles.metaText}>
            {review.photoUrls.length}
          </Text>
        </View>
      </View>

      <AppIcon
        name={
          selected
            ? "success"
            : "check"
        }
        size={23}
        color={
          selected
            ? colors.primary
            : colors.textMuted
        }
      />
    </Pressable>
  );
}

// =====================================================
// Create Post Screen
// =====================================================

export default function CreatePostScreen({
  token,
  isAuthenticated = false,
  onLoginRequired,
  onPublished,
}) {
  const [mode, setMode] =
    useState("post");

  const [reviews, setReviews] =
    useState([]);

  const [selectedReviewId, setSelectedReviewId] =
    useState(null);

  const [title, setTitle] =
    useState("");

  const [caption, setCaption] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [publishing, setPublishing] =
    useState(false);

  const [error, setError] =
    useState(null);

  const [formError, setFormError] =
    useState(null);

  const [notice, setNotice] =
    useState("");

  const requestRef = useRef(null);
  const publishingRef = useRef(false);

  // =====================================================
  // Load Reviews
  // =====================================================

  const loadReviews = useCallback(
    async () => {
      if (!token || !isAuthenticated) {
        setReviews([]);
        setSelectedReviewId(null);
        return;
      }

      requestRef.current?.abort();

      const controller =
        new AbortController();

      requestRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const items =
          await getEligibleReviews(
            token,
            controller.signal
          );

        if (controller.signal.aborted) {
          return;
        }

        setReviews(items);

        setSelectedReviewId((previous) =>
          items.some(
            (item) => item.id === previous
          )
            ? previous
            : null
        );
      } catch (err) {
        if (
          !controller.signal.aborted
        ) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load your reviews."
          );
        }
      } finally {
        if (
          !controller.signal.aborted
        ) {
          setLoading(false);
        }
      }
    },
    [token, isAuthenticated]
  );

  // =====================================================
  // Reload When Opening Publish Post
  // =====================================================

  useEffect(() => {
    if (
      mode === "post" &&
      isAuthenticated &&
      token
    ) {
      loadReviews();
    }

    return () => {
      requestRef.current?.abort();
    };
  }, [
    mode,
    token,
    isAuthenticated,
    loadReviews,
  ]);

  // =====================================================
  // Selected Review
  // =====================================================

  const selectedReview =
    reviews.find(
      (review) =>
        review.id === selectedReviewId
    ) || null;

  // =====================================================
  // Publish
  // =====================================================

  async function handlePublish() {
    if (publishingRef.current) {
      return;
    }

    if (!isAuthenticated || !token) {
      onLoginRequired?.();
      return;
    }

    if (!selectedReview) {
      setFormError(
        "Please select a review with photos."
      );
      return;
    }

    const safeTitle = title.trim();

    if (
      safeTitle.length < 1 ||
      safeTitle.length > 120
    ) {
      setFormError(
        "Post title must contain 1–120 characters."
      );
      return;
    }

    if (caption.length > 2000) {
      setFormError(
        "Caption must be 2000 characters or fewer."
      );
      return;
    }

    publishingRef.current = true;

    setPublishing(true);
    setFormError(null);
    setNotice("");

    try {
      const post = await createPost(
        {
          reviewId: selectedReview.id,
          title: safeTitle,
          caption: caption.trim(),
        },
        token
      );

      setTitle("");
      setCaption("");
      setSelectedReviewId(null);

      setNotice(
        "Post published successfully."
      );

      if (
        typeof onPublished === "function"
      ) {
        onPublished(post);
      } else {
        await loadReviews();
      }
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Unable to publish post."
      );
    } finally {
      publishingRef.current = false;
      setPublishing(false);
    }
  }

  // =====================================================
  // Review Mode
  // =====================================================

  function renderReviewMode() {
    return (
      <View style={styles.reviewBrowser}>
        <RestaurantBrowser
          mode="create"
          token={token}
          isAuthenticated={isAuthenticated}
          onLoginPress={onLoginRequired}
        />
      </View>
    );
  }

  // =====================================================
  // Post Mode
  // =====================================================

  function renderPostMode() {
    if (!isAuthenticated || !token) {
      return (
        <EmptyState
          title="Sign In to Publish"
          description="Log in to publish your food experiences."
          actionLabel="Log In"
          onAction={onLoginRequired}
        />
      );
    }

    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionTitle}>
          Select Your Review
        </Text>

        <Text style={styles.description}>
          Choose one of your published reviews
          that includes at least one photo.
        </Text>

        {loading ? (
          <LoadingState
            message="Loading reviews..."
            style={styles.state}
          />
        ) : error ? (
          <ErrorState
            title="Unable to Load Reviews"
            message={error}
            onRetry={loadReviews}
            style={styles.state}
          />
        ) : reviews.length === 0 ? (
          <View style={styles.emptySection}>
            <EmptyState
              title="No Reviews With Photos"
              description="Write a review and attach a photo before publishing a post."
              style={styles.state}
            />

            <AppButton
              title="Write a Review"
              variant="secondary"
              onPress={() => setMode("review")}
            />
          </View>
        ) : (
          <View style={styles.reviewList}>
            {reviews.map((review) => (
              <ReviewOption
                key={review.id}
                review={review}
                selected={
                  selectedReviewId === review.id
                }
                onPress={() => {
                  setSelectedReviewId(review.id);
                  setFormError(null);
                }}
              />
            ))}
          </View>
        )}

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>
          Post Details
        </Text>

        <AppInput
          label="Post Title"
          placeholder="e.g. Best Sushi in Riverside"
          value={title}
          onChangeText={setTitle}
          maxLength={120}
          editable={!publishing}
        />

        <Text style={styles.count}>
          {title.length}/120
        </Text>

        <AppInput
          label="Caption"
          placeholder="Share your food experience..."
          value={caption}
          onChangeText={setCaption}
          multiline
          maxLength={2000}
          editable={!publishing}
          style={styles.caption}
        />

        <Text style={styles.count}>
          {caption.length}/2000
        </Text>

        {selectedReview && (
          <View style={styles.selectedNotice}>
            <AppIcon
              name="check"
              size={18}
              color={colors.success}
            />

            <Text style={styles.selectedText}>
              Selected: {selectedReview.restaurantName}
            </Text>
          </View>
        )}

        {formError && (
          <Text
            accessibilityRole="alert"
            style={styles.error}
          >
            {formError}
          </Text>
        )}

        {Boolean(notice) && (
          <Text style={styles.success}>
            {notice}
          </Text>
        )}

        <AppButton
          title={
            publishing
              ? "Publishing..."
              : "Publish Post"
          }
          onPress={handlePublish}
          loading={publishing}
          disabled={
            publishing ||
            loading ||
            !selectedReview
          }
          style={styles.publishButton}
        />
      </ScrollView>
    );
  }

  // =====================================================
  // Main Render
  // =====================================================

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>
          Share Your Experience
        </Text>

        <Text style={styles.subtitle}>
          Publish a food post or write a review.
        </Text>
      </View>

      <View style={styles.tabs}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{
            selected: mode === "post",
          }}
          style={[
            styles.tab,
            mode === "post" &&
              styles.activeTab,
          ]}
          onPress={() =>
            setMode("post")
          }
        >
          <AppIcon
            name="image"
            size={18}
            color={
              mode === "post"
                ? colors.primary
                : colors.textSecondary
            }
          />

          <Text
            style={[
              styles.tabText,
              mode === "post" &&
                styles.activeTabText,
            ]}
          >
            Publish Post
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="tab"
          accessibilityState={{
            selected: mode === "review",
          }}
          style={[
            styles.tab,
            mode === "review" &&
              styles.activeTab,
          ]}
          onPress={() =>
            setMode("review")
          }
        >
          <AppIcon
            name="edit"
            size={18}
            color={
              mode === "review"
                ? colors.primary
                : colors.textSecondary
            }
          />

          <Text
            style={[
              styles.tabText,
              mode === "review" &&
                styles.activeTabText,
            ]}
          >
            Write Review
          </Text>
        </Pressable>
      </View>

      {mode === "review"
        ? renderReviewMode()
        : renderPostMode()}
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
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },

  title: {
    ...typography.title,
    color: colors.text,
  },

  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  tabs: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  tab: {
    flex: 1,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },

  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: colors.primary,
  },

  tabText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "700",
  },

  activeTabText: {
    color: colors.primary,
  },

  reviewBrowser: {
    flex: 1,
    minHeight: 0,
  },

  scroll: {
    flex: 1,
  },

  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },

  sectionTitle: {
    ...typography.section,
    color: colors.text,
    marginBottom: spacing.sm,
  },

  description: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },

  reviewList: {
    gap: spacing.md,
  },

  reviewCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },

  reviewCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },

  reviewImage: {
    width: 76,
    height: 76,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },

  image: {
    width: "100%",
    height: "100%",
  },

  reviewInfo: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },

  reviewName: {
    ...typography.cardTitle,
    color: colors.text,
  },

  reviewComment: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  reviewMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },

  metaText: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  pressed: {
    opacity: 0.8,
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xxl,
  },

  caption: {
    minHeight: 120,
    textAlignVertical: "top",
  },

  count: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "right",
    marginTop: -spacing.md,
    marginBottom: spacing.lg,
  },

  selectedNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.successLight,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },

  selectedText: {
    ...typography.caption,
    color: colors.success,
    flex: 1,
  },

  error: {
    ...typography.body,
    color: colors.error,
    marginBottom: spacing.lg,
  },

  success: {
    ...typography.body,
    color: colors.success,
    marginBottom: spacing.lg,
  },

  publishButton: {
    marginTop: spacing.md,
  },

  state: {
    minHeight: 220,
  },

  emptySection: {
    gap: spacing.lg,
  },
});
