import React, { useState } from "react";

import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";

import {
  colors,
  spacing,
  radius,
  typography,
  sizes,
  shadows,
} from "./tokens";

import AppIcon from "../components/AppIcon";

// =====================================================
// 1. AppButton
// =====================================================

export function AppButton({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon = null,
  accessibilityLabel,
}) {
  const isPrimary = variant === "primary";
  const isSecondary = variant === "secondary";
  const isOutline = variant === "outline";
  const isDanger = variant === "danger";

  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{
        disabled: inactive,
        busy: loading,
      }}
      style={({ pressed }) => [
        styles.button,
        isPrimary && styles.primaryButton,
        isSecondary && styles.secondaryButton,
        isOutline && styles.outlineButton,
        isDanger && styles.dangerButton,
        inactive && styles.disabled,
        pressed && !inactive && styles.pressed,
        style,
      ]}
    >
      <View style={styles.buttonContent}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={
              isPrimary || isDanger
                ? colors.white
                : colors.primary
            }
          />
        ) : typeof icon === "string" ? (
          <AppIcon
            name={icon}
            size={sizes.iconMedium}
            color={
              isPrimary || isDanger
                ? colors.white
                : colors.primary
            }
          />
        ) : (
          icon
        )}

        <Text
          style={[
            styles.buttonText,
            (isSecondary || isOutline) &&
              styles.secondaryButtonText,
            textStyle,
          ]}
        >
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

// =====================================================
// 2. AppInput
// =====================================================

export function AppInput({
  label,
  error,
  style,
  containerStyle,

  leftIcon,
  rightIcon,

  secureTextEntry = false,
  showPasswordToggle = false,

  editable = true,
  onFocus,
  onBlur,

  ...props
}) {
  const [focused, setFocused] = useState(false);

  const [passwordVisible, setPasswordVisible] =
    useState(false);

  const passwordMode =
    secureTextEntry && showPasswordToggle;

  const isSecure =
    secureTextEntry &&
    !(passwordMode && passwordVisible);

  function handleFocus(event) {
    setFocused(true);
    onFocus?.(event);
  }

  function handleBlur(event) {
    setFocused(false);
    onBlur?.(event);
  }

  return (
    <View
      style={[
        styles.inputContainer,
        containerStyle,
      ]}
    >
      {label ? (
        <Text style={styles.inputLabel}>
          {label}
        </Text>
      ) : null}

      <View
        style={[
          styles.inputWrapper,

          focused &&
            editable &&
            styles.inputFocused,

          Boolean(error) &&
            styles.inputError,

          !editable &&
            styles.inputDisabled,
        ]}
      >
        {/* Left Icon */}
        {leftIcon && (
          <AppIcon
            name={leftIcon}
            size={sizes.iconMedium}
            color={
              focused
                ? colors.primary
                : colors.textMuted
            }
            style={styles.inputIcon}
          />
        )}

        {/* Input */}
        <TextInput
          {...props}
          editable={editable}
          secureTextEntry={isSecure}
          onFocus={handleFocus}
          onBlur={handleBlur}
          accessibilityLabel={
            props.accessibilityLabel ||
            label ||
            props.placeholder
          }
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          style={[
            styles.input,

            props.multiline &&
              styles.multilineInput,

            style,
          ]}
        />

        {/* Password Toggle */}
        {passwordMode ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              passwordVisible
                ? "Hide password"
                : "Show password"
            }
            accessibilityState={{
              disabled: !editable,
            }}
            disabled={!editable}
            onPress={() =>
              setPasswordVisible(
                (value) => !value
              )
            }
            hitSlop={8}
            style={styles.inputAction}
          >
            <AppIcon
              name={
                passwordVisible
                  ? "eyeOff"
                  : "eye"
              }
              size={sizes.iconMedium}
              color={colors.textSecondary}
            />
          </Pressable>
        ) : rightIcon ? (
          <AppIcon
            name={rightIcon}
            size={sizes.iconMedium}
            color={colors.textMuted}
            style={styles.inputIcon}
          />
        ) : null}
      </View>

      {/* Error Message */}
      {Boolean(error) && (
        <View style={styles.inputErrorRow}>
          <AppIcon
            name="error"
            size={sizes.iconSmall}
            color={colors.error}
          />

          <Text
            style={styles.inputErrorText}
            accessibilityRole="alert"
          >
            {typeof error === "string"
              ? error
              : "Invalid input"}
          </Text>
        </View>
      )}
    </View>
  );
}

// =====================================================
// 3. AppCard
// =====================================================

export function AppCard({
  children,
  style,
  elevated = false,
}) {
  return (
    <View
      style={[
        styles.card,
        elevated && shadows.card,
        style,
      ]}
    >
      {children}
    </View>
  );
}

// =====================================================
// 4. AppPage
// =====================================================

export function AppPage({
  children,
  style,
  padded = false,
}) {
  return (
    <View
      style={[
        styles.page,
        padded && styles.paddedPage,
        style,
      ]}
    >
      {children}
    </View>
  );
}

