import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  View,
  Text,
  Pressable,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  StyleSheet,
} from "react-native";

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
// Login Screen
// =====================================================

export default function LoginScreen({
  onLogin,
  onOpenRegister,
  initialEmail = "",
  isSubmitting = false,
}) {
  // =====================================================
  // 1. State
  // =====================================================

  const [email, setEmail] = useState(initialEmail);

  const [password, setPassword] = useState("");

  const mounted = useRef(false);

  const loginRequest = useRef(null);

  const canOpenRegister =
    typeof onOpenRegister === "function" &&
    !isSubmitting;

  // =====================================================
  // 2. Lifecycle
  // =====================================================

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      loginRequest.current = null;
    };
  }, []);

  // =====================================================
  // 3. Login
  // =====================================================

  async function handleLogin() {
    if (
      !mounted.current ||
      isSubmitting ||
      loginRequest.current
    ) {
      return;
    }

    if (!email.trim() || !password) {
      Alert.alert(
        "Error",
        "Please fill in all fields"
      );

      return;
    }

    const id = Symbol("login-request");

    loginRequest.current = id;

    Keyboard.dismiss();

    try {
      await onLogin({
        email: email.trim().toLowerCase(),
        password,
      });
    } catch (error) {
      if (
        mounted.current &&
        loginRequest.current === id
      ) {
        Alert.alert(
          "Login failed",
          error instanceof Error
            ? error.message
            : "Please try again."
        );
      }
    } finally {
      if (loginRequest.current === id) {
        loginRequest.current = null;
      }
    }
  }

  // =====================================================
  // 4. Open registration
  // =====================================================

  function openRegister() {
    if (
      !mounted.current ||
      !canOpenRegister ||
      loginRequest.current
    ) {
      return;
    }

    Keyboard.dismiss();

    setPassword("");

    onOpenRegister();
  }

  // =====================================================
  // 5. Render
  // =====================================================

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={
        Platform.OS === "ios"
          ? "padding"
          : undefined
      }
    >
      <ScrollView
        contentContainerStyle={styles.container}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
      >
        {/* Brand */}
        <View style={styles.brandSection}>
          <View style={styles.logoContainer}>
            <AppIcon
              name="restaurant"
              size={36}
              color={colors.white}
            />
          </View>

          <Text style={styles.brandName}>
            FoodMap
          </Text>

          <Text style={styles.brandTagline}>
            Discover food worth sharing
          </Text>
        </View>

        {/* Welcome */}
        <View style={styles.header}>
          <Text style={styles.title}>
            Welcome Back!
          </Text>

          <Text style={styles.subtitle}>
            Sign in to continue your food journey.
          </Text>
        </View>

        {/* Login form */}
        <View style={styles.form}>
          {/* Email */}
          <AppInput
            label="Email"
            accessibilityLabel="Email"
            leftIcon="email"
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            editable={!isSubmitting}
          />

          {/* Password */}
          <AppInput
            label="Password"
            accessibilityLabel="Password"
            leftIcon="password"
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            showPasswordToggle
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            editable={!isSubmitting}
          />

          {/* Login button */}
          <AppButton
            title={
              isSubmitting
                ? "Logging in..."
                : "Log In"
            }
            icon="login"
            loading={isSubmitting}
            disabled={isSubmitting}
            onPress={handleLogin}
            style={styles.loginButton}
          />
        </View>

        {/* Register link */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Don't have an account?
          </Text>

          <Pressable
            onPress={openRegister}
            disabled={!canOpenRegister}
            accessibilityRole="button"
            accessibilityLabel="Sign up"
            style={({ pressed }) => [
              styles.registerButton,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.registerText,
                !canOpenRegister &&
                  styles.disabledText,
              ]}
            >
              Sign Up
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// =====================================================
// Styles
// =====================================================

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  container: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxxl,
  },

  // =====================================================
  // Brand
  // =====================================================

  brandSection: {
    alignItems: "center",
    marginBottom: spacing.xxxl,
  },

  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },

  brandName: {
    ...typography.title,
    color: colors.text,
  },

  brandTagline: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  // =====================================================
  // Header
  // =====================================================

  header: {
    marginBottom: spacing.xxl,
  },

  title: {
    ...typography.hero,
    color: colors.text,
    marginBottom: spacing.sm,
  },

  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },

  // =====================================================
  // Form
  // =====================================================

  form: {
    width: "100%",
  },

  loginButton: {
    marginTop: spacing.md,
    borderRadius: radius.md,
  },

  // =====================================================
  // Footer
  // =====================================================

  footer: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xxl,
    gap: spacing.xs,
  },

  footerText: {
    ...typography.body,
    color: colors.textSecondary,
  },

  registerButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },

  registerText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: "700",
  },

  pressed: {
    opacity: 0.7,
  },

  disabledText: {
    opacity: 0.5,
  },
});