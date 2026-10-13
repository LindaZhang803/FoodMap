import React, { useState } from "react";
import { SafeAreaView, StyleSheet } from "react-native";

import RestaurantListScreen from "./src/modules/restaurants/screens/RestaurantListScreen";
import RestaurantDetailScreen from "./src/modules/restaurants/screens/RestaurantDetailScreen";

export default function App() {
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(null);

  return (
    <SafeAreaView style={styles.container}>
      {selectedRestaurantId ? (
        <RestaurantDetailScreen
          restaurantId={selectedRestaurantId}
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
