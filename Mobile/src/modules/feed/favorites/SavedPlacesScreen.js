import React, { useState } from "react";

import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import RestaurantCard from "../components/RestaurantCard";
import SavedPlaceActions from "./SavedPlaceActions";

import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../../shared/design/tokens";

import {
  AppButton,
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../../shared/design/UIComponents";

const tabs = [
  {
    id: "restaurants",
    label: "Saved Restaurants",
  },
  {
    id: "dishes",
    label: "Saved Dishes",
  },
];

export default function SavedPlacesScreen({
  savedPlaces,
  RestaurantCardComponent = RestaurantCard,
  onRestaurantPress,
  onDishPress,
  header,
  safeAreaEdges,
  showRefreshButton = false,
}) {
  const [activeTab, setActiveTab] = useState(
    "restaurants"
  );

  const showRestaurants =
    activeTab === "restaurants";

  const targetType = showRestaurants
    ? "restaurant"
    : "dish";

  const data = savedPlaces.items
    ? savedPlaces.items.filter(
        (item) => item.targetType === targetType
      )
    : (
        showRestaurants
          ? savedPlaces.favorites
          : savedPlaces.favoriteDishes
      ).map((target) => ({
        targetType,
        targetId: showRestaurants
          ? target._id
          : target.dishId,
        target,
      }));

  const signedOut = [
    "signed-out",
    "expired",
  ].includes(savedPlaces.status);

  const isLoading =
    savedPlaces.status === "loading";

  const isFailed =
    savedPlaces.status === "failed";

  // =====================================================
  // Unavailable saved item
  // =====================================================

  function MissingTarget({ envelope }) {
    const pending =
      savedPlaces.isPending?.(
        envelope.targetType,
        envelope.targetId
      );

    const error =
      savedPlaces.mutationErrors?.[
        `${envelope.targetType}:${envelope.targetId}`
      ];

    return (
      <View style={styles.missingCard}>
        <Text style={styles.dishName}>
          Saved {envelope.targetType} unavailable
        </Text>

        <Text style={styles.description}>
          The original item is no longer in
          the catalog.
        </Text>

        <AppButton
          title={
            pending
              ? "Removing..."
              : "Remove from Want to Try"
          }
          variant="outline"
          disabled={Boolean(pending)}
          onPress={() =>
            savedPlaces.removeFavorite(
              envelope.targetType,
              envelope.targetId
            )
          }
          style={styles.removeButton}
        />

        {error && (
          <Text
            accessibilityRole="alert"
            style={styles.errorText}
          >
            {error.message}
          </Text>
        )}
      </View>
    );
  }

  // =====================================================
  // Saved item
  // =====================================================

  function renderItem({ item: envelope }) {
    const item = envelope.target;

    if (!item) {
      return (
        <MissingTarget envelope={envelope} />
      );
    }

    if (showRestaurants) {
      return (
        <View style={styles.restaurantItem}>
          <RestaurantCardComponent
            restaurant={item}
            onPress={
              onRestaurantPress
                ? () =>
                    onRestaurantPress(item._id)
                : undefined
            }
          />

          <View style={styles.restaurantActions}>
            <SavedPlaceActions
              restaurant={item}
              savedPlaces={savedPlaces}
            />
          </View>
        </View>
      );
    }

    return (
      <View style={styles.dishCard}>
        <View style={styles.dishHeader}>
          <View style={styles.dishIcon}>
            <Text style={styles.dishIconText}>
              F
            </Text>
          </View>

          <View style={styles.dishInfo}>
            <Text
              style={styles.dishName}
              numberOfLines={2}
            >
              {item.name}
            </Text>

            <Text style={styles.dishSubtitle}>
              Saved Dish
            </Text>
          </View>
        </View>

        <View style={styles.dishActions}>
          <SavedPlaceActions
            dish={item}
            savedPlaces={savedPlaces}
          />

          {onDishPress && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View dish ${item.name}`}
              onPress={() =>
                onDishPress(
                  item.dishId,
                  item.restaurantId
                )
              }
              style={styles.detailButton}
            >
              <Text style={styles.detailText}>
                View Details →
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  // =====================================================
  // Empty / Loading / Error
  // =====================================================

  function renderEmpty() {
    if (isLoading) {
      return (
        <LoadingState
          message="Loading Want to Try..."
          style={styles.emptyState}
        />
      );
    }

    if (isFailed) {
      return (
        <ErrorState
          title="Unable to Load Saved Items"
          message="Your saved list could not be loaded."
          onRetry={savedPlaces.retry}
          style={styles.emptyState}
        />
      );
    }

    if (signedOut) {
      return (
        <EmptyState
          title="Sign In Required"
          description="Sign in to see your saved restaurants and dishes."
          actionLabel={
            savedPlaces.canRequestLogin
              ? "Sign In"
              : undefined
          }
          onAction={
            savedPlaces.canRequestLogin
              ? savedPlaces.requestLogin
              : undefined
          }
          style={styles.emptyState}
        />
      );
    }

    return (
      <EmptyState
        title="Nothing Saved Yet"
        description={
          showRestaurants
            ? "Save a restaurant to find it here."
            : "Save a dish to find it here."
        }
        style={styles.emptyState}
      />
    );
  }

  // =====================================================
  // Header
  // =====================================================

  const listHeader = (
    <View style={styles.header}>
      {header}

      <View style={styles.titleSection}>
        <Text
          accessibilityRole="header"
          style={styles.title}
        >
          Want to Try
        </Text>

        <Text style={styles.subtitle}>
          Your favorite restaurants and dishes
          in one place.
        </Text>
      </View>

      {savedPlaces.error && (
        <Text
          accessibilityRole="alert"
          style={styles.errorText}
        >
          {savedPlaces.error.message}
        </Text>
      )}

      {showRefreshButton &&
        !signedOut &&
        !isFailed &&
        typeof savedPlaces.refresh === "function" && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh saved list"
            accessibilityState={{
              disabled: Boolean(savedPlaces.loading),
              busy: Boolean(savedPlaces.loading),
            }}
            disabled={Boolean(savedPlaces.loading)}
            onPress={savedPlaces.refresh}
            style={styles.refreshButton}
          >
            <Text style={styles.refreshText}>
              {savedPlaces.loading
                ? "Refreshing..."
                : "↻ Refresh Saved List"}
            </Text>
          </Pressable>
        )}

      <View style={styles.tabs}>
        {tabs.map(({ id, label }) => {
          const selected = activeTab === id;

          return (
            <Pressable
              key={id}
              accessibilityRole="tab"
              accessibilityState={{
                selected,
              }}
              onPress={() =>
                setActiveTab(id)
              }
              style={[
                styles.tab,
                selected && styles.activeTab,
              ]}
            >
              <Text
                style={[
                  styles.tabLabel,
                  selected && styles.activeLabel,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <SafeAreaView
      style={styles.safe}
      edges={safeAreaEdges}
    >
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={(item) =>
          `${item.targetType}:${item.targetId}`
        }
        ListHeaderComponent={listHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.content}
        refreshing={Boolean(
          savedPlaces.loading && data.length
        )}
        onRefresh={savedPlaces.refresh}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    flexGrow: 1,
  },

  header: {
    marginBottom: spacing.lg,
    gap: spacing.lg,
  },

  titleSection: {
    gap: spacing.xs,
  },

  title: {
    ...typography.title,
    color: colors.text,
  },

  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },

  tabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },

  tab: {
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  activeTab: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  tabLabel: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.textSecondary,
  },

  activeLabel: {
    color: colors.white,
  },

  restaurantItem: {
    marginBottom: spacing.lg,
  },

  restaurantActions: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },

  dishCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card,
  },

  dishHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },

  dishIcon: {
    width: 54,
    height: 54,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },

  dishIconText: {
    fontSize: 25,
    fontWeight: "800",
    color: colors.primary,
  },

  dishInfo: {
    flex: 1,
  },

  dishName: {
    ...typography.cardTitle,
    color: colors.text,
  },

  dishSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  dishActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.md,
  },

  detailButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },

  detailText: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.primary,
  },

  missingCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },

  description: {
    ...typography.body,
    color: colors.textSecondary,
  },

  removeButton: {
    alignSelf: "flex-start",
  },

  errorText: {
    ...typography.caption,
    color: colors.error,
  },

  refreshButton: {
    alignSelf: "flex-start",
    paddingVertical: spacing.sm,
  },

  refreshText: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.primary,
  },

  emptyState: {
    minHeight: 240,
  },
});