import React, {
  useState,
} from "react";

import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
} from "react-native";

import AppIcon from "../../../shared/components/AppIcon";

import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../../shared/design/tokens";

import {
  resolvePostImageUrl,
} from "../services/postApi";

// =====================================================
// Food Post Card
// =====================================================

export default function FoodPostCard({
  post,
  onPress,
  onLikePress,
  liking = false,
}) {
  const [imageFailed, setImageFailed] =
    useState(false);

  const [avatarFailed, setAvatarFailed] =
    useState(false);

  const imageUrl = resolvePostImageUrl(
    post.coverImageUrl
  );

  const avatarUrl = resolvePostImageUrl(
    post.author?.avatarUrl
  );

  const ratio =
    Number.isFinite(post.coverAspectRatio) &&
    post.coverAspectRatio > 0
      ? Math.max(
          0.5,
          Math.min(
            2,
            post.coverAspectRatio
          )
        )
      : 1;

  const username =
    post.author?.username ||
    "FoodMap User";

  const initial =
    username.charAt(0).toUpperCase();

  function handleLike(event) {
    event?.stopPropagation?.();
    onLikePress?.(post);
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open post: ${post.title}`}
      onPress={() =>
        onPress?.(post)
      }
      style={({ pressed }) => [
        styles.card,
        pressed &&
          styles.pressed,
      ]}
    >
      {/* Cover Image */}
      <View
        style={[
          styles.imageContainer,
          {
            aspectRatio: ratio,
          },
        ]}
      >
        {imageUrl && !imageFailed ? (
          <Image
            source={{
              uri: imageUrl,
            }}
            resizeMode="cover"
            style={styles.image}
            onError={() =>
              setImageFailed(true)
            }
          />
        ) : (
          <View style={styles.placeholder}>
            <AppIcon
              name="image"
              size={32}
              color={colors.textMuted}
            />

            <Text style={styles.placeholderText}>
              Photo unavailable
            </Text>
          </View>
        )}
      </View>

      {/* Post Information */}
      <View style={styles.content}>
        <Text
          style={styles.title}
          numberOfLines={2}
        >
          {post.title}
        </Text>

        {/* Restaurant */}
        {post.restaurant?.name ? (
          <View style={styles.restaurantRow}>
            <AppIcon
              name="location"
              size={12}
              color={colors.textMuted}
            />

            <Text
              style={styles.restaurantText}
              numberOfLines={1}
            >
              {post.restaurant.name}
            </Text>
          </View>
        ) : null}

        {/* Author + Likes */}
        <View style={styles.footer}>
          <View style={styles.author}>
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
                <Text style={styles.avatarText}>
                  {initial}
                </Text>
              )}
            </View>

            <Text
              style={styles.username}
              numberOfLines={1}
            >
              {username}
            </Text>
          </View>

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
            hitSlop={8}
            style={styles.likeButton}
          >
            <AppIcon
              name={
                post.likedByMe
                  ? "favoriteFilled"
                  : "favorite"
              }
              size={17}
              color={
                post.likedByMe
                  ? colors.primary
                  : colors.textSecondary
              }
            />

            <Text style={styles.likeCount}>
              {post.likeCount || 0}
            </Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

// =====================================================
// Styles
// =====================================================

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: "hidden",
    marginBottom: spacing.md,
    ...shadows.card,
  },

  pressed: {
    opacity: 0.85,
  },

  imageContainer: {
    width: "100%",
    backgroundColor:
      colors.surfaceSecondary,
    overflow: "hidden",
  },

  image: {
    width: "100%",
    height: "100%",
  },

  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },

  placeholderText: {
    ...typography.caption,
    color: colors.textMuted,
  },

  content: {
    padding: spacing.md,
    gap: spacing.sm,
  },

  title: {
    ...typography.cardTitle,
    color: colors.text,
  },

  restaurantRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },

  restaurantText: {
    fontSize: 11,
    color: colors.textSecondary,
    flex: 1,
  },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.xs,
  },

  author: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },

  avatar: {
    width: 25,
    height: 25,
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

  avatarText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
  },

  username: {
    fontSize: 11,
    color: colors.textSecondary,
    flex: 1,
  },

  likeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: 30,
  },

  likeCount: {
    fontSize: 11,
    color: colors.textSecondary,
  },
});