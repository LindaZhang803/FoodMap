import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext, SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { HomeFeedView } from './HomeFeedScreen';
import { FeedRepository } from '../services/FeedRepository';
import { UserPreferenceRepository } from '../services/UserPreferenceRepository';
import { createLiveAccountSource, createLiveCatalogSources, resolveCatalogImageUrl } from '../services/liveSources';
import usePersonalizedFeed from '../hooks/usePersonalizedFeed';
import { SavedPlaceActions, SavedPlacesScreen, useLiveSavedPlaces } from '../favorites';
import DecisionWheel from '../wheel/DecisionWheel';

const ExperienceContext = createContext(null);
const TABS = ['Discover', 'Want to Try', 'Wheel'];

/** Descendant host detail screens use the very same confirmed save state. */
export function useFeedExperience() {
  const experience = useContext(ExperienceContext);
  if (!experience) throw new Error('useFeedExperience must be used inside FeedExperience.');
  return experience;
}

/** Reuse the host provider; standalone mounts get one only if absent. */
export default function FeedExperience(props) {
  const insets = useContext(SafeAreaInsetsContext);
  return insets == null
    ? <SafeAreaProvider><Experience {...props} /></SafeAreaProvider>
    : <Experience {...props} />;
}

function Experience({
  getRestaurants, getDishes, origin, dishReadComplete = true,
  session, readSelfProfile, onLoginRequired, onSessionExpired,
  onRestaurantPress, onDishPress, fetchImpl, favoritesClient,
  RestaurantCardComponent, resolveImageUrl, filterRestaurants,
  userLocation, onRequestLocation, policy, renderDetail,
}) {
  const [tab, setTab] = useState('Discover');
  const userId = session?.userId ?? null;
  const token = session?.token ?? null;
  const preferenceRevision = session?.preferenceRevision ?? 0;
  const current = useRef(null);
  const expired = useRef(onSessionExpired);
  expired.current = onSessionExpired;
  // A render-time identity guard also protects the gap before effect cleanup.
  const accountIdentity = useMemo(() => ({ active: false }), [userId, token, origin, readSelfProfile]);
  current.current = accountIdentity;
  const feedRepository = useMemo(() => new FeedRepository(createLiveCatalogSources({
    getRestaurants, getDishes, origin, dishReadComplete,
  })), [getRestaurants, getDishes, origin, dishReadComplete]);
  const accountSource = useMemo(() => createLiveAccountSource({
    readSelfProfile, userId, token, origin,
    isCurrentSession: () => current.current === accountIdentity && accountIdentity.active,
    onSessionExpired: () => expired.current?.(),
  }), [readSelfProfile, userId, token, origin, accountIdentity]);
  useEffect(() => {
    accountIdentity.active = true;
    return () => {
      accountIdentity.active = false;
      accountSource.cancelPending();
    };
  }, [accountSource, accountIdentity]);
  const preferenceRepository = useMemo(() => new UserPreferenceRepository({ accountSource }), [accountSource]);
  const feed = usePersonalizedFeed({ feedRepository, preferenceRepository,
    userId, preferenceRevision, policy });
  const savedPlaces = useLiveSavedPlaces({ session, origin, fetchImpl,
    client: favoritesClient, onLoginRequired, onSessionExpired });
  const restaurants = useMemo(() => feed.candidates.map(candidate => candidate.restaurant), [feed.candidates]);
  const dishes = useMemo(() => feed.candidates.flatMap(candidate => candidate.dishes), [feed.candidates]);
  const imageResolver = useCallback(value => resolveImageUrl
    ? resolveImageUrl(value) : resolveCatalogImageUrl(value, origin), [resolveImageUrl, origin]);
  const renderRestaurantActions = useCallback(restaurant =>
    <SavedPlaceActions restaurant={restaurant} savedPlaces={savedPlaces} />, [savedPlaces]);
  const renderDishActions = useCallback(dish =>
    <SavedPlaceActions dish={dish} savedPlaces={savedPlaces} />, [savedPlaces]);
  const experience = { feed, savedPlaces, renderRestaurantActions, renderDishActions };
  const detail = renderDetail?.(experience);

  return (
    <ExperienceContext.Provider value={experience}>
      <SafeAreaView style={styles.screen}>
        {!detail && <View style={styles.tabs}>
          {TABS.map(name => (
            <Pressable key={name} accessibilityRole="tab" accessibilityLabel={name}
              accessibilityState={{ selected: tab === name }} onPress={() => setTab(name)}
              style={[styles.tab, tab === name && styles.selected]}>
              <Text style={tab === name ? styles.selectedText : styles.text}>{name}</Text>
            </Pressable>
          ))}
        </View>}
        <View style={tab === 'Discover' && !detail ? styles.page : styles.hidden}>
          <HomeFeedView feed={feed} safeAreaEdges={[]} showRefreshButton={Platform.OS === 'web'}
            RestaurantCardComponent={RestaurantCardComponent} onRestaurantPress={onRestaurantPress}
            renderRestaurantActions={renderRestaurantActions} />
        </View>
        <View style={tab === 'Want to Try' && !detail ? styles.page : styles.hidden}>
          <SavedPlacesScreen savedPlaces={savedPlaces} safeAreaEdges={[]} showRefreshButton={Platform.OS === 'web'}
            onRestaurantPress={onRestaurantPress} onDishPress={onDishPress} />
        </View>
        <View style={tab === 'Wheel' && !detail ? styles.page : styles.hidden}>
          <DecisionWheel restaurants={restaurants} dishes={dishes}
            savedPlaces={savedPlaces.favorites} savedDishes={savedPlaces.favoriteDishes}
            privateSessionKey={savedPlaces.sessionScope}
            onRestaurantPress={onRestaurantPress} onDishPress={onDishPress}
            resolveImageUrl={imageResolver} filterRestaurants={filterRestaurants}
            userLocation={userLocation} onRequestLocation={onRequestLocation} />
        </View>
        {detail}
      </SafeAreaView>
    </ExperienceContext.Provider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f5f2' },
  page: { flex: 1 },
  hidden: { display: 'none' },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 14, alignSelf: 'center' },
  tab: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#e6eae3' },
  selected: { backgroundColor: '#315a3e' },
  text: { color: '#435343', fontWeight: '600' },
  selectedText: { color: '#fff', fontWeight: '600' },
});
