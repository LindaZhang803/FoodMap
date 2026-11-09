import React, {
    useEffect,
    useRef,
    useState
} from "react";

import {
    View,
    Text,
    Pressable,
    ActivityIndicator,
    StyleSheet
} from "react-native";

import LoginScreen from "./src/modules/accounts/screens/LoginScreen";
import RegisterScreen from "./src/modules/accounts/screens/RegisterScreen";
import ProfileScreen from "./src/modules/accounts/screens/ProfileScreen";

function StatusScreen({
    message,
    loading = false,
    onRetry
}) {
    return (
        <View style={styles.container}>
            {loading && (
                <ActivityIndicator
                    size="large"
                    color="#1b5ad0ff"
                />
            )}

            <Text style={styles.message}>
                {message}
            </Text>

            {onRetry && (
                <Pressable
                    accessibilityRole="button"
                    style={styles.button}
                    onPress={onRetry}
                >
                    <Text style={styles.buttonText}>
                        Retry
                    </Text>
                </Pressable>
            )}
        </View>
    );
}

export default function AccountApp({
    session,
    onUserChange,
    onLoginSuccess
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
        retryCleanup
    } = session;

    const [authPage, setAuthPage] = useState("login");
    const [loginEmail, setLoginEmail] = useState("");

    const previousPhase = useRef(auth.phase);

    useEffect(() => {
        if (typeof onUserChange !== "function") {
            return;
        }

        const isSignedIn =
            auth.phase === "signedIn" ||
            auth.phase === "signingOut";

        onUserChange(isSignedIn ? auth.user : null);
    }, [auth.phase, auth.user, onUserChange]);

    useEffect(() => {
        const justLoggedIn =
            previousPhase.current === "signingIn" &&
            auth.phase === "signedIn";

        previousPhase.current = auth.phase;

        if (
            justLoggedIn &&
            typeof onLoginSuccess === "function"
        ) {
            onLoginSuccess();
        }
    }, [auth.phase, onLoginSuccess]);

    function openRegister() {
        if (auth.phase === "signedOut") {
            setAuthPage("register");
        }
    }

    function openLogin() {
        if (auth.phase === "signedOut") {
            setAuthPage("login");
        }
    }

    function handleRegistered(email) {
        if (auth.phase !== "signedOut") {
            return;
        }

        setLoginEmail(
            typeof email === "string"
                ? email.trim().toLowerCase()
                : ""
        );

        setAuthPage("login");
    }

    if (auth.phase === "restoring") {
        return (
            <StatusScreen
                loading
                message="Checking your sign-in..."
            />
        );
    }

    if (auth.phase === "clearing") {
        return (
            <StatusScreen
                loading
                message="Signing out..."
            />
        );
    }

    if (auth.phase === "restoreError") {
        return (
            <StatusScreen
                message={auth.message}
                onRetry={retryRestore}
            />
        );
    }

    if (auth.phase === "cleanupError") {
        return (
            <StatusScreen
                message={auth.message}
                onRetry={retryCleanup}
            />
        );
    }

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
                onChangeAvatar={updateAvatar}
                isSaving={isSaving}
                isUploading={isUploading}
                isLoggingOut={auth.phase === "signingOut"}
            />
        );
    }

    if (
        auth.phase === "signedOut" &&
        authPage === "register"
    ) {
        return (
            <RegisterScreen
                onOpenLogin={openLogin}
                onRegistered={handleRegistered}
            />
        );
    }

    return (
        <LoginScreen
            onLogin={login}
            onOpenRegister={openRegister}
            initialEmail={loginEmail}
            isSubmitting={auth.phase === "signingIn"}
        />
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 28,
        backgroundColor: "#fff"
    },
    message: {
        fontSize: 17,
        textAlign: "center",
        lineHeight: 25,
        marginTop: 20,
        marginBottom: 20
    },
    button: {
        backgroundColor: "#1b5ad0ff",
        paddingVertical: 14,
        paddingHorizontal: 30,
        borderRadius: 10
    },
    buttonText: {
        color: "#fff",
        fontSize: 17,
        fontWeight: "bold"
    }
});