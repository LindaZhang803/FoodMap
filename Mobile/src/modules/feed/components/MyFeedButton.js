import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { toFeedSession } from '../services/accountSession';

/** Host places this immediately after Near Me and owns both navigation callbacks. */
export default function MyFeedButton({ auth, onOpenFeed, onLoginRequired }) {
  const session = toFeedSession(auth);
  const onPress = session ? onOpenFeed : onLoginRequired;
  const pending = ['restoring', 'signingIn', 'signingOut', 'clearing'].includes(auth?.phase);
  const disabled = pending || typeof onPress !== 'function';

  return <Pressable accessibilityRole="button" accessibilityLabel="My Feed"
    accessibilityHint={session ? 'Open your feed' : 'Sign in to load your feed'}
    accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={[styles.button, disabled && styles.disabled]}>
    <Text style={styles.text}>My Feed</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14,
    borderRadius: 8, backgroundColor: '#007bff' },
  disabled: { opacity: 0.5 },
  text: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
