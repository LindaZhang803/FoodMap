import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createDishRepository,
} from "../../reviews/services/dishRepository";

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
  EmptyState,
} from "../../../shared/design/UIComponents";

import AppIcon from "../../../shared/components/AppIcon";

const MENU_CATEGORIES = [
  { label: "Popular", value: "popular" },
  { label: "Main Dishes", value: "main" },
  { label: "Appetizers", value: "appetizer" },
  { label: "Sides", value: "side" },
  { label: "Drinks", value: "drink" },
  { label: "Desserts", value: "dessert" },
];

function getDishCategory(dish) {
  const raw = String(
    dish.category ??
    dish.dishCategory ??
    dish.type ??
    ""
  )
    .trim()
    .toLowerCase();

  if (!raw) return "uncategorized";

  if (
    ["main", "main dish", "main dishes", "entree", "entrée", "entrees", "mains"]
      .includes(raw)
  ) {
    return "main";
  }

  if (
    ["appetizer", "appetizers", "starter", "starters"]
      .includes(raw)
  ) {
    return "appetizer";
  }

  if (
    ["side", "sides", "side dish", "side dishes"]
      .includes(raw)
  ) {
    return "side";
  }

  if (
    ["drink", "drinks", "beverage", "beverages"]
      .includes(raw)
  ) {
    return "drink";
  }

  if (
    ["dessert", "desserts"]
      .includes(raw)
  ) {
    return "dessert";
  }

  return "uncategorized";
}

function getDishRating(dish) {
  const count = Number(dish.reviewCount);

  const rating = Number(dish.averageRating);

  if (
    !Number.isFinite(count) ||
    count <= 0 ||
    dish.averageRating == null ||
    !Number.isFinite(rating)
  ) {
    return "No ratings yet";
  }

  return `★ ${rating.toFixed(1)} (${count})`;
}

function getDishPrice(dish) {
  if (
    dish.price == null ||
    dish.price === ""
  ) {
    return null;
  }

  const price = Number(dish.price);

  if (
    !Number.isFinite(price) ||
    price < 0
  ) {
    return null;
  }

  return `$${price.toFixed(2)}`;
}

