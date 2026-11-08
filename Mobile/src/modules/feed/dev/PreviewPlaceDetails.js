import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SavedPlaceActions } from '../favorites';
import { MOCK_DISHES } from '../mocks/fixtures';
import dishPhotos from './dishPhotos';

export default function PreviewPlaceDetails({ restaurant, dishId, savedPlaces, onDishPress, onBack }) {
  const dishes = MOCK_DISHES.filter(dish => dish.restaurantId === restaurant._id);
  const dish = dishes.find(item => item.dishId === dishId);
  const photo = dish && dishPhotos[dish.dishId];

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} accessibilityRole="button">
        <Text style={styles.link}>‹ Back</Text>
      </Pressable>
      {photo && <Image source={photo} style={styles.photo} resizeMode="cover" accessibilityLabel={dish.name} />}
      <Text style={styles.title} accessibilityRole="header">{dish ? dish.name : restaurant.name}</Text>
      {dish ? (
        <>
          <Text style={styles.secondary}>{restaurant.name}</Text>
          <Text style={styles.secondary}>
            {dish.reviewCount ? `${dish.averageRating.toFixed(1)} / 5 · ${dish.reviewCount} reviews` : 'No ratings yet'}
          </Text>
          <SavedPlaceActions dish={dish} savedPlaces={savedPlaces} />
        </>
      ) : (
        <>
          <Text style={styles.secondary}>{restaurant.cuisineType} · {restaurant.priceRange}</Text>
          <Text style={styles.secondary}>{restaurant.address}</Text>
          <SavedPlaceActions restaurant={restaurant} savedPlaces={savedPlaces} />
          <View style={styles.menu}>
            <Text style={styles.subheading} accessibilityRole="header">Dishes</Text>
            {dishes.length === 0 && <Text style={styles.secondary}>Dish recommendation unavailable</Text>}
            {dishes.map(item => (
              <Pressable key={item.dishId} accessibilityRole="button" style={styles.menuItem}
                onPress={() => onDishPress(item.dishId, restaurant._id)}>
                <Text style={styles.link}>{item.name} ›</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', gap: 12, padding: 20 },
  photo: { height: 200, width: '100%', borderRadius: 12 },
  title: { fontSize: 28, fontWeight: '700', color: '#213b2b' },
  subheading: { fontSize: 18, fontWeight: '700', color: '#213b2b' },
  secondary: { fontSize: 15, color: '#57675b' },
  link: { color: '#31563c', fontSize: 15, fontWeight: '700', paddingVertical: 8 },
  menu: { gap: 8 },
  menuItem: { paddingHorizontal: 12, backgroundColor: '#e6ece3', borderRadius: 8 },
});
