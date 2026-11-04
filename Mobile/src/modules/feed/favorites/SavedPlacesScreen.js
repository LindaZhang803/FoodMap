// Renders the saved places/dishes based on user's selection

import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import RestaurantCard from '../components/RestaurantCard';
import SavedPlaceActions from './SavedPlaceActions';

const tabs = [
  { id: 'restaurants', label: 'Saved Restaurants' },
  { id: 'dishes', label: 'Saved Dishes' },
];

export default function SavedPlacesScreen({
  savedPlaces,
  RestaurantCardComponent = RestaurantCard,
  onRestaurantPress,
  onDishPress,
  header,
  safeAreaEdges,
}) {
  const [activeTab, setActiveTab] = useState('restaurants');
  const showRestaurants = activeTab === 'restaurants';
  const data = showRestaurants ? savedPlaces.favorites : savedPlaces.favoriteDishes;

  function renderItem({ item }) {
    if (showRestaurants) {
      return (
        <View style={styles.item}>
          <RestaurantCardComponent
            restaurant={item}
            onPress={onRestaurantPress ? () => onRestaurantPress(item._id) : undefined}
          />
          <View style={styles.actions}>
            <SavedPlaceActions restaurant={item} savedPlaces={savedPlaces} />
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.item, styles.dish]}>
        <Text style={styles.dishName}>{item.name}</Text>
        <View style={styles.dishActions}>
          <SavedPlaceActions dish={item} savedPlaces={savedPlaces} />
          {onDishPress && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View dish ${item.name}`}
              onPress={() => onDishPress(item.dishId, item.restaurantId)}
              style={styles.detail}
            >
              <Text style={styles.detailLabel}>View details</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={safeAreaEdges}>
      <FlatList
        contentContainerStyle={styles.content}
        data={data}
        renderItem={renderItem}
        keyExtractor={item => showRestaurants ? `restaurant:${item._id}` : `dish:${item.dishId}`}
        ListHeaderComponent={(
          <View style={styles.heading}>
            {header}
            <Text accessibilityRole="header" style={styles.title}>Want to Try</Text>
            <View style={styles.tabs}>
              {tabs.map(({ id, label }) => (
                <Pressable
                  key={id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeTab === id }}
                  onPress={() => setActiveTab(id)}
                  style={[styles.tab, activeTab === id && styles.activeTab]}
                >
                  <Text style={[styles.tabLabel, activeTab === id && styles.activeLabel]}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
        ListEmptyComponent={(
          <Text style={styles.empty}>
            {showRestaurants ? 'Save a restaurant to find it here.' : 'Save a dish to find it here.'}
          </Text>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f5f2' },
  content: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
  },
  heading: { gap: 16, marginBottom: 20 },
  title: { fontSize: 30, fontWeight: '700', color: '#1d3527' },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: {
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: '#e5eae2',
  },
  activeTab: { backgroundColor: '#31563c' },
  tabLabel: { fontSize: 13, fontWeight: '600', color: '#31563c' },
  activeLabel: { color: '#fff' },
  item: {
    marginBottom: 18,
    overflow: 'hidden',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e9e3',
    backgroundColor: '#fff',
  },
  actions: { padding: 14 },
  dish: { gap: 12, padding: 14 },
  dishName: { fontSize: 18, fontWeight: '700', color: '#1d3527' },
  dishActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
  detail: { minHeight: 44, justifyContent: 'center' },
  detailLabel: { color: '#31563c', fontSize: 13, fontWeight: '600' },
  empty: { color: '#677269', marginTop: 12, lineHeight: 22 },
});
