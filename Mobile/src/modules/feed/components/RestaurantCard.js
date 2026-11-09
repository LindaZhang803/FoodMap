// Receives restaurant object, and renders it.

import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

export default function RestaurantCard({
  restaurant,
  recommendedDish,
  preferenceScore,
  dishImageSource,
  onPress,
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const dishId = recommendedDish?.dishId;
  const imageUrl = recommendedDish?.imageUrl;
  const photo = dishImageSource ?? (imageUrl ? { uri: imageUrl } : null);
  // Saved restaurant cards omit the recommendation. Feed entries use null when unavailable.
  const showRecommendation = recommendedDish !== undefined;
  const recommendationLabel = preferenceScore == null
    ? 'Popular dish'
    : `${Math.round(preferenceScore)}% taste similarity`;

  useEffect(() => {
    setImageFailed(false);
  }, [dishId, imageUrl, dishImageSource]);

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `Open restaurant ${restaurant.name}` : undefined}
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {showRecommendation && (
        photo && !imageFailed ? (
          <Image
            source={photo}
            style={styles.hero}
            resizeMode="cover"
            onError={() => setImageFailed(true)}
            accessibilityLabel={recommendedDish?.name || restaurant.name}
            testID={`dish-image:${dishId}`}
          />
        ) : (
          <View style={[styles.hero, styles.placeholder]} accessibilityLabel="Dish photo unavailable">
            <View style={styles.circle}>
              <Text style={styles.monogram}>{restaurant.name.slice(0, 1)}</Text>
            </View>
            <Text style={styles.photoLabel}>Dish photo unavailable</Text>
          </View>
        )
      )}
      <View style={styles.info}>
        <Text style={styles.name}>{restaurant.name}</Text>
        <Text style={styles.rating}>
          {restaurant.rating != null && restaurant.reviewCount > 0
            ? `Rating ${restaurant.rating.toFixed(1)}`
            : 'No ratings yet'}
        </Text>
        <Text style={styles.details}>{restaurant.address || 'Address unavailable'}</Text>
        <Text style={styles.details}>
          {restaurant.cuisineType || 'Cuisine unavailable'} | {restaurant.priceRange || 'Price unavailable'}
        </Text>
        {showRecommendation && (
          <Text style={styles.pick}>
            {recommendedDish
              ? `${recommendationLabel} · ${recommendedDish.name}`
              : 'Dish recommendation unavailable'}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.75 },
  hero: { width: '100%', height: 180 },
  placeholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#eaf0ff', gap: 12 },
  circle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#dbe5ff', alignItems: 'center', justifyContent: 'center' },
  monogram: { fontSize: 34, color: '#2563eb', fontWeight: '500' },
  photoLabel: { fontSize: 12, color: '#666' },
  info: { padding: 16, gap: 6 },
  name: { fontSize: 20, fontWeight: 'bold', color: '#222', marginBottom: 2 },
  rating: { fontSize: 16, color: '#222', fontWeight: '400' },
  pick: { fontSize: 14, lineHeight: 21, color: '#2563eb', fontWeight: '600' },
  details: { fontSize: 14, lineHeight: 20, color: '#666' },
});
