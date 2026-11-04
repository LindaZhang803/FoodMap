// renders a empty loader, prepare to render feed list -> reload when failed
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

export function RetryButton({ onPress, label = 'Try again' }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.button}>
    <Text style={styles.buttonText}>{label}</Text>
  </Pressable>;
}

export default function FeedStatus({ loading, refreshing, preferencesLoading, resourceError, dishError,
  preferenceStatus, entries, coverage, onRetry, showSummary = true }) {
  if (loading && entries.length === 0) return <View style={styles.block} accessibilityLiveRegion="polite">
    <ActivityIndicator color="#356144" /><Text style={styles.message}>Finding places to try…</Text>
  </View>;
  if (resourceError) return <View style={styles.notice} accessibilityLiveRegion="polite">
    <Text style={styles.heading}>{entries.length ? 'Could not refresh places' : 'Could not load places'}</Text>
    <Text style={styles.message}>{entries.length ? 'Your previous places are still available.' : 'Check your connection and try again.'}</Text>
    <RetryButton onPress={onRetry} />
  </View>;
  const recommendationError = dishError || preferenceStatus === 'unavailable';
  if (!showSummary && !recommendationError && !refreshing && !preferencesLoading && coverage?.complete !== false) return null;
  let message;
  if (recommendationError) message = 'Showing popular places while recommendations are unavailable.';
  else if (preferencesLoading) message = 'Loading your taste preferences…';
  else if (preferenceStatus === 'empty' || preferenceStatus === 'signed-out') message = 'Add taste preferences to personalize your feed';
  else if (!entries.some(entry => entry.rankingMode === 'personalized')) message = 'Showing popular places. Taste matches are not available for these dishes yet.';
  else message = 'Ordered by how closely each restaurant’s best dish matches your taste.';
  return <View style={styles.notice} accessibilityLiveRegion="polite">
    {(showSummary || recommendationError) && <Text style={styles.message}>{message}</Text>}
    {coverage && !coverage.complete && <Text style={styles.message}>Dish information covers part of this catalog.</Text>}
    {(refreshing || preferencesLoading) && <ActivityIndicator size="small" color="#356144" accessibilityLabel="Updating feed" />}
    {recommendationError && <RetryButton onPress={onRetry} label="Retry recommendations" />}
  </View>;
}
const styles = StyleSheet.create({
  block: { paddingVertical: 36, alignItems: 'center', gap: 12 },
  notice: { marginBottom: 20, gap: 10, alignItems: 'flex-start' },
  heading: { fontSize: 17, fontWeight: '600', color: '#243a2a' },
  message: { fontSize: 14, lineHeight: 21, color: '#647067' },
  button: { backgroundColor: '#e3ece4', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14 },
  buttonText: { color: '#2e5839', fontWeight: '600', fontSize: 14 },
});
