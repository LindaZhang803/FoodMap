import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native';

export default function ReviewPanel({ restaurantId, dishId, repository, token, demo, onCreated }) {
  const [type, setType] = useState(dishId ? 'dish' : 'restaurant');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const target = { restaurantId, reviewType: type, ...(type === 'dish' ? { dishId } : {}) };
  const key = `${restaurantId}:${dishId || ''}:${type}:${page}:${refresh}`;
  useEffect(() => {
    let active = true;
    setError(null);
    repository.list({ restaurantId, reviewType: type, ...(type === 'dish' ? { dishId } : {}) }, page)
      .then(data => { if (active) setResult({ key, data }); })
      .catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [repository, restaurantId, dishId, type, page, key]);
  const data = result?.key === key ? result.data : null;
  async function submit() {
    if (saving) return;
    setSaving(true); setFormError(null); setNotice('');
    try {
      const created = await repository.create({ ...target, rating, comment }, token);
      if (!mounted.current) return;
      setRating(0); setComment(''); setPage(1); setRefresh(n => n + 1);
      setNotice(demo ? 'Demo review added in memory. Not saved to MongoDB.' : 'Review saved.');
      onCreated?.(target, created.statistics);
    } catch (err) { if (mounted.current) setFormError(err.message); }
    finally { if (mounted.current) setSaving(false); }
  }
  return <View style={styles.panel}>
    <Text style={styles.heading}>Reviews</Text>
    <View style={styles.row}>
      {['restaurant', ...(dishId ? ['dish'] : [])].map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: type === value }} disabled={saving} style={styles.button} onPress={() => { setType(value); setPage(1); setFormError(null); setNotice(''); }}><Text>{type === value ? '● ' : ''}{value === 'dish' ? 'Dish reviews' : 'Restaurant reviews'}</Text></Pressable>)}
    </View>
    {error ? <View><Text accessibilityRole="alert">{error}</Text><Pressable accessibilityRole="button" style={styles.button} onPress={() => setRefresh(n => n + 1)}><Text>Retry reviews</Text></Pressable></View> : !data ? <ActivityIndicator accessibilityLabel="Loading reviews" /> : <>
      <Text>{data.statistics.averageRating == null ? 'No ratings yet' : `${data.statistics.averageRating.toFixed(1)} / 5`} · {data.statistics.reviewCount} reviews</Text>
      {data.reviews.length === 0 && <Text>No reviews yet.</Text>}
      {data.reviews.map(review => <View key={review.id} style={styles.review}><Text>{review.rating} / 5</Text><Text>{review.comment}</Text></View>)}
      <View style={styles.row}>
        {page > 1 && <Pressable accessibilityRole="button" style={styles.button} onPress={() => setPage(n => n - 1)}><Text>Previous reviews</Text></Pressable>}
        {page * data.pagination.limit < data.pagination.total && <Pressable accessibilityRole="button" style={styles.button} onPress={() => setPage(n => n + 1)}><Text>Next reviews</Text></Pressable>}
      </View>
    </>}
    {demo || token ? <>
      <Text style={styles.heading}>Write a {type} review</Text>
      <View style={styles.row}>{[1, 2, 3, 4, 5].map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`${value} stars`} accessibilityState={{ selected: rating === value }} disabled={saving} style={styles.star} onPress={() => setRating(value)}><Text style={{ fontSize: 26, color: '#854d0e' }}>{value <= rating ? '★' : '☆'}</Text></Pressable>)}</View>
      <TextInput accessibilityLabel="Review comment" placeholder="Write your review" multiline maxLength={2000} editable={!saving} value={comment} onChangeText={setComment} style={styles.input} />
      <Text>{comment.length}/2000</Text>
      {formError && <Text accessibilityRole="alert">{formError}</Text>}
      <Pressable accessibilityRole="button" accessibilityLabel="Submit review" disabled={saving} style={styles.button} onPress={submit}><Text>{saving ? 'Saving…' : 'Submit review'}</Text></Pressable>
      {!!notice && <Text accessibilityLiveRegion="polite">{notice}</Text>}
    </> : <Text style={styles.review}>Sign in to post a review. Login integration is pending.</Text>}
  </View>;
}
const styles = StyleSheet.create({
  panel: { marginTop: 20, paddingTop: 12, borderTopWidth: 1, borderColor: '#ddd' },
  heading: { fontSize: 18, fontWeight: '600', marginVertical: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  button: { padding: 12, backgroundColor: '#e0e7ff', borderRadius: 6, marginVertical: 8 },
  star: { padding: 8 },
  input: { minHeight: 90, textAlignVertical: 'top', padding: 12, borderWidth: 1, borderColor: '#999', borderRadius: 6, backgroundColor: 'white' },
  review: { paddingVertical: 12 }
});
