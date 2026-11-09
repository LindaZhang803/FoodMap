import React, { useState } from "react";
import { SafeAreaView, StyleSheet, View, Text, Pressable, Alert, Platform } from "react-native";

import DishBrowserScreen from "./src/modules/reviews/screens/DishBrowserScreen";

import RestaurantListScreen from "./src/modules/restaurants/screens/RestaurantListScreen";
import RestaurantDetailScreen from "./src/modules/restaurants/screens/RestaurantDetailScreen";

export default function App({ toolbarAction }) {
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(null);

  const [dishBrowser, setDishBrowser] = useState(null);

  const [openingDemo, setOpeningDemo] = useState(false);
  async function openLiveDemo() {
    if (openingDemo) return;
    setOpeningDemo(true);
    const apiOrigin = Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://127.0.0.1:3001';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(`${apiOrigin}/api/demo/session`, { signal: controller.signal });
      if (!response.ok) throw new Error('Demo unavailable');
      const session = await response.json();
      setDishBrowser({ restaurantId: session.restaurantId, token: session.token, apiOrigin, demo: false, syntheticSession: true });
    } catch { Alert.alert('Local demo unavailable', 'Run npm run demo:reviews from backend, then try again. This demo uses synthetic MongoDB data.'); }
    finally { clearTimeout(timeout); setOpeningDemo(false); }
  }

  return (
    <SafeAreaView style={styles.container}>
      {__DEV__ && !dishBrowser && !selectedRestaurantId && (
        <View style={{ padding: 12 }}>
          <Pressable accessibilityRole="button" onPress={() => setDishBrowser({ restaurantId: "100000000000000000000001", demo: true })}>
            <Text style={{ color: "#2563eb", padding: 10 }}>Open dish demo (no backend required)</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={openingDemo} onPress={openLiveDemo}><Text style={{ color: '#2563eb', padding: 10 }}>{openingDemo ? 'Opening…' : 'Open synthetic MongoDB review demo'}</Text></Pressable>
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
          toolbarAction={toolbarAction}
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
