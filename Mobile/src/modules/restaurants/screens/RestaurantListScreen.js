import { getRestaurants } from "../services/restaurantApi";

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet
} from "react-native";

import RestaurantCard from "../components/RestaurantCard";

export default function RestaurantListScreen({onSelectRestaurant,}) {

  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
		console.error(err);
		setError("Failed to load restaurants.");
	} finally {
		setLoading(false);
	}
}

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={restaurants}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
         <RestaurantCard
            restaurant={item}
            onPress={() => onSelectRestaurant(item)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text>No restaurants available.</Text>
          </View>
        }
        contentContainerStyle={
          restaurants.length === 0
            ? styles.emptyContainer
            : styles.list
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5"
  },

  list: {
    padding: 16
  },

  center: {
    alignItems: "center",
    justifyContent: "center"
  },

  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center"
  }
});