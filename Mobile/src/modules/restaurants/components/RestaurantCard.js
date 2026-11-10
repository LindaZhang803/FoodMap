import React, {
  useEffect,
  useState,
} from "react";

import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
} from "react-native";

import getRestaurantImage from "../utils/getRestaurantImage";

import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../../shared/design/tokens";

// =====================================================
// Restaurant Card
// =====================================================

export default function RestaurantCard({
  restaurant,
  onPress,
  distanceKm = null,
  compact = false,

  // Favorite integration
  isFavorite = false,
  onToggleFavorite,
  favoriteLoading = false,
}) {
  const [imageError, setImageError] =
    useState(false);

  // =====================================================
  // 1. Reset Image Error
  // =====================================================

  useEffect(() => {
    setImageError(false);
  }, [
    restaurant?.imageUrl,
    restaurant?._id,
  ]);

  // =====================================================
  // 2. Restaurant Image
  // =====================================================

  const imageSource = imageError
    ? getRestaurantImage({
        ...restaurant,
        imageUrl: null,
      })
    : getRestaurantImage(restaurant);

  const isIllustration =
    !restaurant.imageUrl || imageError;

  // =====================================================
  // 3. Restaurant Information
  // =====================================================

  const name =
    restaurant.name?.trim() ||
    "Unnamed restaurant";

  const cuisine =
    restaurant.cuisineType?.trim() ||
    "Cuisine unavailable";

  const price =
    restaurant.priceRange?.trim() ||
    "Price unavailable";

  const address =
    restaurant.address?.trim() ||
    "Address unavailable";

  // =====================================================
  // 4. Average Rating
  // =====================================================

  // A restaurant is rated only when:
  // - rating is a valid number
  // - reviewCount is greater than zero

  const ratingValue =
    Number(restaurant.rating);

  const reviewCount =
    Number(restaurant.reviewCount);

  const hasRating =
    restaurant.rating != null &&
    Number.isFinite(ratingValue) &&
    Number.isFinite(reviewCount) &&
    reviewCount > 0;

  const ratingText = hasRating
    ? ratingValue.toFixed(1)
    : "No ratings yet";

  // =====================================================
  // 5. Distance
  // =====================================================

  const hasDistance =
    typeof distanceKm === "number" &&
    Number.isFinite(distanceKm) &&
    distanceKm >= 0;

  const distanceText = hasDistance
    ? distanceKm < 1
      ? `${Math.round(distanceKm * 1000)} m`
      : `${distanceKm.toFixed(1)} km`
    : "Distance unavailable";

  // =====================================================
  // 6. Favorite
  // =====================================================

  const canToggleFavorite =
    typeof onToggleFavorite === "function";

  function handleFavorite() {
    if (
      favoriteLoading ||
      !canToggleFavorite
    ) {
      return;
    }

    // The parent owns the actual favorite state
    // and persists the change to the backend.

    onToggleFavorite(
      restaurant,
      !isFavorite
    );
  }

  // =====================================================
  // 7. Render
  // =====================================================

  return (
    <View
      style={[
        styles.card,
        compact && styles.compactCard,
      ]}
    >
      {/* ============================================
          Main Restaurant Button
      ============================================ */}

      <Pressable
        style={({ pressed }) => [
          styles.mainButton,
          pressed && styles.pressed,
        ]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`View ${name}`}
      >
        {/* Restaurant Image */}

        <Image
          source={imageSource}
          style={[
            styles.image,
            compact && styles.compactImage,
          ]}
          resizeMode="cover"
          onError={() =>
            setImageError(true)
          }
          accessibilityLabel={`${name} photo`}
        />

        {/* Restaurant Information */}

        <View style={styles.info}>
          <Text
            style={[
              styles.name,
              compact && styles.compactName,
            ]}
            numberOfLines={2}
          >
            {name}
          </Text>

          {/* Cuisine Type */}

          <Text
            style={styles.cuisine}
            numberOfLines={1}
          >
            {cuisine}
          </Text>

          {/* Average Rating / Distance */}

          <View style={styles.metadata}>
            <Text
              style={[
                styles.rating,
                !hasRating && styles.unrated,
              ]}
            >
              {hasRating
                ? `★ ${ratingText}`
                : ratingText}
            </Text>

            <Text
              style={styles.distance}
              numberOfLines={1}
            >
              {distanceText}
            </Text>
          </View>

          {/* Price Range */}

          <Text style={styles.price}>
            {price}
          </Text>

          {/* Address */}

          {!compact && (
            <Text
              style={styles.address}
              numberOfLines={2}
            >
              {address}
            </Text>
          )}

          {/* Default Image Notice */}

          {isIllustration && (
            <Text style={styles.imageNote}>
              Cuisine illustration
            </Text>
          )}
        </View>
      </Pressable>

      {/* ============================================
          Favorite Button

          This is separate from the main
          restaurant Pressable, so saving a
          restaurant does not open its details.
      ============================================ */}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          isFavorite
            ? `Remove ${name} from favorites`
            : `Add ${name} to favorites`
        }
        accessibilityState={{
          selected: Boolean(isFavorite),
          disabled:
            favoriteLoading ||
            !canToggleFavorite,
        }}
        onPress={handleFavorite}
        disabled={
          favoriteLoading ||
          !canToggleFavorite
        }
        style={({ pressed }) => [
          styles.favoriteButton,
          compact &&
            styles.compactFavoriteButton,
          pressed &&
            styles.favoritePressed,
          favoriteLoading &&
            styles.favoriteLoading,
        ]}
      >
        <Text
          style={[
            styles.favoriteIcon,
            isFavorite &&
              styles.favoriteIconActive,
          ]}
        >
          {isFavorite ? "♥" : "♡"}
        </Text>
      </Pressable>
    </View>
  );
}

