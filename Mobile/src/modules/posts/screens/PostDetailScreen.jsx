import React, {
  useEffect,
  useState,
} from "react";

import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
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
// Post Detail Screen
// =====================================================

export default function PostDetailScreen({
  postId,
  token = null,
  currentUserId = null,
  onBack,
  onRestaurantPress,
  onLoginRequired,
  onDeleted,
}) {
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

      try {
        const result = await getPost(
          postId,
          {
            token,
            signal: controller.signal,
          }
        );

        if (active) {
          setPost(result);
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
  ]);

  // =====================================================
  // Like Post
  // =====================================================

  async function handleLike() {
    if (!post || liking) {
      return;
    }

    if (!token) {
      if (
        typeof onLoginRequired === "function"
      ) {
        onLoginRequired();
      } else {
        Alert.alert(
          "Sign-in required",
          "Sign in to like posts."
        );
      }

      return;
    }

    setLiking(true);

    try {
      const result = await setPostLike(
        post.id,
        !post.likedByMe,
        token
      );

      setPost((current) =>
        current
          ? {
              ...current,
              likedByMe:
                result.likedByMe,
              likeCount:
                result.likeCount,
            }
          : current
      );
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
  // Delete Own Post
  // =====================================================

  function confirmDelete() {
    if (
      !post ||
      deleting
    ) {
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
        Food Post
      </Text>

      <View style={styles.headerSpacer} />
    </View>
  );

  // =====================================================
  // Loading / Error
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
  // Display Information
  // =====================================================

  const username =
    post.author?.username ||
    "FoodMap User";

  const avatarUrl =
    resolvePostImageUrl(
      post.author?.avatarUrl
    );

  const isOwner =
    Boolean(currentUserId) &&
    post.author?.id === currentUserId;

  const date = post.createdAt
    ? new Date(
        post.createdAt
      ).toLocaleDateString()
    : "";

  const images = Array.isArray(
    post.imageUrls
  )
    ? post.imageUrls
    : [];

  // =====================================================
  // Render
  // =====================================================

  return (
    <View style={styles.screen}>
      {header}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          styles.content
        }
      >
        {/* Photos */}
        <View style={styles.photos}>
          {images.map(
            (imageUrl, index) => {
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
                      source={{
                        uri: url,
                      }}
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
                    <View style={styles.photoFallback}>
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
            }
          )}
        </View>

        {/* Author */}
        <View style={styles.authorSection}>
          <View style={styles.avatar}>
            {avatarUrl &&
            !avatarFailed ? (
              <Image
                source={{
                  uri: avatarUrl,
                }}
                style={styles.avatarImage}
                onError={() =>
                  setAvatarFailed(true)
                }
              />
            ) : (
              <Text style={styles.avatarInitial}>
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
              {date}
            </Text>
          </View>
        </View>

        {/* Post Content */}
        <View style={styles.postSection}>
          <Text style={styles.title}>
            {post.title}
          </Text>

          {Boolean(post.caption) && (
            <Text style={styles.caption}>
              {post.caption}
            </Text>
          )}
        </View>

        {/* Restaurant */}
        {post.restaurant?.id && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              `Open ${post.restaurant.name}`
            }
            onPress={() =>
              onRestaurantPress?.(
                post.restaurant.id
              )
            }
            style={styles.restaurantCard}
          >
            <View style={styles.restaurantInfo}>
              <AppIcon
                name="restaurant"
                size={23}
                color={colors.primary}
              />

              <View style={styles.restaurantText}>
                <Text style={styles.restaurantName}>
                  {post.restaurant.name}
                </Text>

                <Text style={styles.restaurantCuisine}>
                  {post.restaurant.cuisineType}
                </Text>
              </View>
            </View>

            <AppIcon
              name="chevronForward"
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        )}

        {/* Like */}
        <View style={styles.actionSection}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              post.likedByMe
                ? "Unlike post"
                : "Like post"
            }
            disabled={liking}
            onPress={handleLike}
            style={({ pressed }) => [
              styles.likeButton,
              pressed &&
                styles.pressed,
            ]}
          >
            <AppIcon
              name={
                post.likedByMe
                  ? "favoriteFilled"
                  : "favorite"
              }
              size={23}
              color={colors.primary}
            />

            <Text style={styles.likeText}>
              {post.likeCount || 0} Likes
            </Text>
          </Pressable>

          {isOwner && (
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
          )}
        </View>
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

  postSection: {
    padding: spacing.xl,
    backgroundColor: colors.surface,
    marginTop: spacing.md,
    gap: spacing.md,
  },

  title: {
    ...typography.title,
    color: colors.text,
  },

  caption: {
    ...typography.body,
    color: colors.text,
  },

  restaurantCard: {
    margin: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  restaurantInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },

  restaurantText: {
    flex: 1,
  },

  restaurantName: {
    ...typography.cardTitle,
    color: colors.text,
  },

  restaurantCuisine: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  actionSection: {
    padding: spacing.lg,
    gap: spacing.lg,
  },

  likeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    alignSelf: "flex-start",
    padding: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
  },

  likeText: {
    ...typography.button,
    color: colors.primary,
  },

  deleteButton: {
    alignSelf: "flex-start",
    minWidth: 140,
  },

  pressed: {
    opacity: 0.75,
  },
});