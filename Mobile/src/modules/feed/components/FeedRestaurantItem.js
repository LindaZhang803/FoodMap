// pass one ranked entry to a discovery row, pass data to restaurant card defaultly

import React from 'react';
import { StyleSheet, View } from 'react-native';
import RestaurantCard from './RestaurantCard';

export default function FeedRestaurantItem({
  entry,
  RestaurantCardComponent = RestaurantCard,
  onRestaurantPress,
  renderRestaurantActions,
}) {
  return (
    <View style={styles.item} testID={`feed-item:${entry.restaurantId}`}>
      <RestaurantCardComponent
        restaurant={entry.restaurant}
        recommendedDish={entry.recommendedDish}
        preferenceScore={entry.preferenceScore}
        onPress={onRestaurantPress ? () => onRestaurantPress(entry.restaurantId) : undefined}
      />
      {renderRestaurantActions && (
        <View style={styles.actions}>
          {renderRestaurantActions(entry.restaurant)}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
  },
  actions: { paddingHorizontal: 16, paddingBottom: 16 },
});
