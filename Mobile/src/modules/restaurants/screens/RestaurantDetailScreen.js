import React, { useEffect, useState } from "react";

import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";

import getRestaurantImage from "../utils/getRestaurantImage";
import PhotoUploadButton from "../components/PhotoUploadButton";

// Use the same backend address as restaurantApi.js
import { API_ORIGIN } from "../../../config/api";

export default function RestaurantDetailScreen({
  restaurantId,
  onBack,
}) {
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadRestaurant() {
      setLoading(true);
      setError(null);
      setImageError(false);
      setRestaurant(null);

      try {
        const response = await fetch(
          `${API_ORIGIN}/api/restaurants/${restaurantId}`
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
        if (active) {
          setError(err.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadRestaurant();

    return () => {
      active = false;
    };
  }, [restaurantId]);

  // Fixed header (shared by all states)
  const header = (
    <View style={styles.header}>
      <Pressable
        style={styles.headerBackButton}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back to restaurants"
      >
        <Text style={styles.headerBackText}>← Back</Text>
      </Pressable>

      <Text style={styles.headerTitle}>
        Restaurant Details
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {header}

        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text>Loading restaurant...</Text>
        </View>
      </View>
    );
  }

  if (error || !restaurant) {
    return (
      <View style={styles.container}>
        {header}

        <View style={styles.center}>
          <Text style={styles.error}>
            {error || "Restaurant unavailable"}
          </Text>
        </View>
      </View>
    );
  }

  const imageSource = imageError
    ? getRestaurantImage({ ...restaurant, imageUrl: null })
    : getRestaurantImage(restaurant);

  const description =
    restaurant.description?.trim() || "Description unavailable";

  const address =
    restaurant.address?.trim() || "Address unavailable";

  const cuisine =
    restaurant.cuisineType?.trim() || "Cuisine unavailable";

  const price =
    restaurant.priceRange || "Price unavailable";

  const rating =
    restaurant.rating == null || restaurant.reviewCount === 0
      ? "No ratings yet"
      : `${restaurant.rating} / 5`;

  const hours =
    restaurant.openingHours?.trim() || "Hours unavailable";

  return (
    <View style={styles.container}>
      {/* Fixed Back Button */}
      {header}

      {/* Scrollable Restaurant Details */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <Image
          source={imageSource}
          style={styles.image}
          resizeMode="cover"
          onError={() => setImageError(true)}
        />

        <View style={styles.content}>
          <Text style={styles.name}>
            {restaurant.name}
          </Text>

          <Text style={styles.cuisine}>
            {cuisine}
          </Text>

          <Text style={styles.rating}>
            {rating}
          </Text>

          <View style={styles.section}>
            <Text style={styles.heading}>
              Description
            </Text>
            <Text style={styles.text}>
              {description}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.heading}>
              Address
            </Text>
            <Text style={styles.text}>
              {address}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.heading}>
              Price Range
            </Text>
            <Text style={styles.text}>
              {price}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.heading}>
              Opening Hours
            </Text>
            <Text style={styles.text}>
              {hours}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.heading}>
              Restaurant Photos
            </Text>

            <PhotoUploadButton
              restaurantId={restaurant._id}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },

  // Fixed header
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    paddingHorizontal: 16,
  },

  headerBackButton: {
    paddingVertical: 10,
    paddingRight: 16,
  },

  headerBackText: {
    color: "#2563eb",
    fontSize: 16,
    fontWeight: "600",
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 8,
    color: "#222222",
  },

  // Scrollable content
  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: 30,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  error: {
    color: "#dc2626",
    fontSize: 16,
    marginBottom: 16,
  },

  image: {
    width: "100%",
    height: 240,
  },

  content: {
    padding: 20,
  },

  name: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
  },

  cuisine: {
    fontSize: 16,
    color: "#666",
    marginBottom: 8,
  },

  rating: {
    fontSize: 16,
    marginBottom: 20,
  },

  section: {
    marginBottom: 24,
  },

  heading: {
    fontSize: 19,
    fontWeight: "bold",
    marginBottom: 8,
  },

  text: {
    fontSize: 15,
    color: "#555",
    lineHeight: 23,
  },
});