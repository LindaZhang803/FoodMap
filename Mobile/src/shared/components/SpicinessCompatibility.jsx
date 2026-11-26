import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, spacing, typography } from "../design/tokens";

const labels = new Set(["Within Preference", "Above Preference", "Unknown"]);

export function describeSpicinessCompatibility(dish) {
  const label = dish?.spicinessCompatibility;
  return labels.has(label) ? `Spiciness compatibility: ${label}` : null;
}

export function SpicinessCompatibilityNote({ dishes }) {
  const dish = dishes.find(
    (item) =>
      describeSpicinessCompatibility(item) &&
      typeof item.spicinessCompatibilityNote === "string" &&
      item.spicinessCompatibilityNote
  );

  return dish ? (
    <Text style={styles.note}>{dish.spicinessCompatibilityNote}</Text>
  ) : null;
}

export default function SpicinessCompatibility({ dish, showNote = false }) {
  const description = describeSpicinessCompatibility(dish);
  if (!description) return null;

  return (
    <View style={styles.compatibility}>
      <Text
        style={styles.label}
        accessibilityLabel={description}
      >
        {dish.spicinessCompatibility}
      </Text>
      {showNote && <SpicinessCompatibilityNote dishes={[dish]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  compatibility: {
    gap: spacing.xs,
  },
  label: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "700",
  },
  note: {
    ...typography.caption,
    color: colors.text,
  },
});
