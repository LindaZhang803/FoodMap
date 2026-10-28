import React, { useState } from "react";
import { SafeAreaView, StyleSheet, View, Text, Pressable } from "react-native";

import DishBrowserScreen from "./src/modules/reviews/screens/DishBrowserScreen";

import RestaurantListScreen from "./src/modules/restaurants/screens/RestaurantListScreen";
import RestaurantDetailScreen from "./src/modules/restaurants/screens/RestaurantDetailScreen";

export default function App() {
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(null);

  const [dishBrowser, setDishBrowser] = useState(null);

  return (
    <SafeAreaView style={styles.container}>
      {__DEV__ && !dishBrowser && (
        <View style={{ padding: 12 }}>
          <Pressable accessibilityRole="button" onPress={() => setDishBrowser({ restaurantId: "100000000000000000000001", demo: true })}>
            <Text style={{ color: "#2563eb", padding: 10 }}>Open dish demo (no backend required)</Text>
          </Pressable>
        </View>
      )}
      {dishBrowser ? (
        <DishBrowserScreen
          key={`${dishBrowser.restaurantId}-${dishBrowser.demo}`}
          {...dishBrowser}
          onBack={() => setDishBrowser(null)}
        />
      ) : selectedRestaurantId ? (
        <RestaurantDetailScreen
          restaurantId={selectedRestaurantId}
          onViewDishes={() => setDishBrowser({ restaurantId: selectedRestaurantId, demo: false })}
          onPreviewDishes={() => setDishBrowser({ restaurantId: "100000000000000000000001", demo: true })}
          onBack={() => setSelectedRestaurantId(null)}
        />
      ) : (
        <RestaurantListScreen
          onSelectRestaurant={(restaurant) => {
            setSelectedRestaurantId(restaurant._id);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
});
