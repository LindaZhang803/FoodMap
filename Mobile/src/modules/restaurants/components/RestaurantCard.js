import React, { useState, useEffect } from "react";

import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
} from "react-native";

import getRestaurantImage from "../utils/getRestaurantImage";

export default function RestaurantCard({ restaurant, onPress, }) {

  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [restaurant.imageUrl, restaurant._id]);

  const imageSource = imageError
    ? getRestaurantImage({
        ...restaurant,
        imageUrl: null
      })
    : getRestaurantImage(restaurant);

  const rating =
    restaurant.rating == null || restaurant.reviewCount === 0
      ? "No ratings yet"
      : `Rating: ${restaurant.rating}`;

  const address =
    restaurant.address?.trim() || "Address unavailable";

  const cuisine =
    restaurant.cuisineType?.trim() || "Cuisine unavailable";

  const price =
    restaurant.priceRange?.trim() || "Price unavailable";

  return (
    <Pressable style={styles.card} onPress={onPress}>

      <Image
        source={imageSource}
        style={styles.image}
        resizeMode="cover"
        onError={() => setImageError(true)}
      />

      <View style={styles.info}>

        <Text style={styles.name}>
          {restaurant.name}
        </Text>

        <Text style={styles.rating}>
          {rating}
        </Text>

        <Text style={styles.address}>
          {address}
        </Text>

        <Text style={styles.details}>
          {cuisine} | {price}
        </Text>

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
    elevation: 3
  },

  image: {
    width: "100%",
    height: 180
  },

  info: {
    padding: 16
  },

  name: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8
  },

  rating: {
    fontSize: 16,
    marginBottom: 6
  },

  address: {
    fontSize: 14,
    color: "#666",
    marginBottom: 6
  },

  details: {
    fontSize: 14,
    color: "#444"
  },

  imageNote: {
    fontSize: 11,
    color: "#999",
    marginTop: 8
  }
});