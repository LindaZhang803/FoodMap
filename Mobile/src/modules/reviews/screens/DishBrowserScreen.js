import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { API_ORIGIN } from '../../../config/api';
import { createDishRepository } from '../services/dishRepository';
import fixtures from '../mocks/fixtures.json';
import { createReviewRepository } from '../services/reviewRepository';
import ReviewPanel from '../components/ReviewPanel';

const ratingText = dish => dish.averageRating == null ? 'No ratings yet' : `${dish.averageRating.toFixed(1)} / 5 · ${dish.reviewCount} reviews`;

function DishImage({ uri }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  return uri && !failed ? <Image source={{ uri }} style={styles.image} onError={() => setFailed(true)} accessibilityLabel="Dish photo" /> : <Text style={styles.placeholder}>Photo unavailable</Text>;
}

export default function DishBrowserScreen({ restaurantId, onBack, demo = false, token = null, apiOrigin = API_ORIGIN, syntheticSession = false }) {
  const [dishId, setDishId] = useState(null);
  const [resource, setResource] = useState(null);
  const [scenario, setScenario] = useState('normal');
  const [dishSort, setDishSort] = useState('name');
  const [retry, setRetry] = useState(0);
  const liveRepository = useMemo(() => createDishRepository({ origin: apiOrigin }), [apiOrigin]);
  const demoFixtures = useMemo(() => JSON.parse(JSON.stringify(fixtures)), []);
  const demoRepository = useMemo(() => createDishRepository({ fixtures: demoFixtures }), [demoFixtures]);
  const reviewRepository = useMemo(() => createReviewRepository({ origin: apiOrigin, fixtures: demo ? demoFixtures : null }), [demo, demoFixtures, apiOrigin]);
  const [ratingUpdate, setRatingUpdate] = useState(null);
  const repository = demo ? demoRepository : liveRepository;
  const targetRestaurant = demo && scenario === 'unrated' ? '100000000000000000000002' : restaurantId;
  const requestKey = `${targetRestaurant}:${dishId || 'list'}:${scenario}:${retry}:${demo}:${dishSort}`;
  // Ignore the previous target's data during navigation, before the effect runs.
  const data = resource?.key === requestKey ? resource.data : null;
  const error = resource?.key === requestKey ? resource.error : null;
  useEffect(() => {
    let active = true;
    const load = async () => {
      if (demo && scenario === 'error') throw new Error('Simulated connection failure. Select Normal to restore the demo.');
      if (demo && scenario === 'empty') return [];
      return dishId ? repository.getDish(dishId) : repository.getDishes(targetRestaurant, dishSort);
    };
    load()
      .then(result => { if (active) setResource({ key: requestKey, data: result, error: null }); })
      .catch(err => { if (active) setResource({ key: requestKey, data: null, error: err.message }); });
    return () => { active = false; };
  }, [repository, targetRestaurant, dishId, scenario, demo, dishSort, requestKey]);
  return <View style={styles.container}>
    <Pressable accessibilityRole="button" onPress={() => dishId ? setDishId(null) : onBack()} style={styles.button}><Text>← {dishId ? 'Dish list' : 'Back'}</Text></Pressable>
    <Text style={styles.title}>{dishId ? 'Dish details' : 'Dishes'}</Text>
    {syntheticSession && <Text style={styles.notice}>Synthetic MongoDB demo — reviews are saved to the test database. This is not a real menu.</Text>}
    {demo && <Text style={styles.notice}>Demo only — synthetic dishes and reviews, not this restaurant’s menu.</Text>}
    {demo && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {['normal', 'unrated', 'empty', 'error'].map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: scenario === value }} style={styles.button} onPress={() => { setDishId(null); setScenario(value); }}><Text>{value === scenario ? '● ' : ''}{value}</Text></Pressable>)}
    </View>}
    {!dishId && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{[['name', 'Name'], ['highestRated', 'Highest rated'], ['mostReviewed', 'Most reviewed']].map(([value, label]) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: dishSort === value }} onPress={() => setDishSort(value)} style={styles.button}><Text>{dishSort === value ? '● ' : ''}{label}</Text></Pressable>)}</View>}
    {error ? <View><Text accessibilityRole="alert">{error}</Text><Pressable accessibilityRole="button" style={styles.button} onPress={() => setRetry(n => n + 1)}><Text>Retry</Text></Pressable></View> : data === null ? <ActivityIndicator accessibilityLabel="Loading dishes" /> :
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        {dishId ? <>
          <DishImage uri={data.imageUrl} />
          <Text style={styles.title}>{data.name}</Text>
          <Text>{data.description || 'Description unavailable'}</Text>
          <Text>{ratingText(ratingUpdate?.dishId === data.id ? { ...data, ...ratingUpdate.statistics } : data)}</Text>
        </> : data.length === 0 ? <Text>No dishes have been added for this restaurant yet.</Text> : data.map(dish =>
          <Pressable key={dish.id} accessibilityRole="button" accessibilityLabel={`View ${dish.name}`} onPress={() => setDishId(dish.id)} style={styles.card}>
            <DishImage uri={dish.imageUrl} /><Text style={styles.heading}>{dish.name}</Text><Text>{ratingText(dish)}</Text>
          </Pressable>)}
        <ReviewPanel key={`${targetRestaurant}:${dishId || 'restaurant'}`} restaurantId={targetRestaurant} dishId={dishId} repository={reviewRepository} token={token} demo={demo} origin={apiOrigin} syntheticSession={syntheticSession} onCreated={(target, statistics) => { if (target.dishId) setRatingUpdate({ dishId: target.dishId, statistics }); }} />
      </ScrollView>}
  </View>;
}
const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f5f5f5' },
  content: { paddingBottom: 30, gap: 12 },
  title: { fontSize: 24, fontWeight: 'bold', marginVertical: 12 },
  heading: { fontSize: 18, fontWeight: '600', marginVertical: 8 },
  button: { paddingVertical: 14 },
  notice: { color: '#854d0e', marginBottom: 12 },
  card: { backgroundColor: 'white', padding: 16, borderRadius: 8, marginBottom: 12 },
  image: { width: '100%', height: 160, borderRadius: 8 },
  placeholder: { paddingVertical: 24, color: '#666' }
});
