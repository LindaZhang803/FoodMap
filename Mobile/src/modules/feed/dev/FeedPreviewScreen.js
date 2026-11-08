import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import HomeFeedScreen from '../screens/HomeFeedScreen';
import { FeedRepository } from '../services/FeedRepository';
import { UserPreferenceRepository } from '../services/UserPreferenceRepository';
import { createMockSources } from '../mocks/sources';
import { MOCK_DISHES, MOCK_RESTAURANTS } from '../mocks/fixtures';
import { SavedPlaceActions, SavedPlacesScreen, useSavedPlaces } from '../favorites';
import DecisionWheel from '../wheel/DecisionWheel';
import PreviewRestaurantCard from './PreviewRestaurantCard';
import PreviewPlaceDetails from './PreviewPlaceDetails';

const TABS = ['Discover', 'Want to Try', 'Wheel'];
const DEMO_USER_ID = 'demo-user-a';
const SCENARIOS = [
  ['Normal', 'default'], ['Empty', 'empty'], ['Places fail', 'restaurant-error'],
  ['Dishes fail', 'dish-error'], ['Preferences fail', 'preference-error'],
  ['No dishes', 'all-no-dish'], ['Partial coverage', 'partial-coverage'], ['Slow requests', 'slow'],
];

function Choice({ label, selected, onPress }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress}
      style={[styles.choice, selected && styles.selected]}>
      <Text style={[styles.choiceText, selected && styles.selectedText]}>{label}</Text>
    </Pressable>
  );
}

export default function FeedPreviewScreen() {
  return <SafeAreaProvider><Demo /></SafeAreaProvider>;
}

function Demo() {
  const [tab, setTab] = useState('Discover');
  const [detailStack, setDetailStack] = useState([]);
  const [scenario, setScenario] = useState('default');
  const [showTools, setShowTools] = useState(() => Platform.OS === 'web'
    && new URLSearchParams(window.location.search).get('tools') === '1');
  const savedPlaces = useSavedPlaces();
  const detail = detailStack[detailStack.length - 1];

  const repositories = useMemo(() => {
    const slow = scenario === 'slow';
    const sources = createMockSources({
      scenario: slow ? 'default' : scenario,
      restaurantDelayMs: slow ? 1400 : 200,
      dishDelayMs: slow ? 1800 : 300,
      preferenceDelayMs: slow ? 2200 : 350,
    });
    return {
      feedRepository: new FeedRepository(sources),
      preferenceRepository: new UserPreferenceRepository(sources),
    };
  }, [scenario]);

  function openRestaurant(restaurantId) {
    setDetailStack(stack => [...stack, { restaurantId }]);
  }

  function openDish(dishId, restaurantId) {
    setDetailStack(stack => [...stack, { dishId, restaurantId }]);
  }

  const feedHeader = (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: showTools }}
        onPress={() => setShowTools(value => !value)}>
        <Text style={styles.tools}>{showTools ? 'Hide' : 'Show'} development scenarios</Text>
      </Pressable>
      {showTools && (
        <View style={styles.toolPanel}>
          <View style={styles.choices}>
            {SCENARIOS.map(([label, value]) => <Choice key={value} label={label}
              selected={scenario === value} onPress={() => setScenario(value)} />)}
          </View>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.bar}>
        <View style={styles.brandRow}>
          <Text style={styles.brand}>FoodMap</Text>
          <Text style={styles.demo}>Demo · sample data</Text>
        </View>
        <View style={styles.choices}>
          {TABS.map(name => <Choice key={name} label={name} selected={tab === name && !detail}
            onPress={() => { setTab(name); setDetailStack([]); }} />)}
        </View>
      </View>
      <View style={tab === 'Discover' && !detail ? styles.page : styles.hidden}>
        <HomeFeedScreen {...repositories} userId={DEMO_USER_ID} RestaurantCardComponent={PreviewRestaurantCard}
          safeAreaEdges={[]} header={feedHeader} showRefreshButton={Platform.OS === 'web'}
          onRestaurantPress={openRestaurant}
          renderRestaurantActions={restaurant => <SavedPlaceActions restaurant={restaurant} savedPlaces={savedPlaces} />} />
      </View>
      <View style={tab === 'Want to Try' && !detail ? styles.page : styles.hidden}>
        <SavedPlacesScreen savedPlaces={savedPlaces}
          onRestaurantPress={openRestaurant} onDishPress={openDish} safeAreaEdges={[]} />
      </View>
      <View style={tab === 'Wheel' && !detail ? styles.page : styles.hidden}>
        <DecisionWheel restaurants={MOCK_RESTAURANTS} dishes={MOCK_DISHES}
          savedPlaces={savedPlaces.favorites} savedDishes={savedPlaces.favoriteDishes}
          onRestaurantPress={openRestaurant} onDishPress={openDish} />
      </View>
      {detail && (
        <PreviewPlaceDetails restaurant={MOCK_RESTAURANTS.find(item => item._id === detail.restaurantId)}
          dishId={detail.dishId} savedPlaces={savedPlaces} onDishPress={openDish}
          onBack={() => setDetailStack(stack => stack.slice(0, -1))} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f5f2' },
  page: { flex: 1 },
  hidden: { display: 'none' },
  bar: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 10, gap: 12 },
  header: { gap: 9, marginBottom: 16 },
  brandRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  brand: { fontSize: 24, color: '#31563c', fontWeight: '800' },
  demo: { fontSize: 12, lineHeight: 18, color: '#5b695e' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  choice: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 18, backgroundColor: '#e6eae3' },
  selected: { backgroundColor: '#315a3e' },
  choiceText: { color: '#435343', fontSize: 13, fontWeight: '600' },
  selectedText: { color: '#ffffff' },
  tools: { color: '#426249', fontSize: 12, paddingVertical: 5, textDecorationLine: 'underline' },
  toolPanel: { gap: 12, padding: 12, backgroundColor: '#ecefe8', borderRadius: 10 },
});
