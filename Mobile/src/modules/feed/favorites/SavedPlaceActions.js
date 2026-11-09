import React from "react";

import {
  Pressable,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from "react-native";

import {
  colors,
  spacing,
  radius,
  typography,
} from "../../../shared/design/tokens";

export default function SavedPlaceActions({
  restaurant,
  dish,
  savedPlaces,
}) {
  const targetType = dish ? "dish" : "restaurant";
  const item = dish || restaurant;
  const targetId = dish ? dish.dishId : restaurant._id;
  const name = item.name;

  const key =
    `${targetType}:${String(targetId).toLowerCase()}`;

  const isSaved = savedPlaces.isSaved
    ? savedPlaces.isSaved(targetType, targetId)
    : dish
      ? savedPlaces.favoriteDishes.some(
          (saved) => saved.dishId === targetId
        )
      : savedPlaces.favorites.some(
          (saved) => saved._id === targetId
        );

  const signedOut = [
    "signed-out",
    "expired",
  ].includes(savedPlaces.status);

  const pending =
    savedPlaces.isPending?.(targetType, targetId) ||
    false;

  const validTarget =
    savedPlaces.canSaveTarget?.(
      targetType,
      targetId
    ) ?? true;

  const disabled =
    !validTarget ||
    pending ||
    (signedOut
      ? !savedPlaces.canRequestLogin
      : savedPlaces.status !== undefined &&
        !savedPlaces.canMutate);

  const error =
    savedPlaces.mutationErrors?.[key];

  const label = !validTarget
    ? "Saving unavailable"
    : signedOut
      ? "Sign in to save"
      : pending
        ? isSaved
          ? "Removing..."
          : "Saving..."
        : isSaved
          ? "Remove Favorite"
          : "Save to Want to Try";

  function toggle() {
    if (signedOut) {
      savedPlaces.requestLogin?.();
    } else if (dish) {
      savedPlaces.toggleFavoriteDish(dish);
    } else {
      savedPlaces.toggleFavorite(restaurant);
    }
  }

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          signedOut
            ? `Sign in to save ${name}`
            : isSaved
              ? `Remove ${name} from Want to Try`
              : `Save ${name} to Want to Try`
        }
        accessibilityState={{
          disabled,
          busy: pending,
        }}
        disabled={disabled}
        onPress={toggle}
        style={({ pressed }) => [
          styles.button,
          isSaved && styles.saved,
          pressed && !disabled && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        {pending ? (
          <ActivityIndicator
            size="small"
            color={colors.primary}
          />
        ) : (
          <Text style={styles.heart}>
            {isSaved ? "♥" : "♡"}
          </Text>
        )}

        <Text style={styles.label}>
          {label}
        </Text>
      </Pressable>

      {error && (
        <Text
          accessibilityRole="alert"
          style={styles.error}
        >
          {error.message}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
    alignSelf: "flex-start",
    maxWidth: "100%",
  },

  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },

  saved: {
    backgroundColor: colors.primaryLight,
  },

  pressed: {
    opacity: 0.75,
  },

  disabled: {
    opacity: 0.5,
  },

  heart: {
    color: colors.primary,
    fontSize: 20,
    lineHeight: 24,
  },

  label: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "700",
  },

  error: {
    ...typography.caption,
    color: colors.error,
    lineHeight: 18,
  },
});