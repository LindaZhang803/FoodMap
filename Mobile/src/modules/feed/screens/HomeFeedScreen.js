import React, { useCallback } from "react";

import {
  StyleSheet,
  View,
} from "react-native";

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import usePersonalizedFeed from "../hooks/usePersonalizedFeed";

import FeedSection from "../components/FeedSection";

import FeedRestaurantItem from "../components/FeedRestaurantItem";

import FeedStatus, {
  RetryButton,
} from "../components/FeedStatus";

import {
  colors,
  spacing,
} from "../../../shared/design/tokens";

/**
 * The host supplies identity, repositories,
 * and restaurant navigation.
 */
export default function HomeFeedScreen({
  feedRepository,
  preferenceRepository,
  userId = null,
  preferenceRevision = 0,
  policy,
  RestaurantCardComponent,
  onRestaurantPress,
  header,
  showIntro = false,
  renderRestaurantActions,
  showRefreshButton = false,
  safeAreaEdges,
}) {
  const feed = usePersonalizedFeed({
    feedRepository,
    preferenceRepository,
    userId,
    preferenceRevision,
    policy,
  });

  return (
    <HomeFeedView
      feed={feed}
      RestaurantCardComponent={RestaurantCardComponent}
      onRestaurantPress={onRestaurantPress}
      header={header}
      showIntro={showIntro}
      renderRestaurantActions={renderRestaurantActions}
      showRefreshButton={showRefreshButton}
      safeAreaEdges={safeAreaEdges}
    />
  );
}

/**
 * Presentational version for a host
 * that already owns the candidate snapshot.
 */
export function HomeFeedView({
  feed,
  RestaurantCardComponent,
  onRestaurantPress,
  header,
  showIntro = false,
  renderRestaurantActions,
  showRefreshButton = false,
  safeAreaEdges,
}) {
  // =====================================================
  // Restaurant item
  // =====================================================

  const renderItem = useCallback(
    ({ item }) => (
      <FeedRestaurantItem
        entry={item}
        RestaurantCardComponent={
          RestaurantCardComponent
        }
        onRestaurantPress={
          onRestaurantPress
        }
        renderRestaurantActions={
          renderRestaurantActions
        }
      />
    ),
    [
      RestaurantCardComponent,
      onRestaurantPress,
      renderRestaurantActions,
    ]
  );

  // =====================================================
  // Status and refresh
  // =====================================================

  const status = (
    <View style={styles.statusContainer}>
      <FeedStatus
        {...feed}
        showSummary={showIntro}
        onRetry={feed.refresh}
      />

      {showRefreshButton &&
        !feed.loading &&
        !feed.resourceError && (
          <View style={styles.refresh}>
            <RetryButton
              label="Refresh feed"
              onPress={feed.refresh}
            />
          </View>
        )}
    </View>
  );

  // =====================================================
  // Render
  // =====================================================

  return (
    <SafeAreaView
      style={styles.safe}
      edges={safeAreaEdges}
    >
      <View style={styles.body}>
        <FeedSection
          title={
            showIntro
              ? "Find your next favorite"
              : undefined
          }
          subtitle={
            showIntro
              ? "Good places. A dish picked for your taste."
              : undefined
          }
          data={feed.entries}
          renderItem={renderItem}
          header={header}
          refreshing={feed.refreshing}
          onRefresh={feed.refresh}
          showEmpty={
            !feed.loading &&
            !feed.resourceError
          }
          status={status}
        />
      </View>
    </SafeAreaView>
  );
}

// =====================================================
// Styles
// =====================================================

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },

  body: {
    flex: 1,
    minHeight: 0,
  },

  statusContainer: {
    width: "100%",
  },

  refresh: {
    alignSelf: "flex-start",
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
});