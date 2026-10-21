import React, { useState, useEffect, useMemo } from "react";

import {
  View,
  Text,
  TextInput,
  FlatList,
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
} from "../utils/restaurantFilters";

import {
  SORT_OPTIONS,
  sortRestaurants,
} from "../utils/restaurantSorting";

export default function RestaurantListScreen({
  onSelectRestaurant,
}) {
  // Restaurant data
  const [restaurants, setRestaurants] = useState([]);

  // Search
  const [searchQuery, setSearchQuery] = useState("");

  // Filters
  const [filters, setFilters] = useState({
    ...DEFAULT_FILTERS,
  });

  const [filterVisible, setFilterVisible] = useState(false);

  // Sorting
  const [sortBy, setSortBy] = useState("default");
  const [sortVisible, setSortVisible] = useState(false);

  // Location
  const [userLocation, setUserLocation] = useState(null);
  const [applyingFilters, setApplyingFilters] = useState(false);

  // Loading and errors
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // =====================================================
  // 1. Load restaurants
  // =====================================================

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
      console.error("Fetch restaurants error:", err);
      setError("Failed to load restaurants.");
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // 2. Validate numeric inputs
  // =====================================================

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

      if (text === "") {
        continue;
      }

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

    const minText = String(
      nextFilters.minPrice ?? ""
    ).trim();

    const maxText = String(
      nextFilters.maxPrice ?? ""
    ).trim();

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

  // =====================================================
  // 3. Get user location
  // =====================================================

  async function requestUserLocation() {
    const permission =
      await Location.requestForegroundPermissionsAsync();

    if (permission.status !== "granted") {
      Alert.alert(
        "Location Required",
        "Please allow location access to use distance features."
      );

      return null;
    }

    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
    } catch (err) {
      console.error("Location error:", err);

      Alert.alert(
        "Location Unavailable",
        "Unable to determine your location. Check your simulator location settings."
      );

      return null;
    }
  }

  // =====================================================
  // 4. Apply filters
  // =====================================================

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

        if (!location) {
          return;
        }

        setUserLocation(location);
      } else if (sortBy !== "nearest") {
        setUserLocation(null);
      }

      setFilters({
        ...nextFilters,
        minPrice: String(
          nextFilters.minPrice ?? ""
        ).trim(),
        maxPrice: String(
          nextFilters.maxPrice ?? ""
        ).trim(),
        customDistance,
      });

      setFilterVisible(false);
    } finally {
      setApplyingFilters(false);
    }
  }

  // =====================================================
  // 5. Change sorting
  // =====================================================

  async function changeSorting(nextSort) {
    if (applyingFilters) return;

    // Nearest sorting requires current location.
    if (nextSort === "nearest") {
      setApplyingFilters(true);

      try {
        const location = await requestUserLocation();

        if (!location) {
          return;
        }

        setUserLocation(location);
      } finally {
        setApplyingFilters(false);
      }
    }

    setSortBy(nextSort);
    setSortVisible(false);
  }

  // =====================================================
  // 6. Search + Filter + Sort
  // =====================================================

  const displayedRestaurants = useMemo(() => {
    const filtered = filterRestaurants(
      restaurants,
      searchQuery,
      filters,
      userLocation
    );

    return sortRestaurants(
      filtered,
      sortBy,
      userLocation
    );
  }, [
    restaurants,
    searchQuery,
    filters,
    sortBy,
    userLocation,
  ]);

  // =====================================================
  // 7. Count active filters
  // =====================================================

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
    SORT_OPTIONS.find((option) => option.value === sortBy)
      ?.label || "Default";

  // =====================================================
  // 8. Render
  // =====================================================

  return (
    <View style={styles.container}>

      {/* Search */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search restaurants..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />

        <Pressable
          style={styles.filterButton}
          onPress={() => setFilterVisible(true)}
        >
          <Text style={styles.filterText}>
            Filter
            {activeFilterCount > 0
              ? ` (${activeFilterCount})`
              : ""}
          </Text>
        </Pressable>
      </View>

      {/* Sort button + result count */}
      <View style={styles.toolbar}>
        <Text style={styles.resultCount}>
          {!loading && !error
            ? `${displayedRestaurants.length} restaurants found`
            : ""}
        </Text>

        <Pressable
          style={styles.sortButton}
          onPress={() => setSortVisible(true)}
        >
          <Text style={styles.sortButtonText}>
            Sort: {currentSortLabel} ▾
          </Text>
        </Pressable>
      </View>

      {/* Restaurant list */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />

          <Text style={styles.loadingText}>
            Loading restaurants...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>

          <Pressable
            style={styles.retryButton}
            onPress={fetchRestaurants}
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={displayedRestaurants}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <RestaurantCard
              restaurant={item}
              onPress={() => onSelectRestaurant(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>
                No restaurants match your search or filters.
              </Text>
            </View>
          }
          contentContainerStyle={
            displayedRestaurants.length === 0
              ? styles.emptyContainer
              : styles.list
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      )}

      {/* Filter modal */}
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

      {/* Sorting modal */}
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
                  onPress={() =>
                    changeSorting(option.value)
                  }
                  disabled={applyingFilters}
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
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </Pressable>
              );
            })}

            <Pressable
              style={styles.closeButton}
              onPress={() => setSortVisible(false)}
            >
              <Text style={styles.closeText}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Location loading */}
      {applyingFilters && (
        <View style={styles.locationLoading}>
          <ActivityIndicator size="large" />

          <Text style={styles.applyingText}>
            Getting location...
          </Text>
        </View>
      )}
    </View>
  );
}

// =====================================================
// Styles
// =====================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },

  searchRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },

  searchInput: {
    flex: 1,
    minWidth: 0,
    height: 46,
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#ddd",
    fontSize: 15,
  },

  filterButton: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#2563eb",
    paddingHorizontal: 14,
    borderRadius: 10,
    minHeight: 46,
  },

  filterText: {
    color: "#fff",
    fontWeight: "600",
  },

  toolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },

  resultCount: {
    flexShrink: 1,
    color: "#666",
    fontSize: 13,
  },

  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: "#e8eefc",
  },

  sortButtonText: {
    color: "#2563eb",
    fontSize: 13,
    fontWeight: "600",
  },

  list: {
    padding: 16,
    paddingBottom: 30,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  loadingText: {
    marginTop: 12,
    color: "#666",
  },

  errorText: {
    color: "#dc2626",
    textAlign: "center",
    marginBottom: 16,
  },

  retryButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },

  retryText: {
    color: "#fff",
    fontWeight: "600",
  },

  emptyText: {
    color: "#666",
    textAlign: "center",
  },

  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 24,
  },

  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
  },

  sortOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
  },

  selectedOption: {
    backgroundColor: "#eef3ff",
  },

  sortOptionText: {
    fontSize: 16,
    color: "#333",
  },

  selectedOptionText: {
    color: "#2563eb",
    fontWeight: "600",
  },

  checkmark: {
    color: "#2563eb",
    fontSize: 18,
  },

  closeButton: {
    marginTop: 16,
    padding: 14,
    borderRadius: 10,
    backgroundColor: "#eee",
    alignItems: "center",
  },

  closeText: {
    fontWeight: "600",
  },

  locationLoading: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(255,255,255,0.85)",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    zIndex: 10,
  },

  applyingText: {
    color: "#555",
    fontSize: 15,
  },
});