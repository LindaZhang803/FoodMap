import React, {
  useEffect,
  useState,
} from "react";

import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";

import {
  colors,
  spacing,
  radius,
  typography,
} from "../../../shared/design/tokens";

import AppIcon from "../../../shared/components/AppIcon";

// =====================================================
// Questionnaire Options
// =====================================================

const SPICINESS_OPTIONS = [
  { value: 1, label: "Very Mild" },
  { value: 2, label: "Mild" },
  { value: 3, label: "Medium" },
  { value: 4, label: "Hot" },
  { value: 5, label: "Very Hot" },
];

const FREQUENCY_OPTIONS = [
  { value: "never", label: "Never" },
  { value: "rarely", label: "Rarely" },
  { value: "sometimes", label: "Sometimes" },
  { value: "often", label: "Often" },
  { value: "everyDay", label: "Every Day" },
];

const EMPTY_PREFERENCES = {
  preferredSpiciness: null,
  spicyFoodFrequency: null,
  maximumSpiciness: null,
};

// =====================================================
// Helpers
// =====================================================

function normalizePreferences(values) {
  return {
    preferredSpiciness:
      values?.preferredSpiciness ?? null,

    spicyFoodFrequency:
      values?.spicyFoodFrequency ?? null,

    maximumSpiciness:
      values?.maximumSpiciness ?? null,
  };
}

function validatePreferences(values) {
  const {
    preferredSpiciness,
    spicyFoodFrequency,
    maximumSpiciness,
  } = values;

  if (
    !Number.isInteger(preferredSpiciness) ||
    preferredSpiciness < 1 ||
    preferredSpiciness > 5
  ) {
    return "Please select your preferred spiciness level.";
  }

  const validFrequency = FREQUENCY_OPTIONS.some(
    (option) =>
      option.value === spicyFoodFrequency
  );

  if (!validFrequency) {
    return "Please select how often you eat spicy food.";
  }

  if (
    !Number.isInteger(maximumSpiciness) ||
    maximumSpiciness < 1 ||
    maximumSpiciness > 5
  ) {
    return "Please select your maximum spiciness level.";
  }

  if (maximumSpiciness < preferredSpiciness) {
    return "Maximum spiciness cannot be lower than your preferred spiciness.";
  }

  return null;
}

// =====================================================
// Reusable Question
// =====================================================

