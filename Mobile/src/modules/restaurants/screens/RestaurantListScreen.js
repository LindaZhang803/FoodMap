import React, { useEffect, useMemo, useState } from "react";

import {
  View,
  Text,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Alert,
  Modal,
  StyleSheet,
} from "react-native";

import * as Location from "expo-location";

import { getRestaurants } from "../services/restaurantApi";
import RestaurantCard from "../components/RestaurantCard";
import RestaurantFilter from "../components/RestaurantFilter";

import {
  DEFAULT_FILTERS,
  filterRestaurants,
  getDistanceKm,
} from "../utils/restaurantFilters";

import {
  SORT_OPTIONS,
  sortRestaurants,
} from "../utils/restaurantSorting";

import {
  colors,
  spacing,
  radius,
  typography,
} from "../../../shared/design/tokens";

import {
  AppInput,
  LoadingState,
  EmptyState,
  ErrorState,
} from "../../../shared/design/UIComponents";

import AppIcon from "../../../shared/components/AppIcon";

const CUISINE_TABS = [
  { label: "All", value: "" },
  { label: "American", value: "american" },
  { label: "Chinese", value: "chinese" },
  { label: "Italian", value: "italian" },
  { label: "Japanese", value: "japanese" },
  { label: "Mexican", value: "mexican" },
  { label: "Other", value: "other" },
];

