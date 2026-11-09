import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  View,
  Text,
  StyleSheet,
} from "react-native";

import LoginScreen from "./src/modules/accounts/screens/LoginScreen";

import RegisterScreen from "./src/modules/accounts/screens/RegisterScreen";

import ProfileScreen from "./src/modules/accounts/screens/ProfileScreen";

import {
  colors,
  spacing,
  typography,
} from "./src/shared/design/tokens";

import {
  AppButton,
  LoadingState,
  ErrorState,
} from "./src/shared/design/UIComponents";

// =====================================================
// Account Status
// =====================================================

function StatusScreen({
  message,
  loading = false,
  onRetry,
}) {
  if (loading) {
    return (
      <View style={styles.container}>
        <LoadingState
          message={message}
        />
      </View>
    );
  }

  if (onRetry) {
    return (
      <View style={styles.container}>
        <ErrorState
          title="Account unavailable"
          message={message}
          onRetry={onRetry}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.message}>
        {message}
      </Text>
    </View>
  );
}

// =====================================================
// Account App
// =====================================================

export default function AccountApp({
  session,
  onUserChange,
  onLoginSuccess,
}) {
  const {
    auth,
    login,
    logout,
    updateProfile,
    updateAvatar,
    isSaving,
    isUploading,
    retryRestore,
    retryCleanup,
  } = session;

  const [authPage, setAuthPage] =
    useState("login");

  const [loginEmail, setLoginEmail] =
    useState("");

  const previousPhase = useRef(
    auth.phase
  );

  // =====================================================
  // 1. User Changes
  // =====================================================

  useEffect(() => {
    if (
      typeof onUserChange !== "function"
    ) {
      return;
    }

    const isSignedIn =
      auth.phase === "signedIn" ||
      auth.phase === "signingOut";

    onUserChange(
      isSignedIn ? auth.user : null
    );
  }, [
    auth.phase,
    auth.user,
    onUserChange,
  ]);

  // =====================================================
  // 2. Login Success
  // =====================================================

  useEffect(() => {
    const justLoggedIn =
      previousPhase.current ===
        "signingIn" &&
      auth.phase === "signedIn";

    previousPhase.current =
      auth.phase;

    if (
      justLoggedIn &&
      typeof onLoginSuccess === "function"
    ) {
      onLoginSuccess();
    }
  }, [
    auth.phase,
    onLoginSuccess,
  ]);

  // =====================================================
  // 3. Navigation
  // =====================================================

  function openRegister() {
    if (
      auth.phase === "signedOut"
    ) {
      setAuthPage("register");
    }
  }

  function openLogin() {
    if (
      auth.phase === "signedOut"
    ) {
      setAuthPage("login");
    }
  }

  function handleRegistered(email) {
    if (
      auth.phase !== "signedOut"
    ) {
      return;
    }

    setLoginEmail(
      typeof email === "string"
        ? email.trim().toLowerCase()
        : ""
    );

    setAuthPage("login");
  }

  // =====================================================
  // 4. Restore Session
  // =====================================================

  if (
    auth.phase === "restoring"
  ) {
    return (
      <StatusScreen
        loading
        message="Checking your sign-in..."
      />
    );
  }

  // =====================================================
  // 5. Signing Out
  // =====================================================

  if (
    auth.phase === "clearing"
  ) {
    return (
      <StatusScreen
        loading
        message="Signing out..."
      />
    );
  }

  // =====================================================
  // 6. Restore Error
  // =====================================================

  if (
    auth.phase === "restoreError"
  ) {
    return (
      <StatusScreen
        message={auth.message}
        onRetry={retryRestore}
      />
    );
  }

  // =====================================================
  // 7. Cleanup Error
  // =====================================================

  if (
    auth.phase === "cleanupError"
  ) {
    return (
      <StatusScreen
        message={auth.message}
        onRetry={retryCleanup}
      />
    );
  }

  // =====================================================
  // 8. Signed In
  // =====================================================

  if (
    auth.phase === "signedIn" ||
    auth.phase === "signingOut"
  ) {
    return (
      <ProfileScreen
        key={auth.user.id}
        user={auth.user}
        token={auth.token}
        onLogout={logout}
        onSave={updateProfile}
        onChangeAvatar={
          updateAvatar
        }
        isSaving={isSaving}
        isUploading={isUploading}
        isLoggingOut={
          auth.phase === "signingOut"
        }
      />
    );
  }

  // =====================================================
  // 9. Registration
  // =====================================================

  if (
    auth.phase === "signedOut" &&
    authPage === "register"
  ) {
    return (
      <RegisterScreen
        onOpenLogin={openLogin}
        onRegistered={
          handleRegistered
        }
      />
    );
  }

  // =====================================================
  // 10. Login
  // =====================================================

  return (
    <LoginScreen
      onLogin={login}
      onOpenRegister={
        openRegister
      }
      initialEmail={loginEmail}
      isSubmitting={
        auth.phase === "signingIn"
      }
    />
  );
}

// =====================================================
// Styles
// =====================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xxl,
    backgroundColor: colors.background,
  },

  message: {
    ...typography.body,
    textAlign: "center",
    color: colors.textSecondary,
  },
});