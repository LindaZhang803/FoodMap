import React from "react";

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  colors,
  spacing,
  radius,
  typography,
} from "../../../shared/design/tokens";

import {
  LoadingState,
} from "../../../shared/design/UIComponents";

import AppIcon from "../../../shared/components/AppIcon";

// =====================================================
// Retry Button
// =====================================================

export function RetryButton({
  onPress,
  label = "Try again",
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
      ]}
    >
      <AppIcon
        name="refresh"
        size={17}
        color={colors.white}
      />

      <Text style={styles.buttonText}>
        {label}
      </Text>
    </Pressable>
  );
}

// =====================================================
// Feed Status
// =====================================================

export default function FeedStatus({
  loading,
  refreshing,
  preferencesLoading,
  resourceError,
  dishError,
  preferenceStatus,
  entries = [],
  coverage,
  onRetry,
  showSummary = true,
}) {
  // =====================================================
  // 1. Initial loading
  // =====================================================

  if (
    loading &&
    entries.length === 0
  ) {
    return (
      <View
        style={styles.loadingContainer}
        accessibilityLiveRegion="polite"
      >
        <LoadingState
          message="Finding places to try..."
          style={styles.loadingState}
        />
      </View>
    );
  }

  // =====================================================
  // 2. Feed loading error
  // =====================================================

  if (resourceError) {
    const hasPreviousEntries =
      entries.length > 0;

    return (
      <View
        style={styles.errorNotice}
        accessibilityLiveRegion="polite"
      >
        <View style={styles.noticeHeader}>
          <AppIcon
            name="error"
            size={20}
            color={colors.error}
          />

          <Text style={styles.errorHeading}>
            {hasPreviousEntries
              ? "Could Not Refresh Places"
              : "Could Not Load Places"}
          </Text>
        </View>

        <Text style={styles.message}>
          {hasPreviousEntries
            ? "Your previous places are still available."
            : "Check your connection and try again."}
        </Text>

        <RetryButton
          onPress={onRetry}
        />
      </View>
    );
  }

  // =====================================================
  // 3. Recommendation status
  // =====================================================

  const recommendationError =
    dishError ||
    preferenceStatus === "unavailable";

  if (
    !showSummary &&
    !recommendationError &&
    !refreshing &&
    !preferencesLoading &&
    coverage?.complete !== false
  ) {
    return null;
  }

  let message;

  if (recommendationError) {
    message =
      "Showing popular places while recommendations are unavailable.";
  } else if (preferencesLoading) {
    message =
      "Loading your taste preferences...";
  } else if (
    preferenceStatus === "empty" ||
    preferenceStatus === "signed-out"
  ) {
    message =
      "Add taste preferences to personalize your feed.";
  } else if (
    !entries.some(
      (entry) =>
        entry.rankingMode === "personalized"
    )
  ) {
    message =
      "Showing popular places. Taste matches are not available for these dishes yet.";
  } else {
    message =
      "Ordered by how closely each restaurant's best dish matches your taste.";
  }

  // =====================================================
  // 4. Status notice
  // =====================================================

  return (
    <View
      style={[
        styles.notice,
        recommendationError &&
          styles.warningNotice,
      ]}
      accessibilityLiveRegion="polite"
    >
      {(showSummary ||
        recommendationError) && (
        <View style={styles.noticeRow}>
          <AppIcon
            name={
              recommendationError
                ? "warning"
                : "info"
            }
            size={18}
            color={
              recommendationError
                ? colors.warning
                : colors.primary
            }
          />

          <Text style={styles.message}>
            {message}
          </Text>
        </View>
      )}

      {coverage &&
        !coverage.complete && (
          <Text style={styles.coverageText}>
            Dish information covers part of this catalog.
          </Text>
        )}

      {(refreshing ||
        preferencesLoading) && (
        <View style={styles.loadingRow}>
          <ActivityIndicator
            size="small"
            color={colors.primary}
            accessibilityLabel="Updating feed"
          />

          <Text style={styles.loadingText}>
            Updating...
          </Text>
        </View>
      )}

      {recommendationError && (
        <RetryButton
          onPress={onRetry}
          label="Retry Recommendations"
        />
      )}
    </View>
  );
}

// =====================================================
// Styles
// =====================================================

const styles = StyleSheet.create({
  loadingContainer: {
    paddingVertical: spacing.xxl,
  },

  loadingState: {
    minHeight: 140,
  },

  notice: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
  },

  warningNotice: {
    backgroundColor: colors.warningLight,
  },

  errorNotice: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.errorLight,
    borderRadius: radius.md,
  },

  noticeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },

  noticeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },

  errorHeading: {
    ...typography.section,
    color: colors.text,
    flex: 1,
  },

  message: {
    ...typography.body,
    color: colors.textSecondary,
    flexShrink: 1,
  },

  coverageText: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },

  loadingText: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  button: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },

  buttonText: {
    ...typography.button,
    color: colors.white,
  },

  pressed: {
    opacity: 0.8,
  },
});