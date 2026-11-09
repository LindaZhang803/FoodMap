import React, { useEffect, useState } from "react";

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

export default function RestaurantCard({
  restaurant,
  onPress,
  distanceKm = null,
  compact = false,
}) {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [restaurant.imageUrl, restaurant._id]);

  const imageSource = imageError
    ? getRestaurantImage({
        ...restaurant,
        imageUrl: null,
      })
    : getRestaurantImage(restaurant);

  const hasRating =
    restaurant.rating != null &&
    restaurant.reviewCount !== 0 &&
    Number.isFinite(Number(restaurant.rating));

  const rating = hasRating
    ? Number(restaurant.rating).toFixed(1)
    : "No ratings yet";

  const address =
    restaurant.address?.trim() ||
    "Address unavailable";

  const cuisine =
    restaurant.cuisineType?.trim() ||
    "Cuisine unavailable";

  const price =
    restaurant.priceRange?.trim() ||
    "Price unavailable";

  const distanceText =
    typeof distanceKm === "number" &&
    Number.isFinite(distanceKm) &&
    distanceKm >= 0
      ? distanceKm < 1
        ? `${Math.round(distanceKm * 1000)} m`
        : `${distanceKm.toFixed(1)} km`
      : null;

  const isIllustration =
    !restaurant.imageUrl || imageError;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        compact && styles.compactCard,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View ${restaurant.name}`}
    >
      <Image
        source={imageSource}
        style={[
          styles.image,
          compact && styles.compactImage,
        ]}
        resizeMode="cover"
        onError={() => setImageError(true)}
      />

      <View style={styles.info}>
        <Text
          style={[
            styles.name,
            compact && styles.compactName,
          ]}
          numberOfLines={2}
        >
          {restaurant.name}
        </Text>

        <Text
          style={styles.cuisine}
          numberOfLines={1}
        >
          {cuisine}
        </Text>

        <View style={styles.metadata}>
          <Text
            style={[
              styles.rating,
              !hasRating && styles.unrated,
            ]}
          >
            {hasRating ? `★ ${rating}` : rating}
          </Text>

          {distanceText !== null && (
            <Text
              style={styles.distance}
              numberOfLines={1}
            >
              {distanceText}
            </Text>
          )}
        </View>

        <Text style={styles.price}>
          {price}
        </Text>

        {!compact && (
          <Text
            style={styles.address}
            numberOfLines={2}
          >
            {address}
          </Text>
        )}

        {isIllustration && (
          <Text style={styles.imageNote}>
            Cuisine illustration
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    marginBottom: spacing.lg,
    ...shadows.card,
  },

  compactCard: {
    width: "48.5%",
  },

  pressed: {
    opacity: 0.85,
  },

  image: {
    width: "100%",
    height: 190,
    backgroundColor: colors.surfaceSecondary,
  },

  compactImage: {
    height: 155,
  },

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
  },

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
});