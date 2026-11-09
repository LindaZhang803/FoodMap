import React, { useEffect, useRef, useState } from "react";

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

import { registerUser } from "../services/authApi";

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

export default function RegisterScreen({
  onOpenLogin,
  onRegistered,
}) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submission, setSubmission] = useState({ phase: "idle" });

  const mounted = useRef(false);
  const request = useRef(null);

  const isSubmitting = submission.phase === "submitting";
  const isRegistered = submission.phase === "registered";

  const canReturnToLogin =
    typeof onOpenLogin === "function" ||
    (isRegistered && typeof onRegistered === "function");

  useEffect(() => {
    mounted.current = true;
    setSubmission({ phase: "idle" });

    return () => {
      mounted.current = false;
      request.current = null;
    };
  }, []);

  function isCurrent(id) {
    return Boolean(id) && mounted.current && request.current === id;
  }

  function completeRegistration(id, savedEmail) {
    if (!isCurrent(id)) return;

    if (typeof onRegistered === "function") {
      request.current = null;
      onRegistered(savedEmail);
    } else if (typeof onOpenLogin === "function") {
      request.current = null;
      onOpenLogin();
    }
  }

  function showRegistered(id, savedEmail) {
    setPassword("");
    setConfirmPassword("");
    setSubmission({ phase: "registered", email: savedEmail });

    const canNavigate =
      typeof onRegistered === "function" ||
      typeof onOpenLogin === "function";

    Alert.alert(
      "Success",
      "Account created successfully. You can now log in.",
      [
        {
          text: canNavigate ? "Log in" : "OK",
          onPress: () => completeRegistration(id, savedEmail),
        },
      ],
      { cancelable: false }
    );
  }

  async function handleRegister() {
    if (
      !mounted.current ||
      submission.phase !== "idle" ||
      request.current
    ) {
      return;
    }

    if (
      !username.trim() ||
      !email.trim() ||
      !password ||
      !confirmPassword
    ) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    const id = Symbol("register-request");
    request.current = id;
    setSubmission({ phase: "submitting" });
    Keyboard.dismiss();

    try {
      const result = await registerUser({
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password,
        confirmPassword,
      });

      if (isCurrent(id)) {
        showRegistered(id, result.user.email);
      }
    } catch (error) {
      if (isCurrent(id)) {
        request.current = null;
        setSubmission({ phase: "idle" });

        Alert.alert(
          "Registration failed",
          error instanceof Error ? error.message : "Please try again."
        );
      }
    }
  }

  function openLogin() {
    if (
      !mounted.current ||
      isSubmitting ||
      !canReturnToLogin
    ) {
      return;
    }

    if (isRegistered) {
      completeRegistration(request.current, submission.email);
      return;
    }

    if (request.current) return;

    Keyboard.dismiss();
    setPassword("");
    setConfirmPassword("");
    onOpenLogin();
  }

  const editable = submission.phase === "idle";

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <AppIcon
              name="restaurant"
              size={36}
              color={colors.white}
            />
          </View>

          <Text style={styles.title}>Join FoodMap</Text>

          <Text style={styles.subtitle}>
            Create an account to share your favorite food experiences.
          </Text>
        </View>

        <View style={styles.form}>
          <AppInput
            label="Username"
            leftIcon="user"
            accessibilityLabel="Username"
            placeholder="Choose a username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            editable={editable}
          />

          <AppInput
            label="Email"
            leftIcon="email"
            accessibilityLabel="Email"
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            editable={editable}
          />

          <AppInput
            label="Password"
            leftIcon="password"
            accessibilityLabel="Password"
            placeholder="Create a password"
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            showPasswordToggle
            autoComplete="new-password"
            editable={editable}
          />

          <AppInput
            label="Confirm Password"
            leftIcon="password"
            accessibilityLabel="Confirm Password"
            placeholder="Confirm your password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            showPasswordToggle
            editable={editable}
            onSubmitEditing={handleRegister}
          />

          <AppButton
            title={
              isSubmitting
                ? "Creating..."
                : isRegistered
                  ? "Account Created"
                  : "Create Account"
            }
            icon="userFilled"
            loading={isSubmitting}
            disabled={!editable}
            onPress={handleRegister}
            style={styles.registerButton}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Already have an account?
          </Text>

          <Pressable
            style={styles.loginLink}
            onPress={openLogin}
            disabled={isSubmitting || !canReturnToLogin}
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.loginText,
                (isSubmitting || !canReturnToLogin) &&
                  styles.disabledText,
              ]}
            >
              Log In
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

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
  header: {
    alignItems: "center",
    marginBottom: spacing.xxxl,
  },
  logoContainer: {
    width: 68,
    height: 68,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.title,
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    maxWidth: 300,
  },
  form: {
    width: "100%",
  },
  registerButton: {
    marginTop: spacing.md,
  },
  footer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    marginTop: spacing.xxl,
    gap: spacing.xs,
  },
  footerText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  loginLink: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  loginText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: "700",
  },
  disabledText: {
    opacity: 0.5,
  },
});