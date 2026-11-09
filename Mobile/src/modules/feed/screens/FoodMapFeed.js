import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { API_ORIGIN } from '../../../config/api';
import { getRestaurants } from '../../restaurants/services/restaurantApi';
import { filterRestaurants } from '../../restaurants/utils/restaurantFilters';
import { createDishRepository } from '../../reviews/services/dishRepository';
import { toFeedSession } from '../services/accountSession';
import FeedExperience from './FeedExperience';

/** Host supplies its existing Accounts state and navigation; no second session. */
export default function FoodMapFeed({ auth, preferenceRevision = 0, onLoginRequired, ...props }) {
  const getDishes = useMemo(() => {
    const repository = createDishRepository({ origin: API_ORIGIN });
    return repository.getDishes.bind(repository);
  }, []);
  const session = useMemo(() => {
    const current = toFeedSession(auth);
    return current ? { ...current, preferenceRevision } : null;
  }, [auth?.phase, auth?.user?.id, auth?.token, preferenceRevision]);

  if (!session) return <View style={styles.signIn}>
    <Text style={styles.message}>Sign in to load your feed.</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Sign in to load your feed"
      disabled={typeof onLoginRequired !== 'function'}
      accessibilityState={{ disabled: typeof onLoginRequired !== 'function' }}
      onPress={onLoginRequired} style={styles.button}>
      <Text style={styles.buttonText}>Sign in</Text>
    </Pressable>
  </View>;

  return <FeedExperience {...props} onLoginRequired={onLoginRequired}
    session={session} origin={API_ORIGIN}
    getRestaurants={getRestaurants} getDishes={getDishes}
    filterRestaurants={filterRestaurants} />;
}

const styles = StyleSheet.create({
  signIn: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  message: { fontSize: 16, color: '#435343', textAlign: 'center' },
  button: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16,
    borderRadius: 8, backgroundColor: '#007bff' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
