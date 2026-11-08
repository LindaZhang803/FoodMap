import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/** The preview and live owner share this action surface. */
export default function SavedPlaceActions({ restaurant, dish, savedPlaces }) {
  const targetType = dish ? 'dish' : 'restaurant';
  const item = dish || restaurant;
  const targetId = dish ? dish.dishId : restaurant._id;
  const name = item.name;
  const key = `${targetType}:${String(targetId).toLowerCase()}`;
  const isSaved = savedPlaces.isSaved
    ? savedPlaces.isSaved(targetType, targetId)
    : dish
      ? savedPlaces.favoriteDishes.some(saved => saved.dishId === targetId)
      : savedPlaces.favorites.some(saved => saved._id === targetId);
  const signedOut = ['signed-out', 'expired'].includes(savedPlaces.status);
  const pending = savedPlaces.isPending?.(targetType, targetId) || false;
  const validTarget = savedPlaces.canSaveTarget?.(targetType, targetId) ?? true;
  const disabled = !validTarget || pending || (signedOut ? !savedPlaces.canRequestLogin
    : savedPlaces.status !== undefined && !savedPlaces.canMutate);
  const error = savedPlaces.mutationErrors?.[key];
  const label = !validTarget ? 'Saving unavailable' : signedOut ? 'Sign in to save' : pending ? (isSaved ? 'Removing…' : 'Saving…')
    : isSaved ? 'Remove favorite' : 'Save to Want to Try';

  function toggle() {
    if (signedOut) savedPlaces.requestLogin?.();
    else if (dish) savedPlaces.toggleFavoriteDish(dish);
    else savedPlaces.toggleFavorite(restaurant);
  }

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={signedOut ? `Sign in to save ${name}`
          : isSaved ? `Remove ${name} from Want to Try` : `Save ${name} to Want to Try`}
        accessibilityState={{ disabled, busy: pending }}
        disabled={disabled}
        onPress={toggle}
        style={({ pressed }) => [styles.button, isSaved && styles.saved, pressed && styles.pressed, disabled && styles.disabled]}
      >
        <Text style={styles.label}>{label}</Text>
      </Pressable>
      {error && <Text accessibilityRole="alert" style={styles.error}>{error.message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6, alignSelf: 'flex-start' },
  button: {
    alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44,
    paddingHorizontal: 14, borderRadius: 22, borderWidth: 1,
    borderColor: '#b8cbb7', backgroundColor: '#fff',
  },
  saved: { backgroundColor: '#e5eee1' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
  label: { color: '#31563c', fontWeight: '600', fontSize: 13 },
  error: { color: '#9b3029', fontSize: 13, lineHeight: 18 },
});