function QuestionSection({
  number,
  title,
  description,
  options,
  selectedValue,
  onSelect,
  disabled,
}) {
  return (
    <View style={styles.questionCard}>
      <View style={styles.questionHeader}>
        <View style={styles.numberBadge}>
          <Text style={styles.numberText}>
            {number}
          </Text>
        </View>

        <Text style={styles.questionTitle}>
          {title}
        </Text>
      </View>

      <Text style={styles.questionDescription}>
        {description}
      </Text>

      <View style={styles.optionsContainer}>
        {options.map((option) => {
          const selected =
            selectedValue === option.value;

          return (
            <Pressable
              key={String(option.value)}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{
                checked: selected,
                disabled: Boolean(disabled),
              }}
              disabled={disabled}
              onPress={() =>
                onSelect(option.value)
              }
              style={({ pressed }) => [
                styles.optionButton,

                selected &&
                  styles.selectedOption,

                pressed &&
                  !disabled &&
                  styles.pressed,

                disabled &&
                  styles.disabled,
              ]}
            >
              <Text
                style={[
                  styles.optionText,

                  selected &&
                    styles.selectedOptionText,
                ]}
              >
                {option.label}
              </Text>

              <View
                style={[
                  styles.radioOuter,

                  selected &&
                    styles.radioOuterSelected,
                ]}
              >
                {selected && (
                  <View
                    style={styles.radioInner}
                  />
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// =====================================================
// Spiciness Questionnaire Screen
// =====================================================

export default function SpicinessQuestionnaireScreen({
  initialValues = EMPTY_PREFERENCES,
  onSubmit,
  onBack,
  saving = false,
}) {
  // =====================================================
  // 1. Form State
  // =====================================================

  const [preferences, setPreferences] =
    useState(() =>
      normalizePreferences(initialValues)
    );

  const [error, setError] =
    useState(null);

  const [submitting, setSubmitting] =
    useState(false);

  const busy = saving || submitting;

  // =====================================================
  // 2. Load Existing Preferences
  // =====================================================

  useEffect(() => {
    setPreferences(
      normalizePreferences(initialValues)
    );

    setError(null);
  }, [
    initialValues?.preferredSpiciness,
    initialValues?.spicyFoodFrequency,
    initialValues?.maximumSpiciness,
  ]);

  // =====================================================
  // 3. Update Answers
  // =====================================================

  function updatePreference(field, value) {
    if (busy) {
      return;
    }

    setPreferences((current) => ({
      ...current,
      [field]: value,
    }));

    setError(null);
  }

  // =====================================================
  // 4. Validation
  // =====================================================

  function validateForm() {
    return validatePreferences(preferences);
  }

  // =====================================================
  // 5. Submit
  // =====================================================

  async function handleSubmit() {
    if (busy) {
      return;
    }

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    if (typeof onSubmit !== "function") {
      setError(
        "Saving preferences is not connected yet."
      );

      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await onSubmit({
        ...preferences,
      });

      // The parent must confirm that saving succeeded.
      if (result === false) {
        throw new Error(
          "Unable to save preferences."
        );
      }

      // Navigation or a success message is handled
      // by the parent after the API confirms saving.
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save preferences."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // =====================================================
  // 6. Reset Answers
  // =====================================================

  function resetAnswers() {
    if (busy) {
      return;
    }

    setPreferences({
      ...EMPTY_PREFERENCES,
    });

    setError(null);
  }

  // =====================================================
  // 7. Render
  // =====================================================

  return (
    <View style={styles.container}>
      {/* Header */}

      <View style={styles.header}>
        {typeof onBack === "function" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to profile"
            onPress={onBack}
            disabled={busy}
            style={styles.backButton}
          >
            <AppIcon
              name="back"
              size={24}
              color={colors.primary}
            />
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}

        <Text style={styles.headerTitle}>
          Spiciness Preferences
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Introduction */}

        <View style={styles.introduction}>
          <Text style={styles.title}>
            Your Spiciness Preferences
          </Text>

          <Text style={styles.subtitle}>
            Tell us about your spice preferences
            to help personalize your food experience.
          </Text>
        </View>

        {/* Question 1 */}

        <QuestionSection
          number="1"
          title="Preferred Spiciness"
          description="What level of spiciness do you usually prefer?"
          options={SPICINESS_OPTIONS}
          selectedValue={
            preferences.preferredSpiciness
          }
          disabled={busy}
          onSelect={(value) =>
            updatePreference(
              "preferredSpiciness",
              value
            )
          }
        />

        {/* Question 2 */}

        <QuestionSection
          number="2"
          title="Spicy Food Frequency"
          description="How often do you eat spicy food?"
          options={FREQUENCY_OPTIONS}
          selectedValue={
            preferences.spicyFoodFrequency
          }
          disabled={busy}
          onSelect={(value) =>
            updatePreference(
              "spicyFoodFrequency",
              value
            )
          }
        />

        {/* Question 3 */}

        <QuestionSection
          number="3"
          title="Maximum Preferred Spiciness"
          description="What is the maximum spiciness level you are comfortable eating?"
          options={SPICINESS_OPTIONS}
          selectedValue={
            preferences.maximumSpiciness
          }
          disabled={busy}
          onSelect={(value) =>
            updatePreference(
              "maximumSpiciness",
              value
            )
          }
        />

        {/* Error Message */}

        {error && (
          <View style={styles.errorContainer}>
            <Text
              accessibilityRole="alert"
              style={styles.errorText}
            >
              {error}
            </Text>
          </View>
        )}

        {/* Actions */}

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save Preferences"
            accessibilityState={{
              disabled: busy,
              busy,
            }}
            disabled={busy}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.submitButton,

              pressed &&
                styles.pressed,

              busy &&
                styles.disabled,
            ]}
          >
            {busy ? (
              <ActivityIndicator
                color={colors.white}
              />
            ) : (
              <Text style={styles.submitText}>
                Save Preferences
              </Text>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reset Answers"
            disabled={busy}
            onPress={resetAnswers}
            style={({ pressed }) => [
              styles.resetButton,

              pressed &&
                styles.pressed,
            ]}
          >
            <Text style={styles.resetText}>
              Reset Answers
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

// =====================================================
// Styles
// =====================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  header: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  backButton: {
    width: 42,
    height: 42,
    justifyContent: "center",
    alignItems: "center",
  },

  headerSpacer: {
    width: 42,
  },

  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
    flexShrink: 1,
  },

  scrollView: {
    flex: 1,
  },

  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },

  introduction: {
    marginBottom: spacing.xl,
  },

  title: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.sm,
  },

  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },

  questionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },

  questionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },

  numberBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },

  numberText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },

  questionTitle: {
    ...typography.section,
    color: colors.text,
    flex: 1,
  },

  questionDescription: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },

  optionsContainer: {
    gap: spacing.sm,
  },

  optionButton: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },

  selectedOption: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },

  optionText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },

  selectedOptionText: {
    color: colors.primary,
    fontWeight: "700",
  },

  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },

  radioOuterSelected: {
    borderColor: colors.primary,
  },

  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },

  errorContainer: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.errorLight,
    marginBottom: spacing.lg,
  },

  errorText: {
    ...typography.caption,
    color: colors.error,
  },

  actions: {
    gap: spacing.md,
    marginTop: spacing.md,
  },

  submitButton: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },

  submitText: {
    ...typography.button,
    color: colors.white,
  },

  resetButton: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },

  resetText: {
    ...typography.button,
    color: colors.textSecondary,
  },

  pressed: {
    opacity: 0.75,
  },

  disabled: {
    opacity: 0.5,
  },
});