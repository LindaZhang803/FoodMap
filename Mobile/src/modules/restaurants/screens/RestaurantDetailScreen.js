import React, { useEffect, useState } from "react";

import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";

import getRestaurantImage from "../utils/getRestaurantImage";

import PhotoUploadButton from "../components/PhotoUploadButton";

import { API_ORIGIN } from "../../../config/api";

import {
  colors,
  spacing,
  radius,
  typography,
} from "../../../shared/design/tokens";

import {
  LoadingState,
  ErrorState,
} from "../../../shared/design/UIComponents";

import AppIcon from "../../../shared/components/AppIcon";

// =====================================================
// Restaurant Detail Screen
// =====================================================

export default function RestaurantDetailScreen({
  restaurantId,
  onBack,
  onViewDishes,
  renderRestaurantActions,
}) {
  const [restaurant, setRestaurant] = useState(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState(null);

  const [imageError, setImageError] = useState(false);

  const [retry, setRetry] = useState(0);

  // =====================================================
  // 1. Load restaurant
  // =====================================================

  useEffect(() => {
    let active = true;

    const controller = new AbortController();

    async function loadRestaurant() {
      setLoading(true);
      setError(null);
      setImageError(false);
      setRestaurant(null);

      try {
        const response = await fetch(
          `${API_ORIGIN}/api/restaurants/${restaurantId}`,
          {
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? "Restaurant not found"
              : "Failed to load restaurant"
          );
        }

        const data = await response.json();

        if (active) {
          setRestaurant(data);
        }
      } catch (err) {
        if (active && err?.name !== "AbortError") {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load restaurant"
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    if (restaurantId) {
      loadRestaurant();
    } else {
      setLoading(false);
      setError("Restaurant ID is missing.");
    }

    return () => {
      active = false;
      controller.abort();
    };
  }, [restaurantId, retry]);

  // =====================================================
  // 2. Fixed header
  // =====================================================

  const header = (
    <View style={styles.header}>
      <Pressable
        style={styles.backButton}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back to restaurants"
      >
        <AppIcon
          name="back"
          size={24}
          color={colors.primary}
        />
      </Pressable>

      <Text style={styles.headerTitle}>
        Restaurant
      </Text>

      <View style={styles.headerSpacer} />
    </View>
  );

  // =====================================================
  // 3. Loading state
  // =====================================================

  if (loading) {
    return (
      <View style={styles.container}>
        {header}

        <LoadingState
          message="Loading restaurant..."
        />
      </View>
    );
  }

  // =====================================================
  // 4. Error state
  // =====================================================

  if (error || !restaurant) {
    return (
      <View style={styles.container}>
        {header}

        <ErrorState
          title="Restaurant unavailable"
          message={
            error ||
            "Restaurant information is unavailable."
          }
          onRetry={() => setRetry((value) => value + 1)}
        />
      </View>
    );
  }

  // =====================================================
  // 5. Restaurant information
  // =====================================================

  const imageSource = imageError
    ? getRestaurantImage({
        ...restaurant,
        imageUrl: null,
      })
    : getRestaurantImage(restaurant);

  const name =
    restaurant.name?.trim() ||
    "Unnamed restaurant";

  const description =
    restaurant.description?.trim() ||
    "Description unavailable";

  const address =
    restaurant.address?.trim() ||
    "Address unavailable";

  const cuisine =
    restaurant.cuisineType?.trim() ||
    "Cuisine unavailable";

  const price =
    restaurant.priceRange?.trim() ||
    "Price unavailable";

  const ratingValue = Number(restaurant.rating);

  const hasRating =
    restaurant.rating != null &&
    Number(restaurant.reviewCount) > 0 &&
    Number.isFinite(ratingValue);

  const rating = hasRating
    ? `${ratingValue.toFixed(1)} / 5`
    : "No ratings yet";

  const hours =
    restaurant.openingHours?.trim() ||
    "Hours unavailable";

  // =====================================================
  // 6. Shared Favorites action
  // =====================================================

  const favoriteAction =
    typeof renderRestaurantActions === "function"
      ? renderRestaurantActions(restaurant)
      : null;

  // =====================================================
  // 7. Render
  // =====================================================

  return (
    <View style={styles.container}>
      {header}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Restaurant image */}
        <View style={styles.imageContainer}>
          <Image
            source={imageSource}
            style={styles.image}
            resizeMode="cover"
            onError={() => setImageError(true)}
            accessibilityLabel={`${name} photo`}
          />

          {(!restaurant.imageUrl || imageError) && (
            <View style={styles.imageLabel}>
              <Text style={styles.imageLabelText}>
                Cuisine illustration
              </Text>
            </View>
          )}
        </View>

        {/* Main information */}
        <View style={styles.mainInfo}>
          <Text style={styles.name}>
            {name}
          </Text>

          <Text style={styles.cuisine}>
            {cuisine}
          </Text>

          {/* Rating and price */}
          <View style={styles.metadata}>
            <View style={styles.ratingBadge}>
              {hasRating && (
                <AppIcon
                  name="starFilled"
                  size={15}
                  color={colors.primary}
                />
              )}

              <Text style={styles.rating}>
                {rating}
              </Text>
            </View>

            <View style={styles.priceBadge}>
              <Text style={styles.priceText}>
                {price}
              </Text>
            </View>
          </View>

          {/* Address */}
          <View style={styles.addressRow}>
            <AppIcon
              name="location"
              size={16}
              color={colors.textMuted}
            />

            <Text style={styles.addressPreview}>
              {address}
            </Text>
          </View>

          {/* Favorite Button */}
          {favoriteAction && (
            <View style={styles.favoriteSection}>
              {favoriteAction}
            </View>
          )}
        </View>

        {/* Explore Menu */}
        <View style={styles.section}>
          <Text style={styles.heading}>
            Explore the Menu
          </Text>

          <Text style={styles.description}>
            Discover dishes and read customer reviews.
          </Text>

          {typeof onViewDishes === "function" && (
            <Pressable
              style={({ pressed }) => [
                styles.menuButton,
                pressed && styles.pressed,
              ]}
              onPress={onViewDishes}
              accessibilityRole="button"
              accessibilityLabel="Browse dishes and reviews"
            >
              <Text style={styles.menuButtonText}>
                Browse Dishes & Reviews
              </Text>

              <AppIcon
                name="forward"
                size={22}
                color={colors.white}
              />
            </Pressable>
          )}
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.heading}>
            About This Restaurant
          </Text>

          <Text style={styles.text}>
            {description}
          </Text>
        </View>

        {/* Address */}
        <View style={styles.section}>
          <Text style={styles.heading}>
            Address
          </Text>

          <View style={styles.detailRow}>
            <AppIcon
              name="location"
              size={18}
              color={colors.textMuted}
            />

            <Text style={styles.detailText}>
              {address}
            </Text>
          </View>
        </View>

        {/* Opening Hours */}
        <View style={styles.section}>
          <Text style={styles.heading}>
            Opening Hours
          </Text>

          <View style={styles.detailRow}>
            <AppIcon
              name="clock"
              size={18}
              color={colors.textMuted}
            />

            <Text style={styles.detailText}>
              {hours}
            </Text>
          </View>
        </View>

        {/* Restaurant Photos */}
        <View style={styles.section}>
          <Text style={styles.heading}>
            Restaurant Photos
          </Text>

          <Text style={styles.description}>
            Share photos from your dining experience.
            Submitted photos may require approval
            before they become public.
          </Text>

          <PhotoUploadButton
            restaurantId={restaurant._id}
          />
        </View>
      </ScrollView>
    </View>
  );
}

// =====================================================
// Styles
// =====================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  header: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },

  backButton: {
    width: 42,
    height: 42,
    justifyContent: "center",
    alignItems: "center",
  },

  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },

  headerSpacer: {
    width: 42,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: spacing.xxxl,
  },

  imageContainer: {
    position: "relative",
  },

  image: {
    width: "100%",
    height: 260,
    backgroundColor: colors.surfaceSecondary,
  },

  imageLabel: {
    position: "absolute",
    left: spacing.lg,
    bottom: spacing.md,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },

  imageLabelText: {
    fontSize: 11,
    color: colors.textSecondary,
  },

  mainInfo: {
    backgroundColor: colors.surface,
    padding: spacing.xl,
    marginBottom: spacing.md,
  },

  name: {
    ...typography.hero,
    color: colors.text,
    marginBottom: spacing.sm,
  },

  cuisine: {
    ...typography.body,
    color: colors.textSecondary,
    textTransform: "capitalize",
    marginBottom: spacing.lg,
  },

  metadata: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
  },

  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },

  rating: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 13,
  },

  priceBadge: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },

  priceText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },

  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },

  addressPreview: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },

  favoriteSection: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    alignItems: "flex-start",
  },

  section: {
    backgroundColor: colors.surface,
    padding: spacing.xl,
    marginBottom: spacing.md,
  },

  heading: {
    ...typography.section,
    color: colors.text,
    marginBottom: spacing.md,
  },

  text: {
    ...typography.body,
    color: colors.textSecondary,
  },

  description: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },

  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },

  detailText: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
  },

  menuButton: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },

  menuButtonText: {
    ...typography.button,
    color: colors.white,
    flexShrink: 1,
  },

  pressed: {
    opacity: 0.8,
  },
});