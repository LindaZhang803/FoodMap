import React, {
  useCallback,
  useState,
} from "react";

import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";

import * as Location from "expo-location";

import FoodPostGrid from "../components/FoodPostGrid";

import usePostFeed from "../hooks/usePostFeed";

import {
  setPostLike,
} from "../services/postApi";

import {
  colors,
  spacing,
  radius,
  typography,
} from "../../../shared/design/tokens";

import {
  AppButton,
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../../shared/design/UIComponents";

import AppIcon from "../../../shared/components/AppIcon";

// =====================================================
// Categories
// =====================================================

const CATEGORIES = [
  {
    id: "forYou",
    label: "For You",
    icon: "discover",
  },
  {
    id: "nearby",
    label: "Nearby",
    icon: "location",
  },
  {
    id: "trending",
    label: "Trending",
    icon: "star",
  },
];

// =====================================================
// Post Feed Screen
// =====================================================

export default function PostFeedScreen({
  token = null,
  onPostPress,
  onLoginRequired,
}) {
  const feed = usePostFeed({
    token,
    pageSize: 12,
  });

  const [likingIds, setLikingIds] =
    useState([]);

  const [locating, setLocating] =
    useState(false);

  const [locationError, setLocationError] =
    useState(null);

  // =====================================================
  // Location
  // =====================================================

const requestLocation = useCallback(
  async () => {
    if (locating) return;

    setLocating(true);
    setLocationError(null);

    try {
      // 1. Check device location services.
      const enabled =
        await Location.hasServicesEnabledAsync();

      if (!enabled) {
        throw new Error("LOCATION_SERVICES_DISABLED");
      }

      // 2. Request permission.
      const permission =
        await Location.requestForegroundPermissionsAsync();

      if (permission.status !== "granted") {
        throw new Error("LOCATION_PERMISSION_DENIED");
      }

      // 3. Try to get current location.
      let position;

      try {
        position =
          await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
      } catch {
        // 4. Fall back to recent cached location.
        position =
          await Location.getLastKnownPositionAsync({
            maxAge: 5 * 60 * 1000,
            requiredAccuracy: 2000,
          });

        if (!position) {
          throw new Error("LOCATION_UNAVAILABLE");
        }
      }

      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;

      // 5. Validate coordinates.
      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        throw new Error("LOCATION_UNAVAILABLE");
      }

      // 6. Update Nearby feed.
      feed.updateLocation({
        latitude,
        longitude,
      });
    } catch (error) {
      if (
        error.message === "LOCATION_SERVICES_DISABLED"
      ) {
        setLocationError(
          "Location Services are disabled. Please enable them in Settings."
        );
      } else if (
        error.message === "LOCATION_PERMISSION_DENIED"
      ) {
        setLocationError(
          "Location permission was denied. Please allow FoodMap to access your location."
        );
      } else {
        setLocationError(
          "Unable to determine your location. If you are using an iOS Simulator, select a simulated location and try again."
        );
      }

      console.warn(
        "Nearby location error:",
        error
      );
    } finally {
      setLocating(false);
    }
  },
  [feed.updateLocation, locating]
);

  // =====================================================
  // Category Selection
  // =====================================================

  function selectCategory(category) {
    if (
      feed.category === category
    ) {
      return;
    }

    feed.setCategory(category);

    if (
      category === "nearby" &&
      !feed.location
    ) {
      requestLocation();
    }
  }

  // =====================================================
  // Like
  // =====================================================

  async function handleLike(post) {
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

    if (likingIds.includes(post.id)) {
      return;
    }

    setLikingIds((current) => [
      ...current,
      post.id,
    ]);

    try {
      const result = await setPostLike(
        post.id,
        !post.likedByMe,
        token
      );

      feed.updatePost({
        id: post.id,
        likedByMe: result.likedByMe,
        likeCount: result.likeCount,
      });
    } catch (error) {
      Alert.alert(
        "Unable to update like",
        error instanceof Error
          ? error.message
          : "Please try again."
      );
    } finally {
      setLikingIds((current) =>
        current.filter(
          (id) => id !== post.id
        )
      );
    }
  }

  // =====================================================
  // Load More
  // =====================================================

  function handleScroll(event) {
    const {
      layoutMeasurement,
      contentOffset,
      contentSize,
    } = event.nativeEvent;

    const remaining =
      contentSize.height -
      (
        layoutMeasurement.height +
        contentOffset.y
      );

    if (remaining < 350) {
      feed.loadMore();
    }
  }

  // =====================================================
  // Category Header
  // =====================================================

  const categoryHeader = (
    <View style={styles.categoryContainer}>
      {CATEGORIES.map((category) => {
        const selected =
          feed.category === category.id;

        return (
          <Pressable
            key={category.id}
            accessibilityRole="tab"
            accessibilityLabel={
              category.label
            }
            accessibilityState={{
              selected,
            }}
            onPress={() =>
              selectCategory(category.id)
            }
            style={({ pressed }) => [
              styles.category,
              selected &&
                styles.selectedCategory,
              pressed &&
                styles.pressed,
            ]}
          >
            <AppIcon
              name={category.icon}
              size={17}
              color={
                selected
                  ? colors.primary
                  : colors.textSecondary
              }
            />

            <Text
              style={[
                styles.categoryText,
                selected &&
                  styles.selectedCategoryText,
              ]}
            >
              {category.label}
            </Text>

            {selected && (
              <View
                style={styles.categoryIndicator}
              />
            )}
          </Pressable>
        );
      })}
    </View>
  );

  // =====================================================
  // Nearby Requires Location
  // =====================================================

  const locationRequired =
    feed.category === "nearby" &&
    !feed.location;

  // =====================================================
  // Render
  // =====================================================

  return (
    <View style={styles.screen}>
      {categoryHeader}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={200}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={feed.refreshing}
            onRefresh={feed.refresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {locationRequired ? (
          <View style={styles.locationState}>
            <AppIcon
              name="location"
              size={44}
              color={colors.primary}
            />

            <Text style={styles.stateTitle}>
              Discover Food Near You
            </Text>

            <Text style={styles.stateDescription}>
              Allow location access to see posts
              from nearby restaurants.
            </Text>

            {locationError && (
              <Text style={styles.errorText}>
                {locationError}
              </Text>
            )}

            <AppButton
              title={
                locating
                  ? "Getting Location..."
                  : "Use My Location"
              }
              icon="location"
              loading={locating}
              disabled={locating}
              onPress={requestLocation}
              style={styles.locationButton}
            />
          </View>
        ) : feed.loading ? (
          <LoadingState
            message="Loading food posts..."
            style={styles.state}
          />
        ) : feed.error &&
          feed.posts.length === 0 ? (
          <ErrorState
            title="Unable to Load Posts"
            message={feed.error}
            onRetry={feed.refresh}
            style={styles.state}
          />
        ) : feed.posts.length === 0 ? (
          <EmptyState
            title="No Food Posts Yet"
            description={
              feed.category === "nearby"
                ? "No public posts were found near your location."
                : "Be the first to share a food experience."
            }
            style={styles.state}
          />
        ) : (
          <>
            <FoodPostGrid
              posts={feed.posts}
              onPostPress={onPostPress}
              onLikePress={handleLike}
              likingIds={likingIds}
            />

            {feed.loadingMore && (
              <View style={styles.loadingMore}>
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                />

                <Text style={styles.loadingText}>
                  Loading more posts...
                </Text>
              </View>
            )}

            {feed.error && (
              <View style={styles.paginationError}>
                <Text style={styles.errorText}>
                  {feed.error}
                </Text>

                <AppButton
                  title="Retry"
                  variant="secondary"
                  icon="retry"
                  onPress={feed.loadMore}
                />
              </View>
            )}

            {!feed.hasMore &&
              !feed.loadingMore && (
                <Text style={styles.endText}>
                  You're all caught up.
                </Text>
              )}
          </>
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

  categoryContainer: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.sm,
  },

  category: {
    flex: 1,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    position: "relative",
  },

  selectedCategory: {
    backgroundColor: colors.surface,
  },

  categoryText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "600",
  },

  selectedCategoryText: {
    color: colors.primary,
    fontWeight: "700",
  },

  categoryIndicator: {
    position: "absolute",
    bottom: 0,
    width: 34,
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },

  pressed: {
    opacity: 0.75,
  },

  scrollView: {
    flex: 1,
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
  },

  state: {
    minHeight: 300,
  },

  locationState: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
    minHeight: 320,
    gap: spacing.md,
  },

  stateTitle: {
    ...typography.section,
    color: colors.text,
    textAlign: "center",
  },

  stateDescription: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
  },

  locationButton: {
    marginTop: spacing.md,
    minWidth: 180,
  },

  errorText: {
    ...typography.caption,
    color: colors.error,
    textAlign: "center",
  },

  loadingMore: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },

  loadingText: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  paginationError: {
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },

  endText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: spacing.xxl,
  },
});