// =====================================================
// Styles
// =====================================================

const styles = StyleSheet.create({
  // =====================================================
  // Card
  // =====================================================

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,

    borderWidth: 1,
    borderColor: colors.border,

    overflow: "hidden",

    marginBottom: spacing.lg,

    position: "relative",

    ...shadows.card,
  },

  compactCard: {
    width: "48.5%",
  },

  mainButton: {
    width: "100%",
  },

  pressed: {
    opacity: 0.85,
  },

  // =====================================================
  // Image
  // =====================================================

  image: {
    width: "100%",
    height: 190,
    backgroundColor:
      colors.surfaceSecondary,
  },

  compactImage: {
    height: 155,
  },

  // =====================================================
  // Information
  // =====================================================

  info: {
    padding: spacing.md,
  },

  name: {
    ...typography.section,
    color: colors.text,

    marginBottom: spacing.xs,
  },

  compactName: {
    ...typography.cardTitle,
    minHeight: 42,
  },

  cuisine: {
    ...typography.caption,

    color: colors.textSecondary,

    marginBottom: spacing.sm,

    textTransform: "capitalize",
  },

  // =====================================================
  // Rating / Distance
  // =====================================================

  metadata: {
    flexDirection: "row",
    flexWrap: "wrap",

    alignItems: "center",
    justifyContent: "space-between",

    gap: spacing.xs,

    marginBottom: spacing.sm,
  },

  rating: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },

  unrated: {
    fontSize: 11,
    fontWeight: "400",
    color: colors.textMuted,
  },

  distance: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textSecondary,

    flexShrink: 1,
  },

  // =====================================================
  // Price / Address
  // =====================================================

  price: {
    ...typography.caption,

    fontWeight: "700",
    color: colors.text,
  },

  address: {
    ...typography.caption,

    color: colors.textSecondary,

    marginTop: spacing.sm,
  },

  imageNote: {
    fontSize: 10,
    color: colors.textMuted,

    marginTop: spacing.sm,
  },

  // =====================================================
  // Favorite Button
  // =====================================================

  favoriteButton: {
    position: "absolute",

    top: spacing.sm,
    right: spacing.sm,

    width: 44,
    height: 44,

    borderRadius: radius.pill,

    backgroundColor:
      "rgba(255,255,255,0.95)",

    alignItems: "center",
    justifyContent: "center",

    borderWidth: 1,
    borderColor: colors.border,

    zIndex: 2,
    elevation: 3,
  },

  compactFavoriteButton: {
    width: 40,
    height: 40,
  },

  favoriteIcon: {
    fontSize: 28,
    lineHeight: 32,
    color: colors.primary,
  },

  favoriteIconActive: {
    color: colors.primary,
  },

  favoritePressed: {
    opacity: 0.75,
  },

  favoriteLoading: {
    opacity: 0.5,
  },
});