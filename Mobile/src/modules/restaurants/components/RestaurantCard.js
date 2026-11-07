import React, { useState, useEffect } from "react";

import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
} from "react-native";

import getRestaurantImage from "../utils/getRestaurantImage";

export default function RestaurantCard({
  restaurant,
  onPress,
  distanceKm = null,
}) {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [restaurant.imageUrl, restaurant._id]);

  // Restaurant image
  const imageSource = imageError
    ? getRestaurantImage({
        ...restaurant,
        imageUrl: null,
      })
    : getRestaurantImage(restaurant);

  // Rating
  const rating =
    restaurant.rating == null || restaurant.reviewCount === 0
      ? "No ratings yet"
      : `Rating: ${restaurant.rating}`;

  // Address
  const address =
    restaurant.address?.trim() || "Address unavailable";

  // Cuisine
  const cuisine =
    restaurant.cuisineType?.trim() || "Cuisine unavailable";

  // Price
  const price =
    restaurant.priceRange?.trim() || "Price unavailable";

  // Distance
  const distanceText =
    typeof distanceKm === "number" &&
    Number.isFinite(distanceKm) &&
    distanceKm >= 0
      ? distanceKm < 1
        ? `${Math.round(distanceKm * 1000)} m away`
        : `${distanceKm.toFixed(1)} km away`
      : null;

  return (
    <Pressable style={styles.card} onPress={onPress}>
      {/* Restaurant image */}
      <Image
        source={imageSource}
        style={styles.image}
        resizeMode="cover"
        onError={() => setImageError(true)}
      />

      <View style={styles.info}>
        {/* Restaurant name */}
        <Text style={styles.name}>
          {restaurant.name}
        </Text>

        {/* Rating */}
        <Text style={styles.rating}>
          {rating}
        </Text>

        {/* Distance */}
        {distanceText !== null && (
          <Text style={styles.distance}>
            {distanceText}
          </Text>
        )}

        {/* Address */}
        <Text style={styles.address}>
          {address}
        </Text>

        {/* Cuisine and price */}
        <Text style={styles.details}>
          {cuisine} | {price}
        </Text>

        {/* Image attribution */}
        {!restaurant.imageUrl && (
          <Text style={styles.imageNote}>
            Cuisine illustration
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
    elevation: 3,
  },

  image: {
    width: "100%",
    height: 180,
  },

  info: {
    padding: 16,
  },

  name: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },

  rating: {
    fontSize: 16,
    marginBottom: 6,
  },

  distance: {
    fontSize: 14,
    color: "#2563eb",
    fontWeight: "600",
    marginBottom: 6,
  },

  address: {
    fontSize: 14,
    color: "#666",
    marginBottom: 6,
  },

  details: {
    fontSize: 14,
    color: "#444",
  },

  imageNote: {
    fontSize: 11,
    color: "#999",
    marginTop: 8,
  },
});