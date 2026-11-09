import React from "react";

import {
  StyleSheet,
  View,
} from "react-native";

import RestaurantCard from "./RestaurantCard";

import {
  colors,
  spacing,
  radius,
} from "../../../shared/design/tokens";

/**
 * Renders one ranked restaurant entry.
 *
 * The host owns ranking, navigation,
 * and saved-place actions.
 */
export default function FeedRestaurantItem({
  entry,
  RestaurantCardComponent = RestaurantCard,
  onRestaurantPress,
  renderRestaurantActions,
}) {
  const restaurant = entry.restaurant;

  function openRestaurant() {
    if (
      typeof onRestaurantPress === "function"
    ) {
      onRestaurantPress(entry.restaurantId);
    }
  }

  return (
    <View
      style={styles.item}
      testID={`feed-item:${entry.restaurantId}`}
    >
      <RestaurantCardComponent
        restaurant={restaurant}
        recommendedDish={entry.recommendedDish}
        preferenceScore={entry.preferenceScore}
        onPress={
          onRestaurantPress
            ? openRestaurant
            : undefined
        }
      />

      {renderRestaurantActions && (
        <View style={styles.actions}>
          {renderRestaurantActions(
            restaurant
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: "hidden",
  },

  actions: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
});