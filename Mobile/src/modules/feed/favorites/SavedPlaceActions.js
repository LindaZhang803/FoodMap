import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

export default function SavedPlaceActions({ restaurant, dish, savedPlaces }) {
  const name = dish ? dish.name : restaurant.name;
  const isSaved = dish
    ? savedPlaces.favoriteDishes.some(saved => saved.dishId === dish.dishId)
    : savedPlaces.favorites.some(saved => saved._id === restaurant._id);
  const label = isSaved ? 'Remove favorite' : 'Save to Want to Try';

  function toggle() {
    if (dish) {
      savedPlaces.toggleFavoriteDish(dish);
    } else {
      savedPlaces.toggleFavorite(restaurant);
    }
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isSaved ? `Remove ${name} from Want to Try` : `Save ${name} to Want to Try`}
      onPress={toggle}
      style={({ pressed }) => [styles.button, isSaved && styles.saved, pressed && styles.pressed]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#b8cbb7',
    backgroundColor: '#fff',
  },
  saved: { backgroundColor: '#e5eee1' },
  pressed: { opacity: 0.7 },
  label: { color: '#31563c', fontWeight: '600', fontSize: 13 },
});
