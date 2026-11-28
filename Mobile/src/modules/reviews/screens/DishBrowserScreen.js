import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  StyleSheet,
} from "react-native";

import { API_ORIGIN } from "../../../config/api";

import {
  resolveCatalogImageUrl,
} from "../../feed/services/liveSources";

import {
  getDishImageSource,
} from "../../../assets/images/dishes/dishImages";

import {
  createDishRepository,
} from "../services/dishRepository";

import SpicinessCompatibility, {
  describeSpicinessCompatibility,
  SpicinessCompatibilityNote,
} from "../../../shared/components/SpicinessCompatibility";

import fixtures from "../mocks/fixtures.json";

import {
  createReviewRepository,
} from "../services/reviewRepository";

import ReviewPanel from "../components/ReviewPanel";

import {
  colors,
  spacing,
  radius,
  typography,
} from "../../../shared/design/tokens";

import {
  LoadingState,
  EmptyState,
  ErrorState,
} from "../../../shared/design/UIComponents";

// =====================================================
// Sorting
// =====================================================

const SORT_OPTIONS = [
  ["name", "Name"],
  ["highestRated", "Highest Rated"],
  ["mostReviewed", "Most Reviewed"],
];

// =====================================================
// Overall Rating
// =====================================================

function getRatingText(dish) {
  if (
    dish?.averageRating == null ||
    !Number.isFinite(Number(dish.averageRating))
  ) {
    return "No ratings yet";
  }

  const average = Number(dish.averageRating);
  const count = Number(dish.reviewCount) || 0;

  return `${average.toFixed(1)} / 5 · ${count} reviews`;
}

// =====================================================
// Price
// =====================================================

function getPriceText(dish) {
  const raw = dish?.price;

  if (raw == null || raw === "") {
    return "Price unavailable";
  }

  const price = Number(raw);

  if (!Number.isFinite(price) || price < 0) {
    return "Price unavailable";
  }

  return `$${price.toFixed(2)}`;
}

// =====================================================
// Median Spiciness
// =====================================================

function getMedianSpiciness(dish) {
  const value =
    dish?.medianSpiciness ??
    dish?.spicinessMedian;

  if (
    value == null ||
    value === "" ||
    !Number.isFinite(Number(value))
  ) {
    return null;
  }

  return Number(value);
}

// =====================================================
// Spiciness Distribution
// Backend format:
// {
//   level1: 0,
//   level2: 0,
//   level3: 0,
//   level4: 0,
//   level5: 0
// }
// =====================================================

function getSpicinessDistribution(dish) {
  const distribution = dish?.spicinessDistribution;

  if (
    !distribution ||
    typeof distribution !== "object" ||
    Array.isArray(distribution)
  ) {
    return [];
  }

  const ratings = [1, 2, 3, 4, 5].map((level) => {
    const raw = distribution[`level${level}`];

    return {
      level,
      count: Number(raw ?? 0),
    };
  });

  const valid = ratings.every(
    ({ count }) =>
      Number.isInteger(count) &&
      count >= 0
  );

  if (!valid) {
    return [];
  }

  const total = ratings.reduce(
    (sum, item) => sum + item.count,
    0
  );

  if (total === 0) {
    return [];
  }

  return ratings;
}

// =====================================================
// Dish Image
// =====================================================

function DishImage({
  uri,
  apiOrigin = API_ORIGIN,
  large = false,
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri, apiOrigin]);

  const source = getDishImageSource(
    uri,
    apiOrigin,
    resolveCatalogImageUrl
  );

  if (!source || failed) {
    return (
      <View
        style={[
          styles.placeholder,
          large && styles.largeImage,
        ]}
      >
        <Text style={styles.placeholderText}>
          Photo unavailable
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={source}
      style={[
        styles.image,
        large && styles.largeImage,
      ]}
      resizeMode="cover"
      onError={() => setFailed(true)}
      accessibilityLabel="Dish photo"
    />
  );
}

// =====================================================
// Dish Browser Screen
// =====================================================

