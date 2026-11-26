import React, {
  useMemo,
} from "react";

import {
  View,
  StyleSheet,
} from "react-native";

import FoodPostCard from "./FoodPostCard";
import {
  describeSpicinessCompatibility,
  SpicinessCompatibilityNote,
} from "../../../shared/components/SpicinessCompatibility";

import {
  spacing,
} from "../../../shared/design/tokens";

// =====================================================
// Estimate Card Height
// =====================================================

function estimateHeight(post) {
  const ratio =
    Number(post.coverAspectRatio) || 1;

  const safeRatio = Math.max(
    0.5,
    Math.min(2, ratio)
  );

  const imageHeight =
    180 / safeRatio;

  const titleLength =
    String(post.title || "").length;

  const titleHeight =
    titleLength > 25 ? 45 : 25;

  const compatibilityHeight = describeSpicinessCompatibility(post.dish)
    ? 24
    : 0;

  return imageHeight + titleHeight + 75 + compatibilityHeight;
}

// =====================================================
// Split Posts Into Two Independent Columns
// =====================================================

function splitColumns(posts) {
  const left = [];
  const right = [];

  let leftHeight = 0;
  let rightHeight = 0;

  for (const post of posts) {
    const height = estimateHeight(post);

    if (leftHeight <= rightHeight) {
      left.push(post);
      leftHeight += height;
    } else {
      right.push(post);
      rightHeight += height;
    }
  }

  return {
    left,
    right,
  };
}

// =====================================================
// Food Post Grid
// =====================================================

export default function FoodPostGrid({
  posts = [],
  onPostPress,
  onLikePress,
  likingIds = [],
}) {
  const columns = useMemo(
    () => splitColumns(posts),
    [posts]
  );

  const pending = useMemo(
    () => new Set(likingIds),
    [likingIds]
  );

  function renderColumn(items) {
    return items.map((post) => (
      <FoodPostCard
        key={post.id}
        post={post}
        onPress={onPostPress}
        onLikePress={onLikePress}
        liking={pending.has(post.id)}
      />
    ));
  }

  return (
    <View style={styles.feed}>
      <SpicinessCompatibilityNote dishes={posts.map((post) => post.dish)} />

      <View style={styles.grid}>
        <View style={styles.column}>
          {renderColumn(columns.left)}
        </View>

        <View style={styles.column}>
          {renderColumn(columns.right)}
        </View>
      </View>
    </View>
  );
}

// =====================================================
// Styles
// =====================================================

const styles = StyleSheet.create({
  feed: {
    gap: spacing.sm,
  },

  grid: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },

  column: {
    flex: 1,
    minWidth: 0,
  },
});