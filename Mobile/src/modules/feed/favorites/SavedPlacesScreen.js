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
  showRefreshButton = false,
}) {
  const [activeTab, setActiveTab] = useState('restaurants');
  const showRestaurants = activeTab === 'restaurants';
  const targetType = showRestaurants ? 'restaurant' : 'dish';
  const data = savedPlaces.items
    ? savedPlaces.items.filter(item => item.targetType === targetType)
    : (showRestaurants ? savedPlaces.favorites : savedPlaces.favoriteDishes).map(target => ({
      targetType, targetId: showRestaurants ? target._id : target.dishId, target,
    }));
  const signedOut = ['signed-out', 'expired'].includes(savedPlaces.status);
  const emptyMessage = signedOut ? 'Sign in to see your saved restaurants and dishes.'
    : savedPlaces.status === 'loading' ? 'Loading Want to Try…'
      : savedPlaces.status === 'failed' ? 'Your saved list could not be loaded.'
        : showRestaurants ? 'Save a restaurant to find it here.' : 'Save a dish to find it here.';

  function MissingTarget({ envelope }) {
    const pending = savedPlaces.isPending?.(envelope.targetType, envelope.targetId);
    const error = savedPlaces.mutationErrors?.[`${envelope.targetType}:${envelope.targetId}`];
    return (
      <View style={[styles.item, styles.dish]}>
        <Text style={styles.dishName}>Saved {envelope.targetType} unavailable</Text>
        <Text>The original item is no longer in the catalog.</Text>
        <Pressable accessibilityRole="button"
          accessibilityLabel={`Remove unavailable ${envelope.targetType} ${envelope.targetId}`}
          accessibilityState={{ disabled: pending }} disabled={pending}
          onPress={() => savedPlaces.removeFavorite(envelope.targetType, envelope.targetId)} style={styles.detail}>
          <Text style={styles.detailLabel}>{pending ? 'Removing…' : 'Remove from Want to Try'}</Text>
        </Pressable>
        {error && <Text accessibilityRole="alert" style={styles.error}>{error.message}</Text>}
      </View>
    );
  }

  function renderItem({ item: envelope }) {
    const item = envelope.target;
    if (!item) return <MissingTarget envelope={envelope} />;
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
        keyExtractor={item => `${item.targetType}:${item.targetId}`}
        refreshing={Boolean(savedPlaces.loading && data.length)}
        onRefresh={savedPlaces.refresh}
        ListHeaderComponent={(
          <View style={styles.heading}>
            {header}
            <Text accessibilityRole="header" style={styles.title}>Want to Try</Text>
            {savedPlaces.error && <Text accessibilityRole="alert" style={styles.error}>{savedPlaces.error.message}</Text>}
            {signedOut && savedPlaces.canRequestLogin && (
              <Pressable accessibilityRole="button" onPress={savedPlaces.requestLogin} style={styles.detail}>
                <Text style={styles.detailLabel}>Sign in</Text>
              </Pressable>
            )}
            {savedPlaces.status === 'failed' && (
              <Pressable accessibilityRole="button" onPress={savedPlaces.retry} style={styles.detail}>
                <Text style={styles.detailLabel}>Retry saved list</Text>
              </Pressable>
            )}
            {showRefreshButton && !signedOut && savedPlaces.status !== 'failed'
              && typeof savedPlaces.refresh === 'function' && (
              <Pressable accessibilityRole="button" accessibilityLabel="Refresh saved list"
                accessibilityState={{ disabled: Boolean(savedPlaces.loading), busy: Boolean(savedPlaces.loading) }}
                disabled={Boolean(savedPlaces.loading)} onPress={savedPlaces.refresh} style={styles.detail}>
                <Text style={styles.detailLabel}>{savedPlaces.loading ? 'Refreshing…' : 'Refresh saved list'}</Text>
              </Pressable>
            )}
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
            {emptyMessage}
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
  error: { color: '#9b3029', lineHeight: 20 },
  empty: { color: '#677269', marginTop: 12, lineHeight: 22 },
});
