import React, { useState } from "react";

import {
  View,
  Text,
  StyleSheet,
} from "react-native";

import DishBrowserScreen from "./src/modules/reviews/screens/DishBrowserScreen";

import RestaurantListScreen from "./src/modules/restaurants/screens/RestaurantListScreen";

import RestaurantDetailScreen from "./src/modules/restaurants/screens/RestaurantDetailScreen";

import AppIcon from "./src/shared/components/AppIcon";

import {
  colors,
  spacing,
  typography,
} from "./src/shared/design/tokens";

// =====================================================
// Restaurant Browser
// =====================================================

export default function RestaurantBrowser({
  toolbarAction,

  mode = "explore",

  token = null,
  isAuthenticated = false,
  onLoginPress,

  // Favorite integration
  isRestaurantFavorite,
  onToggleRestaurantFavorite,
  isRestaurantFavoriteLoading,
}) {
  const [
    selectedRestaurantId,
    setSelectedRestaurantId,
  ] = useState(null);

  const [
    dishBrowser,
    setDishBrowser,
  ] = useState(null);

  const createMode =
    mode === "create";

  // =====================================================
  // 1. Open Restaurant
  // =====================================================

  function openRestaurant(restaurant) {
    if (!restaurant?._id) {
      return;
    }

    const id = restaurant._id;

    setSelectedRestaurantId(id);

    if (createMode) {
      // Create directly enters the existing
      // dish and review workflow.
      setDishBrowser({
        restaurantId: id,
        demo: false,
      });
    } else {
      setDishBrowser(null);
    }
  }

  // =====================================================
  // 2. Open Dishes
  // =====================================================
  function openDishes(
    dishId = null,
    restaurantName = null
  ) {
    if (!selectedRestaurantId) return;

    setDishBrowser({
      restaurantId: selectedRestaurantId,
      dishId,
      restaurantName,
      demo: false,
    });
  }

  // =====================================================
  // 3. Back Navigation
  // =====================================================

  function backFromDishes() {
    setDishBrowser(null);

    // Create returns to restaurant selection.
    if (createMode) {
      setSelectedRestaurantId(null);
    }
  }

  function backFromRestaurant() {
    setSelectedRestaurantId(null);
    setDishBrowser(null);
  }

  // =====================================================
  // 4. Render Create Header
  // =====================================================

  function renderCreateHeader() {
    if (!createMode) {
      return null;
    }

    if (
      selectedRestaurantId ||
      dishBrowser
    ) {
      return null;
    }

    return (
      <View style={styles.createHeader}>
        <View style={styles.createTitleRow}>
          <AppIcon
            name="edit"
            size={22}
            color={colors.primary}
          />

          <Text style={styles.createTitle}>
            Create a Review
          </Text>
        </View>

        <Text style={styles.createDescription}>
          Choose a restaurant to write a review
          or share your experience with a dish.
        </Text>
      </View>
    );
  }

  // =====================================================
  // 5. Render
  // =====================================================

  return (
    <View style={styles.container}>
      {renderCreateHeader()}

      {dishBrowser ? (
        <DishBrowserScreen
          initialDishId={dishBrowser.dishId ?? null}
          key={dishBrowser.restaurantId}
          restaurantId={
            dishBrowser.restaurantId
          }
          demo={false}
          token={token}
          authToken={token}
          isAuthenticated={
            isAuthenticated
          }
          onLoginPress={
            onLoginPress
          }
          restaurantName={dishBrowser.restaurantName}
          onBack={backFromDishes}
        />
      ) : selectedRestaurantId ? (
        <RestaurantDetailScreen
          restaurantId={
            selectedRestaurantId
          }
          onViewDishes={
            openDishes
          }
          onBack={
            backFromRestaurant
          }
        />
      ) : (
        <RestaurantListScreen
          toolbarAction={toolbarAction}
          onSelectRestaurant={openRestaurant}
          isRestaurantFavorite={
            isRestaurantFavorite
          }
          onToggleRestaurantFavorite={
            onToggleRestaurantFavorite
          }
          isRestaurantFavoriteLoading={
            isRestaurantFavoriteLoading
          }
        />
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
    backgroundColor: colors.background,
  },

  createHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,

    backgroundColor: colors.surface,

    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  createTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },

  createTitle: {
    ...typography.section,
    color: colors.text,
  },

  createDescription: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
});