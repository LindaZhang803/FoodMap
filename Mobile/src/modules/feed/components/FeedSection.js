import React from "react";

import {
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  colors,
  spacing,
  typography,
} from "../../../shared/design/tokens";

import {
  EmptyState,
} from "../../../shared/design/UIComponents";

/**
 * Rendering preserves the ranked entry order.
 * No fetching or ranking belongs here.
 */
export default function FeedSection({
  title,
  subtitle,
  data,
  renderItem,
  keyExtractor = (entry) => entry.key,
  status,
  header,
  refreshing = false,
  onRefresh,
  showEmpty = true,
}) {
  const listHeader = (
    <View>
      {header}

      {(title || subtitle) && (
        <View style={styles.heading}>
          {title && (
            <Text
              accessibilityRole="header"
              style={styles.title}
            >
              {title}
            </Text>
          )}

          {subtitle && (
            <Text style={styles.subtitle}>
              {subtitle}
            </Text>
          )}
        </View>
      )}

      {status}
    </View>
  );

  const emptyContent = showEmpty ? (
    <EmptyState
      title="No Places Here Yet"
      description="Check back soon or refresh to try again."
      style={styles.empty}
    />
  ) : null;

  return (
    <FlatList
      testID="feed-list"
      style={styles.list}
      contentContainerStyle={styles.content}
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      refreshing={refreshing}
      onRefresh={onRefresh}
      initialNumToRender={5}
      windowSize={7}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={emptyContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.background,
  },

  content: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
  },

  heading: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },

  title: {
    ...typography.title,
    color: colors.text,
  },

  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },

  empty: {
    minHeight: 240,
    paddingVertical: spacing.xxxl,
  },
});