function MenuDishImage({ uri }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  if (!uri || failed) {
    return (
      <View style={styles.dishImageFallback}>
        <Text style={styles.dishImageFallbackText}>
          Photo unavailable
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={styles.dishImage}
      resizeMode="cover"
      accessibilityLabel="Dish photo"
      onError={() => setFailed(true)}
    />
  );
}

// =====================================================
// Restaurant Detail Screen
// =====================================================

export default function RestaurantDetailScreen({
  restaurantId,
  onBack,
  onViewDishes,
  renderRestaurantActions,

  distanceKm = null,

  isDishFavorite,
  onToggleDishFavorite,
  isDishFavoriteLoading,
}) {
  const [restaurant, setRestaurant] = useState(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState(null);

  const [imageError, setImageError] = useState(false);

  const [retry, setRetry] = useState(0);

  // =====================================================
  // Menu State
  // =====================================================

  const [dishes, setDishes] = useState([]);

  const [menuLoading, setMenuLoading] = useState(true);

  const [menuError, setMenuError] = useState(null);

  const [menuRetry, setMenuRetry] = useState(0);

  const [selectedCategory, setSelectedCategory] =
    useState("popular");

  const dishRepository = useMemo(
    () =>
      createDishRepository({
        origin: API_ORIGIN,
      }),
    []
  );

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
  // Load Restaurant Menu
  // =====================================================

  useEffect(() => {
    let active = true;

    async function loadMenu() {
      setMenuLoading(true);
      setMenuError(null);
      setDishes([]);
      setSelectedCategory("popular");

      if (!restaurantId) {
        setMenuLoading(false);
        return;
      }

      try {
        const result =
          await dishRepository.getDishes(
            restaurantId,
            "name"
          );

        if (!active) return;

        if (!Array.isArray(result)) {
          throw new Error("Invalid menu response");
        }

        setDishes(result);
      } catch (err) {
        if (!active) return;

        setMenuError(
          err instanceof Error
            ? err.message
            : "Unable to load menu"
        );
      } finally {
        if (active) {
          setMenuLoading(false);
        }
      }
    }

    loadMenu();

    return () => {
      active = false;
    };
  }, [
    restaurantId,
    dishRepository,
    menuRetry,
  ]);

  // =====================================================
  // Menu Filtering
  // =====================================================

  const sortedDishes = useMemo(() => {
    return [...dishes].sort((a, b) => {
      const reviewDifference =
        (Number(b.reviewCount) || 0) -
        (Number(a.reviewCount) || 0);

      if (reviewDifference !== 0) {
        return reviewDifference;
      }

      const ratingDifference =
        (Number(b.averageRating) || 0) -
        (Number(a.averageRating) || 0);

      if (ratingDifference !== 0) {
        return ratingDifference;
      }

      return String(a.name || "").localeCompare(
        String(b.name || "")
      );
    });
  }, [dishes]);

  const visibleDishes = useMemo(() => {
    if (selectedCategory === "popular") {
      return sortedDishes;
    }

    return sortedDishes.filter(
      (dish) =>
        getDishCategory(dish) === selectedCategory
    );
  }, [
    sortedDishes,
    selectedCategory,
  ]);

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

  const distanceText =
    typeof distanceKm === "number" &&
    Number.isFinite(distanceKm) &&
    distanceKm >= 0
      ? distanceKm < 1
        ? `${Math.round(distanceKm * 1000)} m`
        : `${distanceKm.toFixed(1)} km`
      : "Distance unavailable";

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

          <View style={styles.addressRow}>
            <AppIcon
              name="location"
              size={16}
              color={colors.textMuted}
            />

            <Text style={styles.addressPreview}>
              {distanceText}
            </Text>
          </View>

          {/* Favorite Button */}
          {favoriteAction && (
            <View style={styles.favoriteSection}>
              {favoriteAction}
            </View>
          )}
        </View>

        {/* ==============================================
            Restaurant Menu
        ============================================== */}

        <View style={styles.menuContainer}>
          <View style={styles.menuHeader}>
            <Text style={styles.heading}>
              Restaurant Menu
            </Text>

            <Text style={styles.menuSubtitle}>
              Explore dishes from this restaurant.
            </Text>
          </View>

          {/* Menu Categories */}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRow}
          >
            {MENU_CATEGORIES.map((category) => {
              const selected =
                selectedCategory === category.value;

              return (
                <Pressable
                  key={category.value}
                  accessibilityRole="button"
                  accessibilityLabel={category.label}
                  accessibilityState={{ selected }}
                  onPress={() =>
                    setSelectedCategory(category.value)
                  }
                  style={[
                    styles.categoryButton,
                    selected && styles.activeCategoryButton,
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      selected && styles.activeCategoryText,
                    ]}
                  >
                    {category.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Menu Loading */}

          {menuLoading ? (
            <LoadingState
              message="Loading restaurant menu..."
            />
          ) : menuError ? (
            <ErrorState
              title="Unable to load menu"
              message={menuError}
              onRetry={() =>
                setMenuRetry((current) => current + 1)
              }
            />
          ) : dishes.length === 0 ? (
            <EmptyState
              title="No dishes available"
              description="No dishes have been added for this restaurant yet."
            />
          ) : (
            <View style={styles.dishList}>
              {/* Category Result Count */}

              <Text style={styles.dishCount}>
                {visibleDishes.length} dishes
              </Text>

              {visibleDishes.length === 0 ? (
                <Text style={styles.emptyCategoryText}>
                  No dishes available in this category.
                </Text>
              ) : (
                visibleDishes.map((dish) => {
                  const dishId = dish.id;

                  const saved =
                    typeof isDishFavorite === "function"
                      ? isDishFavorite(dishId)
                      : false;

                  const saving =
                    typeof isDishFavoriteLoading === "function"
                      ? isDishFavoriteLoading(dishId)
                      : false;

                  const hasFavoriteAction =
                    typeof onToggleDishFavorite === "function";

                  const priceText = getDishPrice(dish);

                  const spice =
                    dish.spicinessLevel ??
                    dish.spiciness ??
                    null;

                  return (
                    <View
                      key={String(dishId)}
                      style={styles.menuDishCard}
                    >
                      {/* Dish Details Navigation */}

                      <Pressable
                        style={styles.dishMain}
                        accessibilityRole="button"
                        accessibilityLabel={`View ${dish.name}`}
                        onPress={() =>
                          onViewDishes?.(dishId, restaurant.name)
                        }
                      >
                        <View style={styles.dishImageWrapper}>
                          <MenuDishImage
                            uri={dish.imageUrl}
                          />
                        </View>

                        <View style={styles.dishInformation}>
                          <Text
                            style={styles.dishName}
                            numberOfLines={2}
                          >
                            {dish.name}
                          </Text>

                          <Text
                            style={styles.dishDescription}
                            numberOfLines={2}
                          >
                            {dish.description ||
                              "Description unavailable"}
                          </Text>

                          {priceText !== null && (
                            <Text style={styles.dishPrice}>
                              {priceText}
                            </Text>
                          )}

                          <Text style={styles.dishRating}>
                            {getDishRating(dish)}
                          </Text>

                          {spice !== null && spice !== "" && (
                            <Text style={styles.dishSpice}>
                              Spiciness: {String(spice)}
                            </Text>
                          )}
                        </View>
                      </Pressable>

                      {/* Dish Favorites */}

                      <View style={styles.dishActions}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={
                            saved
                              ? `Remove ${dish.name} from Want to Try`
                              : `Add ${dish.name} to Want to Try`
                          }
                          accessibilityState={{
                            selected: saved,
                            disabled:
                              !hasFavoriteAction || saving,
                          }}
                          disabled={
                            !hasFavoriteAction || saving
                          }
                          onPress={() =>
                            onToggleDishFavorite?.(dish)
                          }
                          style={styles.dishFavoriteButton}
                        >
                          <Text style={styles.dishFavoriteText}>
                            {saved ? "♥" : "♡"}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
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

    menuContainer: {
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
    paddingBottom: spacing.lg,
  },

  menuHeader: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },

  menuSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },

  categoryRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },

  categoryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  activeCategoryButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  categoryText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },

  activeCategoryText: {
    color: colors.white,
  },

  dishList: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },

  dishCount: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },

  emptyCategoryText: {
    ...typography.body,
    color: colors.textMuted,
    paddingVertical: spacing.xl,
    textAlign: "center",
  },

  menuDishCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
    overflow: "hidden",
  },

  dishMain: {
    flexDirection: "row",
    padding: spacing.md,
    alignItems: "center",
  },

  dishImageWrapper: {
    width: 110,
    height: 110,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surfaceSecondary,
  },

  dishImage: {
    width: "100%",
    height: "100%",
  },

  dishImageFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.sm,
  },

  dishImageFallbackText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
  },

  dishInformation: {
    flex: 1,
    minWidth: 0,
    paddingLeft: spacing.md,
  },

  dishName: {
    ...typography.cardTitle,
    color: colors.text,
    marginBottom: spacing.xs,
  },

  dishDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },

  dishPrice: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.xs,
  },

  dishRating: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "700",
  },

  dishSpice: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  dishActions: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: "flex-end",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },

  dishFavoriteButton: {
    width: 44,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  dishFavoriteText: {
    fontSize: 28,
    color: colors.primary,
  },
});