// =====================================================
// 5. SectionHeading
// =====================================================

export function SectionHeading({
  title,
  subtitle,
  style,
}) {
  return (
    <View
      style={[
        styles.headingContainer,
        style,
      ]}
    >
      <Text
        accessibilityRole="header"
        style={styles.headingTitle}
      >
        {title}
      </Text>

      {subtitle ? (
        <Text style={styles.headingSubtitle}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

// =====================================================
// 6. LoadingState
// =====================================================

export function LoadingState({
  message = "Loading...",
  style,
}) {
  return (
    <View
      style={[
        styles.stateContainer,
        style,
      ]}
      accessibilityLiveRegion="polite"
    >
      <ActivityIndicator
        size="large"
        color={colors.primary}
        accessibilityLabel="Loading"
      />

      <Text style={styles.stateDescription}>
        {message}
      </Text>
    </View>
  );
}

// =====================================================
// 7. EmptyState
// =====================================================

export function EmptyState({
  title = "Nothing here yet",
  description = "There is no content to display.",
  actionLabel,
  onAction,
  style,
}) {
  return (
    <View
      style={[
        styles.stateContainer,
        style,
      ]}
    >
      <View style={styles.emptyIcon}>
        <AppIcon
          name="empty"
          size={32}
          color={colors.textMuted}
        />
      </View>

      <Text style={styles.stateTitle}>
        {title}
      </Text>

      <Text style={styles.stateDescription}>
        {description}
      </Text>

      {actionLabel && onAction && (
        <AppButton
          title={actionLabel}
          onPress={onAction}
          style={styles.stateAction}
        />
      )}
    </View>
  );
}

// =====================================================
// 8. ErrorState
// =====================================================

export function ErrorState({
  title = "Something went wrong",
  message = "Please try again.",
  onRetry,
  style,
}) {
  return (
    <View
      style={[
        styles.stateContainer,
        style,
      ]}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.errorIcon}>
        <AppIcon
          name="error"
          size={32}
          color={colors.error}
        />
      </View>

      <Text style={styles.stateTitle}>
        {title}
      </Text>

      <Text style={styles.stateDescription}>
        {message}
      </Text>

      {onRetry && (
        <AppButton
          title="Try Again"
          icon="retry"
          onPress={onRetry}
          style={styles.stateAction}
        />
      )}
    </View>
  );
}

// =====================================================
// Styles
// =====================================================

const styles = StyleSheet.create({
  // ---------------------------------------------------
  // Buttons
  // ---------------------------------------------------

  button: {
    minHeight: sizes.buttonHeight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },

  primaryButton: {
    backgroundColor: colors.primary,
  },

  secondaryButton: {
    backgroundColor: colors.primaryLight,
  },

  outlineButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },

  dangerButton: {
    backgroundColor: colors.error,
  },

  disabled: {
    opacity: 0.5,
  },

  pressed: {
    opacity: 0.85,
  },

  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },

  buttonText: {
    ...typography.button,
    color: colors.white,
    textAlign: "center",
  },

  secondaryButtonText: {
    color: colors.primary,
  },

  // ---------------------------------------------------
  // Input
  // ---------------------------------------------------

  inputContainer: {
    marginBottom: spacing.lg,
  },

  inputLabel: {
    ...typography.caption,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },

  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",

    minHeight: sizes.inputHeight,

    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,

    backgroundColor: colors.surface,
  },

  inputFocused: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },

  inputError: {
    borderColor: colors.error,
  },

  inputDisabled: {
    opacity: 0.6,
    backgroundColor: colors.surfaceSecondary,
  },

  input: {
    flex: 1,
    minWidth: 0,

    minHeight: sizes.inputHeight - 2,

    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,

    fontSize: 15,
    color: colors.text,
  },

  multilineInput: {
    minHeight: 100,
    textAlignVertical: "top",
    paddingTop: spacing.md,
  },

  inputIcon: {
    marginLeft: spacing.md,
  },

  inputAction: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.xs,
  },

  inputErrorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },

  inputErrorText: {
    ...typography.caption,
    color: colors.error,
    flex: 1,
  },

  // ---------------------------------------------------
  // Cards
  // ---------------------------------------------------

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },

  // ---------------------------------------------------
  // Pages
  // ---------------------------------------------------

  page: {
    flex: 1,
    backgroundColor: colors.background,
  },

  paddedPage: {
    paddingHorizontal: sizes.pagePadding,
  },

  // ---------------------------------------------------
  // Headings
  // ---------------------------------------------------

  headingContainer: {
    marginBottom: spacing.lg,
  },

  headingTitle: {
    ...typography.section,
    color: colors.text,
  },

  headingSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  // ---------------------------------------------------
  // Loading / Empty / Error
  // ---------------------------------------------------

  stateContainer: {
    flex: 1,
    minHeight: 180,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xxl,
  },

  stateTitle: {
    ...typography.section,
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.sm,
  },

  stateDescription: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
  },

  stateAction: {
    marginTop: spacing.xl,
    minWidth: 140,
  },

  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },

  errorIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.errorLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
});