import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet, Image } from 'react-native';

import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import syntheticPhoto from '../mocks/syntheticPhoto';

export default function ReviewPanel({ restaurantId, dishId, repository, token, demo, origin, syntheticSession, onCreated }) {
  const [photos, setPhotos] = useState([]);
  const [sort, setSort] = useState('mostRecent');
  const [editingId, setEditingId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const busy = useRef(false);
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
  const key = `${restaurantId}:${dishId || ''}:${type}:${page}:${refresh}:${sort}`;
  useEffect(() => {
    let active = true;
    setError(null);
    repository.list({ restaurantId, reviewType: type, ...(type === 'dish' ? { dishId } : {}) }, page, sort, token)
      .then(data => { if (active) setResult({ key, token, data }); })
      .catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [repository, restaurantId, dishId, type, page, sort, token, key]);
  const data = result?.key === key && result.token === token ? result.data : null;
  async function submit() {
    if (busy.current) return;
    busy.current = true;
    setSaving(true); setFormError(null); setNotice('');
    try {
      const created = editingId ? await repository.edit(editingId, { rating, comment, photoUrls: photos.map(photo => photo.url) }, token) : await repository.create({ ...target, rating, comment, photoUrls: photos.map(photo => photo.url) }, token);
      if (!mounted.current) return;
      setRating(0); setComment(''); setPhotos([]); setEditingId(null); setPage(1); setRefresh(n => n + 1);
      setNotice(demo ? 'Demo review saved in memory. Not saved to MongoDB.' : 'Review saved.');
      onCreated?.(target, created.statistics);
    } catch (err) { if (mounted.current) setFormError(err.message); }
    finally { busy.current = false; if (mounted.current) setSaving(false); }
  }
  async function attachSyntheticPhoto() {
    if (busy.current || photos.length >= 5) return;
    busy.current = true; setSaving(true); setFormError(null);
    try {
      const uri = `${FileSystem.cacheDirectory}foodmap-synthetic-review.png`;
      await FileSystem.writeAsStringAsync(uri, syntheticPhoto, { encoding: FileSystem.EncodingType.Base64 });
      const uploaded = await repository.uploadPhoto({ uri, fileName: 'synthetic.png', mimeType: 'image/png' }, token);
      if (mounted.current) setPhotos(current => [...current, { url: uploaded.photoUrl, preview: uri }]);
    } catch (err) { if (mounted.current) setFormError(err.message); }
    finally { busy.current = false; if (mounted.current) setSaving(false); }
  }
  async function selectPhoto() {
    if (busy.current || photos.length >= 5) return;
    busy.current = true; setSaving(true); setFormError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error('Photo access was declined. You can still post without a photo.');
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (picked.canceled || !picked.assets?.length) return;
      const asset = picked.assets[0];
      if (asset.fileSize > 5 * 1024 * 1024) throw new Error('Photo must be 5 MB or smaller.');
      const uploaded = await repository.uploadPhoto(asset, token);
      if (mounted.current) setPhotos(current => [...current, { url: uploaded.photoUrl, preview: asset.uri }]);
    } catch (err) { if (mounted.current) setFormError(err.message); }
    finally { busy.current = false; if (mounted.current) setSaving(false); }
  }
  async function changeReview(review, action) {
    if (busy.current) return;
    busy.current = true; setSaving(true); setFormError(null); setNotice('');
    try {
      if (action === 'delete') {
        const changed = await repository.remove(review.id, token);
        if (!mounted.current) return;
        setDeleteId(null); setEditingId(null); setRating(0); setComment(''); setPhotos([]); setPage(1);
        onCreated?.(target, changed.statistics);
        setNotice(demo ? 'Demo review deleted in memory.' : 'Review deleted.');
      } else {
        await repository.like(review.id, !review.likedByMe, token);
        if (!mounted.current) return;
      }
      setRefresh(n => n + 1);
    } catch (err) { if (mounted.current) setFormError(err.message); }
    finally { busy.current = false; if (mounted.current) setSaving(false); }
  }
  function resetForm() { setEditingId(null); setDeleteId(null); setRating(0); setComment(''); setPhotos([]); setFormError(null); setNotice(''); }
  return <View style={styles.panel}>
    <Text style={styles.heading}>Reviews</Text>
    <View style={styles.row}>
      {['restaurant', ...(dishId ? ['dish'] : [])].map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: type === value }} disabled={saving} style={styles.button} onPress={() => { setType(value); setPage(1); resetForm(); }}><Text>{type === value ? '● ' : ''}{value === 'dish' ? 'Dish reviews' : 'Restaurant reviews'}</Text></Pressable>)}
    </View>
    <View style={styles.row}>{[['mostRecent', 'Most recent'], ['mostLiked', 'Most liked']].map(([value, label]) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: sort === value }} disabled={saving} style={styles.button} onPress={() => { setSort(value); setPage(1); }}><Text>{sort === value ? '● ' : ''}{label}</Text></Pressable>)}</View>
    {error ? <View><Text accessibilityRole="alert">{error}</Text><Pressable accessibilityRole="button" style={styles.button} onPress={() => setRefresh(n => n + 1)}><Text>Retry reviews</Text></Pressable></View> : !data ? <ActivityIndicator accessibilityLabel="Loading reviews" /> : <>
      <Text>{data.statistics.averageRating == null ? 'No ratings yet' : `${data.statistics.averageRating.toFixed(1)} / 5`} · {data.statistics.reviewCount} reviews</Text>
      {data.reviews.length === 0 && <Text>No reviews yet.</Text>}
      {data.reviews.map(review => <View key={review.id} style={styles.review}>
        <Text>{review.rating} / 5{review.isOwner ? ' · Your review' : ''}</Text><Text>{review.comment}</Text>
        <View style={styles.row}>{(review.photoUrls || []).map(url => <Image key={url} source={{ uri: url.startsWith('/') ? origin + url : url }} style={styles.photo} accessibilityLabel="Review photo" />)}</View>
        <View style={styles.row}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${review.likedByMe ? 'Unlike' : 'Like'} review ${review.id}`} disabled={saving || (!demo && !token)} style={styles.button} onPress={() => changeReview(review, 'like')}><Text>{review.likedByMe ? 'Unlike' : 'Like'} ({review.likeCount || 0})</Text></Pressable>
          {review.isOwner && <>
            <Pressable accessibilityRole="button" disabled={saving} style={styles.button} onPress={() => { setEditingId(review.id); setDeleteId(null); setRating(review.rating); setComment(review.comment); setPhotos((review.photoUrls || []).map(url => ({ url, preview: url.startsWith('/') ? origin + url : url }))); setFormError(null); setNotice(''); }}><Text>Edit review</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={saving} style={styles.button} onPress={() => setDeleteId(review.id)}><Text>Delete review</Text></Pressable>
          </>}
        </View>
        {deleteId === review.id && <View><Text>Delete this review?</Text><View style={styles.row}>
          <Pressable accessibilityRole="button" disabled={saving} style={styles.button} onPress={() => changeReview(review, 'delete')}><Text>Confirm delete</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={saving} style={styles.button} onPress={() => setDeleteId(null)}><Text>Cancel delete</Text></Pressable>
        </View></View>}
      </View>)}
      <View style={styles.row}>
        {page > 1 && <Pressable accessibilityRole="button" style={styles.button} onPress={() => setPage(n => n - 1)}><Text>Previous reviews</Text></Pressable>}
        {page * data.pagination.limit < data.pagination.total && <Pressable accessibilityRole="button" style={styles.button} onPress={() => setPage(n => n + 1)}><Text>Next reviews</Text></Pressable>}
      </View>
    </>}
    {demo || token ? <>
      <Text style={styles.heading}>{editingId ? 'Edit your review' : `Write a ${type} review`}</Text>
      <View style={styles.row}>{[1, 2, 3, 4, 5].map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`${value} stars`} accessibilityState={{ selected: rating === value }} disabled={saving} style={styles.star} onPress={() => setRating(value)}><Text style={{ fontSize: 26, color: '#854d0e' }}>{value <= rating ? '★' : '☆'}</Text></Pressable>)}</View>
      <TextInput accessibilityLabel="Review comment" placeholder="Write your review" multiline maxLength={2000} editable={!saving} value={comment} onChangeText={setComment} style={styles.input} />
      <Text>{comment.length}/2000</Text>
      <View style={styles.row}>{photos.map((photo, index) => <View key={`${photo.url}-${index}`}><Image source={{ uri: photo.preview }} style={styles.photo} accessibilityLabel="Selected review photo" /><Pressable accessibilityRole="button" disabled={saving} style={styles.button} onPress={() => setPhotos(current => current.filter((_, i) => i !== index))}><Text>Remove photo {index + 1}</Text></Pressable></View>)}</View>
      <Pressable accessibilityRole="button" disabled={saving || photos.length >= 5} style={styles.button} onPress={selectPhoto}><Text>Add photo ({photos.length}/5)</Text></Pressable>
      {__DEV__ && syntheticSession && <Pressable accessibilityRole="button" disabled={saving || photos.length >= 5} style={styles.button} onPress={attachSyntheticPhoto}><Text>Add synthetic test photo</Text></Pressable>}
      {formError && <Text accessibilityRole="alert">{formError}</Text>}
      <Pressable accessibilityRole="button" accessibilityLabel={editingId ? 'Save changes' : 'Submit review'} disabled={saving} style={styles.button} onPress={submit}><Text>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Submit review'}</Text></Pressable>
      {editingId && <Pressable accessibilityRole="button" disabled={saving} style={styles.button} onPress={resetForm}><Text>Cancel edit</Text></Pressable>}
      {!!notice && <Text accessibilityLiveRegion="polite">{notice}</Text>}
    </> : <Text style={styles.review}>Sign in to post a review. Login integration is pending.</Text>}
  </View>;
}
const styles = StyleSheet.create({
  photo: { width: 110, height: 90, borderRadius: 6 },
  panel: { marginTop: 20, paddingTop: 12, borderTopWidth: 1, borderColor: '#ddd' },
  heading: { fontSize: 18, fontWeight: '600', marginVertical: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  button: { padding: 12, backgroundColor: '#e0e7ff', borderRadius: 6, marginVertical: 8 },
  star: { padding: 8 },
  input: { minHeight: 90, textAlignVertical: 'top', padding: 12, borderWidth: 1, borderColor: '#999', borderRadius: 6, backgroundColor: 'white' },
  review: { paddingVertical: 12 }
});