export default function RestaurantListScreen({
  onSelectRestaurant,
  toolbarAction,

  // Favorite integration
  isRestaurantFavorite,
  onToggleRestaurantFavorite,
  isRestaurantFavoriteLoading,
}) {
  const [restaurants, setRestaurants] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [filterVisible, setFilterVisible] = useState(false);
  const [sortBy, setSortBy] = useState("default");
  const [sortVisible, setSortVisible] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [applyingFilters, setApplyingFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Read location only if permission was already granted.
  // Do not automatically request new permission.

  useEffect(() => {
    let active = true;

    async function loadExistingLocation() {
      try {
        // Some Jest mocks do not provide this API.
        if (
          typeof Location.getForegroundPermissionsAsync !==
            "function" ||
          typeof Location.getCurrentPositionAsync !==
            "function"
        ) {
          return;
        }

        const permission =
          await Location.getForegroundPermissionsAsync();

        if (permission?.status !== "granted") {
          return;
        }

        const position =
          await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });

        if (!active) {
          return;
        }

        const latitude =
          position?.coords?.latitude;

        const longitude =
          position?.coords?.longitude;

        if (
          Number.isFinite(latitude) &&
          Number.isFinite(longitude) &&
          latitude >= -90 &&
          latitude <= 90 &&
          longitude >= -180 &&
          longitude <= 180
        ) {
          setUserLocation({
            latitude,
            longitude,
          });
        }
      } catch (error) {
        // Location is optional.
        // A location failure must not block restaurant browsing.
        if (__DEV__ && process.env.NODE_ENV !== "test") {
          console.warn(
            "Unable to load existing location:",
            error
          );
        }
      }
    }

    loadExistingLocation();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    fetchRestaurants();
  }, []);

  async function fetchRestaurants() {
    try {
      setLoading(true);
      setError(null);

      const data = await getRestaurants();

      if (!Array.isArray(data)) {
        throw new Error("Invalid restaurant data");
      }

      setRestaurants(data);
    } catch (err) {
      console.warn("Fetch restaurants error:", err);
      setError("Failed to load restaurants.");
    } finally {
      setLoading(false);
    }
  }

  function validateFilters(nextFilters) {
    const numericFields = [
      {
        label: "Minimum price",
        value: nextFilters.minPrice,
        allowZero: true,
      },
      {
        label: "Maximum price",
        value: nextFilters.maxPrice,
        allowZero: true,
      },
      {
        label: "Custom distance",
        value: nextFilters.customDistance,
        allowZero: false,
      },
    ];

    for (const field of numericFields) {
      const text = String(field.value ?? "").trim();

      if (text === "") continue;

      const number = Number(text);

      const invalid =
        !Number.isFinite(number) ||
        (field.allowZero ? number < 0 : number <= 0);

      if (invalid) {
        Alert.alert(
          "Invalid Input",
          field.allowZero
            ? `${field.label} must be zero or greater.`
            : `${field.label} must be greater than zero.`
        );
        return false;
      }
    }

    const minText = String(nextFilters.minPrice ?? "").trim();
    const maxText = String(nextFilters.maxPrice ?? "").trim();

    if (
      minText !== "" &&
      maxText !== "" &&
      Number(minText) > Number(maxText)
    ) {
      Alert.alert(
        "Invalid Price Range",
        "Minimum price cannot exceed maximum price."
      );
      return false;
    }

    return true;
  }

  async function requestUserLocation() {
    try {
      const permission =
        await Location.requestForegroundPermissionsAsync();

      if (permission.status !== "granted") {
        Alert.alert(
          "Location Required",
          "Please allow location access to use nearby restaurant features."
        );
        return null;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;

      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
      ) {
        throw new Error("Invalid location coordinates");
      }

      return { latitude, longitude };
    } catch (err) {
      console.warn("Location error:", err);
      Alert.alert(
        "Location Unavailable",
        "Unable to determine your location. Please check your location settings."
      );
      return null;
    }
  }

  async function applyFilters(nextFilters) {
    if (applyingFilters) return;
    if (!validateFilters(nextFilters)) return;

    setApplyingFilters(true);

    try {
      const customDistance = String(
        nextFilters.customDistance ?? ""
      ).trim();

      const needsLocation =
        nextFilters.distance != null ||
        customDistance !== "";

      if (needsLocation) {
        const location = await requestUserLocation();
        if (!location) return;
        setUserLocation(location);
      } 

      setFilters({
        ...nextFilters,
        minPrice: String(nextFilters.minPrice ?? "").trim(),
        maxPrice: String(nextFilters.maxPrice ?? "").trim(),
        customDistance,
      });

      setFilterVisible(false);
    } finally {
      setApplyingFilters(false);
    }
  }

  function changeCuisine(cuisine) {
    setFilters((previous) => ({
      ...previous,
      cuisine,
    }));
  }

  function resetAllFilters() {
    setSearchQuery("");

    setFilters({
      ...DEFAULT_FILTERS,
    });

    setSortBy("default");

    setFilterVisible(false);
    setSortVisible(false);
  }

  async function changeSorting(nextSort) {
    if (applyingFilters) return;

    if (nextSort === "nearest") {
      setApplyingFilters(true);

      try {
        const location = await requestUserLocation();
        if (!location) return;
        setUserLocation(location);
      } finally {
        setApplyingFilters(false);
      }
    }

    setSortBy(nextSort);
    setSortVisible(false);
  }

  async function findNearbyRestaurants() {
    if (applyingFilters) return;

    setApplyingFilters(true);

    try {
      const location = await requestUserLocation();
      if (!location) return;

      setUserLocation(location);
      setSortBy("nearest");
      setSortVisible(false);
    } finally {
      setApplyingFilters(false);
    }
  }

  function calculateRestaurantDistance(restaurant) {
    if (!userLocation) return null;

    const lat = Number(restaurant.latitude);
    const lon = Number(restaurant.longitude);

    const validCoordinates =
      restaurant.latitude != null &&
      restaurant.longitude != null &&
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      lat >= -90 &&
      lat <= 90 &&
      lon >= -180 &&
      lon <= 180;

    if (!validCoordinates) return null;

    return getDistanceKm(
      userLocation.latitude,
      userLocation.longitude,
      lat,
      lon
    );
  }

  const displayedRestaurants = useMemo(() => {
    const filtered = filterRestaurants(
      restaurants,
      searchQuery,
      filters,
      userLocation
    );

    return sortRestaurants(filtered, sortBy, userLocation);
  }, [restaurants, searchQuery, filters, sortBy, userLocation]);

  const hasPriceFilter =
    String(filters.minPrice ?? "").trim() !== "" ||
    String(filters.maxPrice ?? "").trim() !== "";

  const hasDistanceFilter =
    filters.distance != null ||
    String(filters.customDistance ?? "").trim() !== "";

  const activeFilterCount = [
    filters.cuisine !== "",
    hasPriceFilter,
    filters.minRating != null,
    hasDistanceFilter,
  ].filter(Boolean).length;

  const currentSortLabel =
    SORT_OPTIONS.find((option) => option.value === sortBy)?.label ||
    "Default";

  const listHeader = (
    <View>
      <View style={styles.discoverHeader}>
        <Text style={styles.discoverTitle}>Discover</Text>
        <Text style={styles.discoverSubtitle}>
          Find your next favorite restaurant
        </Text>
      </View>

      <View style={styles.searchRow}>
        <AppInput
          containerStyle={styles.searchContainer}
          style={styles.searchInput}
          leftIcon="search"
          placeholder="Search restaurants or cuisines..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
          accessibilityLabel="Search restaurants"
        />

        <Pressable
          style={styles.filterButton}
          onPress={() => setFilterVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Filter restaurants"
        >
          <AppIcon
            name="filter"
            size={18}
            color={colors.white}
          />

          <Text style={styles.filterText}>
            Filter
            {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.categoryContent}
        style={styles.categoryScroll}
      >
        {CUISINE_TABS.map((category) => {
          const selected = filters.cuisine === category.value;

          return (
            <Pressable
              key={category.label}
              style={[
                styles.categoryChip,
                selected && styles.categoryActive,
              ]}
              onPress={() => changeCuisine(category.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text
                style={[
                  styles.categoryText,
                  selected && styles.categoryTextActive,
                ]}
              >
                {category.label}
              </Text>
              
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.toolbar}>
        <View style={styles.toolbarActions}>
          <Pressable
            style={styles.nearMeButton}
            onPress={findNearbyRestaurants}
            disabled={applyingFilters}
            accessibilityRole="button"
          >
            <AppIcon
              name="nearby"
              size={17}
              color={colors.primary}
            />
            <Text style={styles.nearMeText}>Near Me</Text>
          </Pressable>

          {toolbarAction}
        </View>

        <Pressable
          style={styles.sortButton}
          onPress={() => setSortVisible(true)}
          accessibilityRole="button"
        >
          <AppIcon
            name="sort"
            size={16}
            color={colors.text}
          />
          <Text style={styles.sortText} numberOfLines={1}>
            {currentSortLabel}
          </Text>
          <AppIcon
            name="chevronDown"
            size={14}
            color={colors.textSecondary}
          />
        </Pressable>
      </View>

      {!loading && !error && (
        <View style={styles.resultRow}>
          <Text style={styles.resultCount}>
            {displayedRestaurants.length} restaurants found
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reset all filters"
            onPress={resetAllFilters}
            style={styles.resetButton}
          >
            <Text style={styles.resetText}>
              Reset All
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        style={styles.listView}
        data={loading || error ? [] : displayedRestaurants}
        keyExtractor={(item) => String(item._id)}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        ListHeaderComponent={listHeader}
        renderItem={({ item }) => {
          const restaurantId =
            String(item._id);

          const isFavorite =
            typeof isRestaurantFavorite === "function"
              ? isRestaurantFavorite(restaurantId)
              : false;

          const favoriteLoading =
            typeof isRestaurantFavoriteLoading === "function"
              ? isRestaurantFavoriteLoading(restaurantId)
              : false;

          return (
            <RestaurantCard
              restaurant={item}
              distanceKm={
                calculateRestaurantDistance(item)
              }
              compact
              onPress={() =>
                onSelectRestaurant?.(item)
              }
              isFavorite={isFavorite}
              favoriteLoading={favoriteLoading}
              onToggleFavorite={
                onToggleRestaurantFavorite
              }
            />
          );
        }}
        ListEmptyComponent={
          loading ? (
            <LoadingState
              message="Loading restaurants..."
              style={styles.state}
            />
          ) : error ? (
            <ErrorState
              title="Unable to load restaurants"
              message={error}
              onRetry={fetchRestaurants}
              style={styles.state}
            />
          ) : (
            <EmptyState
              title="No restaurants found"
              description={
                hasDistanceFilter
                  ? "No restaurants match your filters within the selected distance."
                  : "Try adjusting your search or filters."
              }
              style={styles.state}
            />
          )
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />

      <RestaurantFilter
        visible={filterVisible}
        filters={filters}
        onApply={applyFilters}
        onClose={() => {
          if (!applyingFilters) {
            setFilterVisible(false);
          }
        }}
      />

      <Modal
        visible={sortVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSortVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Sort Restaurants
            </Text>

            {SORT_OPTIONS.map((option) => {
              const selected = sortBy === option.value;

              return (
                <Pressable
                  key={option.value}
                  style={[
                    styles.sortOption,
                    selected && styles.selectedOption,
                  ]}
                  onPress={() => changeSorting(option.value)}
                  disabled={applyingFilters}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text
                    style={[
                      styles.sortOptionText,
                      selected && styles.selectedOptionText,
                    ]}
                  >
                    {option.label}
                  </Text>

                  {selected && (
                    <AppIcon
                      name="check"
                      size={20}
                      color={colors.primary}
                    />
                  )}
                </Pressable>
              );
            })}

            <Pressable
              style={styles.cancelButton}
              onPress={() => setSortVisible(false)}
            >
              <Text style={styles.cancelText}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {applyingFilters && (
        <View style={styles.locationOverlay}>
          <ActivityIndicator
            size="large"
            color={colors.primary}
          />
          <Text style={styles.locationText}>
            Getting location...
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.background,
  },
  listView: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxxl,
  },
  columnWrapper: {
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
  },
  discoverHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
  },
  discoverTitle: {
    ...typography.hero,
    color: colors.text,
  },
  discoverSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  searchContainer: {
    flex: 1,
    minWidth: 0,
    marginBottom: 0,
  },
  searchInput: {
    fontSize: 14,
  },
  filterButton: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.primary,
  },
  filterText: {
    ...typography.button,
    color: colors.white,
    fontSize: 13,
  },
  categoryScroll: {
    marginVertical: spacing.sm,
  },
  categoryContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  categoryActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  categoryTextActive: {
    color: colors.white,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  toolbarActions: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
    flexShrink: 1,
  },
  nearMeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
  },
  nearMeText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },
  sortButton: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
  },
  sortText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text,
  },
  resultCount: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  state: {
    minHeight: 240,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    padding: spacing.xxl,
    justifyContent: "center",
  },
  modalContent: {
    backgroundColor: colors.surface,
    padding: spacing.xl,
    borderRadius: radius.lg,
  },
  modalTitle: {
    ...typography.section,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  sortOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    borderRadius: radius.sm,
  },
  selectedOption: {
    backgroundColor: colors.primaryLight,
  },
  sortOptionText: {
    fontSize: 15,
    color: colors.text,
  },
  selectedOptionText: {
    fontWeight: "700",
    color: colors.primary,
  },
  cancelButton: {
    alignItems: "center",
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    marginTop: spacing.lg,
  },
  cancelText: {
    color: colors.text,
    fontWeight: "600",
  },
  locationOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    backgroundColor: "rgba(255,255,255,0.9)",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
  },
  locationText: {
    ...typography.body,
    color: colors.textSecondary,
  },

  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },

  resetButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },

  resetText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },
});