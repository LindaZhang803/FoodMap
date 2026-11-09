import React, {
  useEffect,
  useState,
} from "react";

import {
  View,
  Text,
  Modal,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";

import { DEFAULT_FILTERS } from "../utils/restaurantFilters";

import {
  colors,
  spacing,
  radius,
  typography,
} from "../../../shared/design/tokens";

import {
  AppButton,
  AppInput,
} from "../../../shared/design/UIComponents";

import AppIcon from "../../../shared/components/AppIcon";

// =====================================================
// Filter Options
// =====================================================

const OPTIONS = {
  cuisine: [
    ["All", ""],
    ["American", "american"],
    ["Chinese", "chinese"],
    ["Italian", "italian"],
    ["Japanese", "japanese"],
    ["Mexican", "mexican"],
    ["Other", "other"],
  ],

  minRating: [
    ["Any", null],
    ["3.0+", 3],
    ["4.0+", 4],
    ["4.5+", 4.5],
  ],

  distance: [
    ["Any", null],
    ["1 km", 1],
    ["5 km", 5],
    ["10 km", 10],
    ["20 km", 20],
  ],
};

// =====================================================
// Restaurant Filter
// =====================================================

export default function RestaurantFilter({
  visible,
  filters,
  onApply,
  onClose,
}) {
  const [draft, setDraft] = useState({
    ...filters,
  });

  // =====================================================
  // 1. Synchronize Filters
  // =====================================================

  useEffect(() => {
    if (visible) {
      setDraft({
        ...filters,
      });
    }
  }, [visible, filters]);

  // =====================================================
  // 2. Update Filter
  // =====================================================

  function updateField(field, value) {
    setDraft((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  // =====================================================
  // 3. Render Filter Options
  // =====================================================

  function renderOptions(
    title,
    field,
    clearCustomDistance = false
  ) {
    return (
      <View style={styles.section}>
        <Text style={styles.heading}>
          {title}
        </Text>

        <View style={styles.options}>
          {OPTIONS[field].map(([label, value]) => {
            const selected =
              draft[field] === value;

            return (
              <Pressable
                key={label}
                accessibilityRole="button"
                accessibilityLabel={`${title}: ${label}`}
                accessibilityState={{
                  selected,
                }}
                style={({ pressed }) => [
                  styles.option,
                  selected &&
                    styles.selectedOption,
                  pressed &&
                    styles.pressed,
                ]}
                onPress={() => {
                  setDraft((previous) => ({
                    ...previous,

                    [field]: value,

                    ...(clearCustomDistance
                      ? {
                          customDistance: "",
                        }
                      : {}),
                  }));
                }}
              >
                <Text
                  style={[
                    styles.optionText,

                    selected &&
                      styles.selectedText,
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
  }

  // =====================================================
  // 4. Clear Filters
  // =====================================================

  function clearFilters() {
    const cleared = {
      ...DEFAULT_FILTERS,
    };

    setDraft(cleared);

    onApply(cleared);
  }

  // =====================================================
  // 5. Apply Filters
  // =====================================================

  function applyFilters() {
    onApply(draft);
  }

  // =====================================================
  // 6. Render
  // =====================================================

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* ============================================
            Header
        ============================================ */}

        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.titleRow}>
              <AppIcon
                name="filter"
                size={24}
                color={colors.primary}
              />

              <Text style={styles.title}>
                Filters
              </Text>
            </View>

            <Text style={styles.subtitle}>
              Find restaurants that match your preferences
            </Text>
          </View>

          {/* Close Button */}
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close filters"
            hitSlop={8}
            style={({ pressed }) => [
              styles.closeButton,

              pressed &&
                styles.pressed,
            ]}
          >
            <AppIcon
              name="close"
              size={22}
              color={colors.textSecondary}
            />
          </Pressable>
        </View>

        {/* ============================================
            Scrollable Content
        ============================================ */}

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* ==========================================
              Cuisine Type
          ========================================== */}

          {renderOptions(
            "Cuisine Type",
            "cuisine"
          )}

          {/* ==========================================
              Price Range
          ========================================== */}

          <View style={styles.section}>
            <View style={styles.sectionHeadingRow}>
              <AppIcon
                name="price"
                size={19}
                color={colors.primary}
              />

              <Text style={styles.sectionHeadingText}>
                Price Range
              </Text>
            </View>

            <Text style={styles.description}>
              Enter your preferred price range in USD.
            </Text>

            <View style={styles.inputRow}>
              {/* Minimum Price */}
              <AppInput
                label="Minimum Price"
                leftIcon="price"
                accessibilityLabel="Minimum Price"
                placeholder="e.g. 10"
                keyboardType="decimal-pad"
                value={String(
                  draft.minPrice ?? ""
                )}
                onChangeText={(value) =>
                  updateField(
                    "minPrice",
                    value
                  )
                }
                containerStyle={styles.inputGroup}
              />

              {/* Maximum Price */}
              <AppInput
                label="Maximum Price"
                leftIcon="price"
                accessibilityLabel="Maximum Price"
                placeholder="e.g. 50"
                keyboardType="decimal-pad"
                value={String(
                  draft.maxPrice ?? ""
                )}
                onChangeText={(value) =>
                  updateField(
                    "maxPrice",
                    value
                  )
                }
                containerStyle={styles.inputGroup}
              />
            </View>
          </View>

          {/* ==========================================
              Minimum Rating
          ========================================== */}

          {renderOptions(
            "Minimum Rating",
            "minRating"
          )}

          {/* ==========================================
              Maximum Distance
          ========================================== */}

          {renderOptions(
            "Maximum Distance",
            "distance",
            true
          )}

          {/* ==========================================
              Custom Distance
          ========================================== */}

          <View style={styles.section}>
            <View style={styles.sectionHeadingRow}>
              <AppIcon
                name="location"
                size={19}
                color={colors.primary}
              />

              <Text style={styles.sectionHeadingText}>
                Custom Distance
              </Text>
            </View>

            <Text style={styles.description}>
              Or enter a custom maximum distance.
            </Text>

            <AppInput
              label="Custom Distance (km)"
              leftIcon="location"
              accessibilityLabel="Custom Distance"
              placeholder="Enter distance in km"
              keyboardType="decimal-pad"
              value={String(
                draft.customDistance ?? ""
              )}
              onChangeText={(value) => {
                setDraft((previous) => ({
                  ...previous,

                  customDistance: value,

                  distance: null,
                }));
              }}
              containerStyle={
                styles.customDistanceInput
              }
            />
          </View>
        </ScrollView>

        {/* ============================================
            Footer
        ============================================ */}

        <View style={styles.footer}>
          {/* Clear Filters */}
          <AppButton
            title="Clear Filters"
            icon="refresh"
            variant="secondary"
            onPress={clearFilters}
            style={styles.footerButton}
            textStyle={styles.footerButtonText}
          />

          {/* Show Results */}
          <AppButton
            title="Show Results"
            icon="check"
            onPress={applyFilters}
            style={styles.footerButton}
            textStyle={styles.footerButtonText}
          />
        </View>
      </View>
    </Modal>
  );
}

// =====================================================
// Styles
// =====================================================

const styles = StyleSheet.create({
  // =====================================================
  // Container
  // =====================================================

  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // =====================================================
  // Header
  // =====================================================

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",

    gap: spacing.md,

    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,

    backgroundColor: colors.surface,

    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  headerContent: {
    flex: 1,
    minWidth: 0,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },

  title: {
    ...typography.title,
    color: colors.text,
  },

  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,

    marginTop: spacing.sm,

    maxWidth: 280,
  },

  closeButton: {
    width: 40,
    height: 40,

    borderRadius: radius.pill,

    backgroundColor: colors.surfaceSecondary,

    justifyContent: "center",
    alignItems: "center",
  },

  // =====================================================
  // ScrollView
  // =====================================================

  scrollView: {
    flex: 1,
  },

  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
  },

  // =====================================================
  // Sections
  // =====================================================

  section: {
    marginBottom: spacing.xxl,
  },

  heading: {
    ...typography.section,
    color: colors.text,

    marginBottom: spacing.md,
  },

  sectionHeadingRow: {
    flexDirection: "row",
    alignItems: "center",

    gap: spacing.sm,

    marginBottom: spacing.md,
  },

  sectionHeadingText: {
    ...typography.section,
    color: colors.text,
  },

  description: {
    ...typography.caption,
    color: colors.textSecondary,

    marginBottom: spacing.md,
  },

  // =====================================================
  // Filter Options
  // =====================================================

  options: {
    flexDirection: "row",
    flexWrap: "wrap",

    gap: spacing.sm,
  },

  option: {
    minHeight: 42,

    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,

    borderRadius: radius.pill,

    borderWidth: 1,
    borderColor: colors.border,

    backgroundColor: colors.surface,

    justifyContent: "center",
    alignItems: "center",
  },

  selectedOption: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  optionText: {
    ...typography.caption,

    fontWeight: "600",
    color: colors.textSecondary,
  },

  selectedText: {
    color: colors.white,
    fontWeight: "700",
  },

  pressed: {
    opacity: 0.8,
  },

  // =====================================================
  // Inputs
  // =====================================================

  inputRow: {
    flexDirection: "row",

    gap: spacing.md,
  },

  inputGroup: {
    flex: 1,
    minWidth: 0,
  },

  customDistanceInput: {
    marginBottom: 0,
  },

  // =====================================================
  // Footer
  // =====================================================

  footer: {
    flexDirection: "row",

    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,

    gap: spacing.md,

    borderTopWidth: 1,
    borderTopColor: colors.border,

    backgroundColor: colors.surface,
  },

  footerButton: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: spacing.sm,
  },

  footerButtonText: {
    fontSize: 13,
  },
});