export default function DishBrowserScreen({
  restaurantId,
  onBack,
  initialDishId = null,

  restaurantName = null,

  isDishFavorite,
  onToggleDishFavorite,
  isDishFavoriteLoading,

  onAddDishToWheel,

  demo = false,
  token = null,
  apiOrigin = API_ORIGIN,
  syntheticSession = false,

  authToken = null,
  isAuthenticated = false,
  onLoginPress,
}) {
  const [dishId, setDishId] = useState(initialDishId);

  const [resource, setResource] = useState(null);

  const [scenario, setScenario] = useState("normal");
  const [dishSort, setDishSort] = useState("name");
  const [retry, setRetry] = useState(0);

  const [ratingUpdate, setRatingUpdate] = useState(null);

  useEffect(() => {
    setDishId(initialDishId);
    setRatingUpdate(null);
  }, [restaurantId, initialDishId]);

  // =====================================================
  // Authentication
  // =====================================================

  const reviewToken = demo
    ? token
    : syntheticSession
      ? token
      : isAuthenticated && authToken
        ? authToken
        : token;

  // =====================================================
  // Repositories
  // =====================================================

  const liveRepository = useMemo(
    () =>
      createDishRepository({
        origin: apiOrigin,
        token: reviewToken,
      }),
    [apiOrigin, reviewToken]
  );

  const demoFixtures = useMemo(
    () => JSON.parse(JSON.stringify(fixtures)),
    []
  );

  const demoRepository = useMemo(
    () =>
      createDishRepository({
        fixtures: demoFixtures,
      }),
    [demoFixtures]
  );

  const reviewRepository = useMemo(
    () =>
      createReviewRepository({
        origin: apiOrigin,
        fixtures: demo ? demoFixtures : null,
      }),
    [demo, demoFixtures, apiOrigin]
  );

  const repository = demo
    ? demoRepository
    : liveRepository;

  // =====================================================
  // Target Restaurant
  // =====================================================

  const targetRestaurant =
    demo && scenario === "unrated"
      ? "100000000000000000000002"
      : restaurantId;

  const requestKey = [
    targetRestaurant,
    dishId || "list",
    scenario,
    retry,
    demo,
    dishSort,
  ].join(":");

  const currentResource =
    resource?.key === requestKey &&
    resource.repository === repository
      ? resource
      : null;

  const data = currentResource?.data ?? null;
  const error = currentResource?.error ?? null;

  // =====================================================
  // Load Dishes
  // =====================================================

  useEffect(() => {
    let active = true;

    async function load() {
      if (demo && scenario === "error") {
        throw new Error(
          "Simulated connection failure. Select Normal to restore the demo."
        );
      }

      if (demo && scenario === "empty") {
        return [];
      }

      return dishId
        ? repository.getDish(dishId)
        : repository.getDishes(
            targetRestaurant,
            dishSort
          );
    }

    load()
      .then((result) => {
        if (active) {
          setResource({
            key: requestKey,
            repository,
            data: result,
            error: null,
          });
        }
      })
      .catch((err) => {
        if (active) {
          setResource({
            key: requestKey,
            repository,
            data: null,
            error:
              err.message ||
              "Unable to load dishes.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [
    repository,
    targetRestaurant,
    dishId,
    scenario,
    demo,
    dishSort,
    requestKey,
  ]);

  // =====================================================
  // Navigation
  // =====================================================

  function handleBack() {
    if (dishId) {
      setDishId(null);
      setRatingUpdate(null);
    } else {
      onBack?.();
    }
  }

  // =====================================================
  // Review Statistics Update
  // =====================================================

  function handleReviewCreated(target, statistics) {
    if (target?.dishId) {
      setRatingUpdate({
        dishId: target.dishId,
        statistics,
      });

      // Reload dish data so the card, median,
      // distribution and compatibility stay in sync.
      setRetry((current) => current + 1);
    }
  }

  // =====================================================
  // Header
  // =====================================================

  const header = (
    <View style={styles.header}>
      <Pressable
        onPress={handleBack}
        style={styles.backButton}
        accessibilityRole="button"
        accessibilityLabel={
          dishId
            ? "Back to dish list"
            : "Back to restaurant"
        }
      >
        <Text style={styles.backText}>
          ←
        </Text>
      </Pressable>

      <Text style={styles.headerTitle}>
        {dishId
          ? "Dish Details"
          : "Restaurant Menu"}
      </Text>

      <View style={styles.headerSpacer} />
    </View>
  );

  // =====================================================
  // Demo Controls
  // =====================================================

  const demoContent = (
    <>
      {syntheticSession && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            Synthetic MongoDB demo — reviews are saved
            to a test database. This is not a real menu.
          </Text>
        </View>
      )}

      {demo && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            Demo only — synthetic dishes and reviews,
            not this restaurant's menu.
          </Text>
        </View>
      )}

      {demo && (
        <View style={styles.demoOptions}>
          {[
            "normal",
            "unrated",
            "empty",
            "error",
          ].map((value) => {
            const selected = scenario === value;

            return (
              <Pressable
                key={value}
                style={[
                  styles.chip,
                  selected && styles.activeChip,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  setDishId(null);
                  setScenario(value);
                }}
              >
                <Text
                  style={[
                    styles.chipText,
                    selected && styles.activeChipText,
                  ]}
                >
                  {value}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </>
  );

  // =====================================================
  // Reviews
  // =====================================================

  const reviewContent = (
    <View style={styles.reviewSection}>
      <ReviewPanel
        key={`${targetRestaurant}:${dishId || "restaurant"}`}
        restaurantId={targetRestaurant}
        dishId={dishId}
        repository={reviewRepository}
        token={reviewToken}
        demo={demo}
        origin={apiOrigin}
        syntheticSession={syntheticSession}
        onLoginPress={onLoginPress}
        onCreated={handleReviewCreated}
      />
    </View>
  );

  // =====================================================
  // Effective Dish Statistics
  // =====================================================

  // Keep the latest review statistics visible immediately
  // after creating, editing or deleting a review.
  const detailDish =
    dishId &&
    data &&
    !Array.isArray(data) &&
    ratingUpdate?.dishId === data.id &&
    ratingUpdate.statistics
      ? {
          ...data,
          ...ratingUpdate.statistics,
        }
      : data;

  // =====================================================
  // Render
  // =====================================================

  return (
    <View style={styles.container}>
      {header}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        {demoContent}

        {error ? (
          <ErrorState
            title="Unable to load dishes"
            message={error}
            onRetry={() =>
              setRetry((current) => current + 1)
            }
            style={styles.state}
          />
        ) : data === null ? (
          <LoadingState
            message="Loading dishes..."
            style={styles.state}
          />
        ) : dishId ? (
          <>
            {/* Dish Details */}

            <View style={styles.heroImageContainer}>
              <DishImage
                uri={detailDish.imageUrl}
                apiOrigin={apiOrigin}
                large
              />
            </View>

            <View style={styles.detailCard}>
              {/* Dish Name */}

              <Text style={styles.dishTitle}>
                {detailDish.name}
              </Text>

              {/* Restaurant Name */}

              <Text style={styles.restaurantName}>
                {restaurantName ||
                  detailDish.restaurantName ||
                  detailDish.restaurant?.name ||
                  "Restaurant name unavailable"}
              </Text>

              {/* Price */}

              <Text style={styles.dishPrice}>
                {getPriceText(detailDish)}
              </Text>

              {/* Overall Rating */}

              <View style={styles.statisticsSection}>
                <Text style={styles.statisticsTitle}>
                  Overall Rating
                </Text>

                <Text style={styles.overallRating}>
                  {getRatingText(detailDish)}
                </Text>
              </View>

              {/* Median Spiciness */}

              <View style={styles.statisticsSection}>
                <Text style={styles.statisticsTitle}>
                  Median Spiciness
                </Text>

                <Text style={styles.spicinessValue}>
                  {getMedianSpiciness(detailDish) !== null
                    ? `${getMedianSpiciness(detailDish)} / 5`
                    : "Spiciness data unavailable"}
                </Text>

                <SpicinessCompatibility
                  dish={detailDish}
                  showNote
                />
              </View>

              {/* Spiciness Distribution */}

              <View style={styles.statisticsSection}>
                <Text style={styles.statisticsTitle}>
                  Spiciness Distribution
                </Text>

                {getSpicinessDistribution(detailDish)
                  .length === 0 ? (
                  <Text style={styles.unavailableText}>
                    No spiciness ratings yet
                  </Text>
                ) : (
                  getSpicinessDistribution(
                    detailDish
                  ).map(({ level, count }) => (
                    <View
                      key={level}
                      style={styles.distributionRow}
                    >
                      <Text
                        style={styles.distributionLabel}
                      >
                        Level {level}
                      </Text>

                      <Text
                        style={styles.distributionCount}
                      >
                        {count} reviews
                      </Text>
                    </View>
                  ))
                )}
              </View>

              {/* Description */}

              <View style={styles.statisticsSection}>
                <Text style={styles.sectionTitle}>
                  About This Dish
                </Text>

                <Text style={styles.description}>
                  {detailDish.description ||
                    "Description unavailable"}
                </Text>
              </View>

              {/* Favorite and Wheel Actions */}

              <View style={styles.dishActionRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add dish to Want to Try"
                  disabled={
                    typeof onToggleDishFavorite !== "function" ||
                    Boolean(
                      isDishFavoriteLoading?.(
                        detailDish.id
                      )
                    )
                  }
                  onPress={() =>
                    onToggleDishFavorite?.(detailDish)
                  }
                  style={styles.dishActionButton}
                >
                  <Text style={styles.dishActionText}>
                    {isDishFavorite?.(detailDish.id)
                      ? "♥ Saved"
                      : "♡ Want to Try"}
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add dish to Wheel"
                  disabled={
                    typeof onAddDishToWheel !== "function"
                  }
                  onPress={() =>
                    onAddDishToWheel?.(detailDish)
                  }
                  style={styles.dishActionButton}
                >
                  <Text style={styles.dishActionText}>
                    Add to Wheel
                  </Text>
                </Pressable>
              </View>
            </View>

            {reviewContent}
          </>
        ) : (
          <>
            {/* Dish List Introduction */}

            <View style={styles.intro}>
              <Text style={styles.title}>
                Explore Dishes
              </Text>

              <Text style={styles.subtitle}>
                Discover food and read customer reviews.
              </Text>
            </View>

            {/* Sorting */}

            <View style={styles.sortRow}>
              {SORT_OPTIONS.map(([value, label]) => {
                const selected = dishSort === value;

                return (
                  <Pressable
                    key={value}
                    style={[
                      styles.chip,
                      selected && styles.activeChip,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() =>
                      setDishSort(value)
                    }
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selected && styles.activeChipText,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Dish Cards */}

            <View style={styles.menuSection}>
              <Text style={styles.sectionTitle}>
                Menu
              </Text>

              <SpicinessCompatibilityNote
                dishes={data}
              />

              {data.length === 0 ? (
                <EmptyState
                  title="No dishes available"
                  description="No dishes have been added for this restaurant yet."
                  style={styles.state}
                />
              ) : (
                data.map((dish) => (
                  <Pressable
                    key={dish.id}
                    style={styles.dishCard}
                    accessibilityRole="button"
                    accessibilityLabel={[
                      `View ${dish.name}`,
                      describeSpicinessCompatibility(
                        dish
                      ),
                    ]
                      .filter(Boolean)
                      .join(". ")}
                    onPress={() => {
                      setDishId(dish.id);
                      setRatingUpdate(null);
                    }}
                  >
                    <View style={styles.thumbnail}>
                      <DishImage
                        uri={dish.imageUrl}
                        apiOrigin={apiOrigin}
                      />
                    </View>

                    <View style={styles.dishInfo}>
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
                          "View dish details"}
                      </Text>

                      <Text style={styles.dishRating}>
                        {getRatingText(dish)}
                      </Text>

                      <SpicinessCompatibility
                        dish={dish}
                      />
                    </View>

                    <Text style={styles.arrow}>
                      ›
                    </Text>
                  </Pressable>
                ))
              )}
            </View>

            {reviewContent}
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
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  header: {
    height: 54,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  backButton: {
    width: 42,
    height: 42,
    justifyContent: "center",
    alignItems: "center",
  },

  backText: {
    fontSize: 26,
    color: colors.text,
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

  content: {
    paddingBottom: spacing.xxxl,
  },

  intro: {
    padding: spacing.xl,
    backgroundColor: colors.surface,
  },

  title: {
    ...typography.title,
    color: colors.text,
  },

  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },

  sortRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.surface,
  },

  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  activeChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },

  activeChipText: {
    color: colors.white,
  },

  menuSection: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    marginTop: spacing.md,
  },

  sectionTitle: {
    ...typography.section,
    color: colors.text,
    marginBottom: spacing.lg,
  },

  dishCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.sm,
    marginBottom: spacing.md,
    minHeight: 116,
  },

  thumbnail: {
    width: 106,
    height: 106,
    borderRadius: radius.md,
    overflow: "hidden",
  },

  image: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.surfaceSecondary,
  },

  placeholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.sm,
  },

  placeholderText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
  },

  dishInfo: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: spacing.md,
  },

  dishName: {
    ...typography.cardTitle,
    color: colors.text,
    marginBottom: spacing.sm,
  },

  dishDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },

  dishRating: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "700",
  },

  arrow: {
    fontSize: 26,
    color: colors.primary,
    paddingHorizontal: spacing.sm,
  },

  heroImageContainer: {
    height: 280,
  },

  largeImage: {
    height: 280,
  },

  detailCard: {
    backgroundColor: colors.surface,
    padding: spacing.xl,
    marginBottom: spacing.md,
  },

  dishTitle: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.md,
  },

  detailRating: {
    ...typography.body,
    color: colors.primary,
    fontWeight: "700",
    marginBottom: spacing.xl,
  },

  description: {
    ...typography.body,
    color: colors.textSecondary,
  },

  reviewSection: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    marginTop: spacing.md,
  },

  notice: {
    backgroundColor: colors.warningLight,
    margin: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
  },

  noticeText: {
    ...typography.caption,
    color: "#854D0E",
  },

  demoOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },

  state: {
    minHeight: 220,
  },

  restaurantName: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },

  dishPrice: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.primary,
    marginBottom: spacing.lg,
  },

  statisticsSection: {
    marginBottom: spacing.xl,
  },

  statisticsTitle: {
    ...typography.section,
    color: colors.text,
    marginBottom: spacing.sm,
  },

  overallRating: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.primary,
  },

  spicinessValue: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },

  unavailableText: {
    ...typography.body,
    color: colors.textMuted,
  },

  distributionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  distributionLabel: {
    ...typography.body,
    color: colors.text,
  },

  distributionCount: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  dishActionRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.md,
  },

  dishActionButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
  },

  dishActionText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
    textAlign: "center",
  },
});