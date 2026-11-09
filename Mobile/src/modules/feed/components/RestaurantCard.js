import React, { useEffect, useState } from "react";

import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import getRestaurantImage from "../../restaurants/utils/getRestaurantImage";

import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../../shared/design/tokens";

import AppIcon from "../../../shared/components/AppIcon";

export default function RestaurantCard({
  restaurant,
  recommendedDish,
  preferenceScore,
  dishImageSource,
  onPress,
}) {
  const [dishImageFailed, setDishImageFailed] = useState(false);
  const [restaurantImageFailed, setRestaurantImageFailed] =
    useState(false);

  const dishId = recommendedDish?.dishId;
  const dishImageUrl = recommendedDish?.imageUrl;

  const showRecommendation = recommendedDish !== undefined;

  const dishPhoto =
    dishImageSource ??
    (dishImageUrl ? { uri: dishImageUrl } : null);

  useEffect(() => {
    setDishImageFailed(false);
  }, [dishId, dishImageUrl, dishImageSource]);

  useEffect(() => {
    setRestaurantImageFailed(false);
  }, [restaurant._id, restaurant.imageUrl]);

  const restaurantPhoto = restaurantImageFailed
    ? getRestaurantImage({
        ...restaurant,
        imageUrl: null,
      })
    : getRestaurantImage(restaurant);

  const showDishPhoto =
    showRecommendation &&
    recommendedDish != null &&
    dishPhoto != null &&
    !dishImageFailed;

  const imageSource = showDishPhoto
    ? dishPhoto
    : restaurantPhoto;

  const isDishPhoto = showDishPhoto;

  const imageIsIllustration =
    !isDishPhoto &&
    (!restaurant.imageUrl || restaurantImageFailed);

  const name =
    restaurant.name?.trim() || "Unnamed Restaurant";

  const address =
    restaurant.address?.trim() || "Address unavailable";

  const cuisine =
    restaurant.cuisineType?.trim() || "Cuisine unavailable";

  const price =
    restaurant.priceRange?.trim() || "Price unavailable";

  const ratingValue = Number(restaurant.rating);

  const hasRating =
    restaurant.rating != null &&
    Number(restaurant.reviewCount) > 0 &&
    Number.isFinite(ratingValue);

  const recommendationLabel =
    typeof preferenceScore === "number" &&
    Number.isFinite(preferenceScore)
      ? `${Math.round(preferenceScore)}% Taste Similarity`
      : "Popular Dish";

  function handleImageError() {
    if (isDishPhoto) {
      setDishImageFailed(true);
    } else {
      setRestaurantImageFailed(true);
    }
  }

  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={
        onPress ? `Open restaurant ${name}` : undefined
      }
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && onPress && styles.pressed,
      ]}
    >
      <View style={styles.imageContainer}>
        <Image
          source={imageSource}
          style={styles.hero}
          resizeMode="cover"
          onError={handleImageError}
          accessibilityLabel={
            isDishPhoto
              ? `${recommendedDish.name} photo`
              : `${name} restaurant illustration or photo`
          }
          testID={
            isDishPhoto
              ? `dish-image:${dishId}`
              : "restaurant-fallback-image"
          }
        />

        {showRecommendation && recommendedDish && (
          <View style={styles.recommendationBadge}>
            <AppIcon
              name="starFilled"
              size={13}
              color={colors.primary}
            />

            <Text style={styles.badgeText}>
              {recommendationLabel}
            </Text>
          </View>
        )}

        {!isDishPhoto && (
          <View style={styles.imageLabel}>
            <Text style={styles.imageLabelText}>
              {imageIsIllustration
                ? "Cuisine illustration"
                : "Restaurant photo"}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>
          {name}
        </Text>

        <View style={styles.ratingRow}>
          {hasRating ? (
            <>
              <AppIcon
                name="starFilled"
                size={16}
                color={colors.primary}
              />

              <Text style={styles.rating}>
                {ratingValue.toFixed(1)}
              </Text>
            </>
          ) : (
            <Text style={styles.unrated}>
              No ratings yet
            </Text>
          )}
        </View>

        <View style={styles.detailRow}>
          <AppIcon
            name="location"
            size={16}
            color={colors.textMuted}
          />

          <Text style={styles.details} numberOfLines={2}>
            {address}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <AppIcon
            name="restaurant"
            size={16}
            color={colors.textMuted}
          />

          <Text style={styles.details} numberOfLines={2}>
            {cuisine} · {price}
          </Text>
        </View>

        {showRecommendation && (
          <View style={styles.recommendation}>
            <View style={styles.recommendationHeader}>
              <AppIcon
                name="cuisine"
                size={17}
                color={colors.primary}
              />

              <Text style={styles.recommendationTitle}>
                Recommended Dish
              </Text>
            </View>

            <Text
              style={
                recommendedDish
                  ? styles.pick
                  : styles.unavailable
              }
              numberOfLines={3}
            >
              {recommendedDish
                ? recommendedDish.name
                : "Dish recommendation unavailable"}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },

  pressed: {
    opacity: 0.8,
  },

  imageContainer: {
    position: "relative",
  },

  hero: {
    width: "100%",
    height: 190,
    backgroundColor: colors.surfaceSecondary,
  },

  recommendationBadge: {
    position: "absolute",
    left: spacing.md,
    bottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    maxWidth: "85%",
  },

  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
    flexShrink: 1,
  },

  imageLabel: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.92)",
  },

  imageLabelText: {
    fontSize: 10,
    color: colors.textSecondary,
  },

  info: {
    padding: spacing.lg,
    gap: spacing.sm,
  },

  name: {
    ...typography.section,
    color: colors.text,
    marginBottom: spacing.xs,
  },

  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },

  rating: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },

  unrated: {
    ...typography.caption,
    color: colors.textMuted,
  },

  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },

  details: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
  },

  recommendation: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    gap: spacing.sm,
  },

  recommendationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },

  recommendationTitle: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.primary,
  },

  pick: {
    ...typography.body,
    color: colors.text,
    fontWeight: "600",
  },

  unavailable: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});