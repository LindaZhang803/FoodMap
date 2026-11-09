import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

/** Rendering preserves the ordered array. No fetching or ranking belongs here. */
export default function FeedSection({ title, subtitle, data, renderItem, keyExtractor = entry => entry.key,
  status, header, refreshing = false, onRefresh, showEmpty = true }) {
  return <FlatList testID="feed-list" style={styles.list} contentContainerStyle={styles.content}
    data={data} renderItem={renderItem} keyExtractor={keyExtractor}
    refreshing={refreshing} onRefresh={onRefresh} initialNumToRender={5} windowSize={7}
    ListHeaderComponent={<View>{header}{(title || subtitle) && <View style={styles.heading}>
      {title && <Text accessibilityRole="header" style={styles.title}>{title}</Text>}
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>}{status}</View>}
    ListEmptyComponent={showEmpty ? <View style={styles.empty}>
      <Text style={styles.emptyTitle}>No places here yet</Text>
      <Text style={styles.subtitle}>Check back soon or refresh to try again.</Text>
    </View> : null}
  />;
}
const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 30, width: '100%', maxWidth: 680, alignSelf: 'center', flexGrow: 1 },
  heading: { marginBottom: 16, gap: 8 },
  title: { fontSize: 24, lineHeight: 32, fontWeight: 'bold', color: '#222' },
  subtitle: { fontSize: 14, lineHeight: 22, color: '#666' },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#222' },
});
