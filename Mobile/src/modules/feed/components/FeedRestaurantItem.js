// receives 1 entry containing restaurant, dish & score to render resturant card

import React from 'react';
import { StyleSheet, View } from 'react-native';
import RecommendedDishPreview from './RecommendedDishPreview';

/** RestaurantCardComponent is the host's imported Member 1 card, without copied JSX. */
export default function FeedRestaurantItem({ entry, RestaurantCardComponent, onRestaurantPress, onDishPress, dishPhotoOnly = false, renderRestaurantActions }) {
  return (
    <View style={[styles.item, dishPhotoOnly && styles.card]} testID={`feed-item:${entry.restaurantId}`}>
      <RestaurantCardComponent restaurant={entry.restaurant}
        {...(dishPhotoOnly ? { recommendedDish: entry.recommendedDish, preferenceScore: entry.preferenceScore } : {})}
        onPress={onRestaurantPress ? () => onRestaurantPress(entry.restaurantId) : undefined} />
      {!dishPhotoOnly && <RecommendedDishPreview dish={entry.recommendedDish} rankingMode={entry.rankingMode}
        preferenceScore={entry.preferenceScore}
        onPress={entry.recommendedDish && onDishPress
          ? () => onDishPress(entry.recommendedDish.dishId, entry.restaurantId) : undefined} />}
      {renderRestaurantActions && <View style={styles.actions}>
        {renderRestaurantActions(entry.restaurant)}
      </View>}
    </View>
  );
}
const styles = StyleSheet.create({
  item: { marginBottom: 24 },
  actions: { paddingHorizontal: 16, paddingBottom: 14 },
  card: { backgroundColor: '#ffffff', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e9e3' },
});