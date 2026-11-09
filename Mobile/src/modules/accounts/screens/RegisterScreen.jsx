import React, { useEffect, useRef, useState } from "react";
import {
    Text,
    TextInput,
    Pressable,
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    ScrollView,
    Platform,
    StyleSheet
} from "react-native";

import { registerUser } from "../services/authApi";

export default function RegisterScreen({
    onOpenLogin,
    onRegistered
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
        if (!isCurrent(id)) {
            return;
        }

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
        setSubmission({
            phase: "registered",
            email: savedEmail
        });

        const canNavigate =
            typeof onRegistered === "function" ||
            typeof onOpenLogin === "function";

        Alert.alert(
            "Success",
            "Account created successfully. You can now log in.",
            [{
                text: canNavigate ? "Log in" : "OK",
                onPress: () => completeRegistration(id, savedEmail)
            }],
            { cancelable: false }
        );
    }

    async function handleRegister() {
        if (!mounted.current || submission.phase !== "idle" || request.current) {
            return;
        }

        if (!username.trim() || !email.trim() || !password || !confirmPassword) {
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
                confirmPassword
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
                    error instanceof Error
                        ? error.message
                        : "Please try again."
                );
            }
        }
    }

    function openLogin() {
        if (!mounted.current || isSubmitting || !canReturnToLogin) {
            return;
        }

        if (isRegistered) {
            completeRegistration(request.current, submission.email);
            return;
        }

        if (request.current) {
            return;
        }

        Keyboard.dismiss();
        setPassword("");
        setConfirmPassword("");
        onOpenLogin();
    }

    return (
        <KeyboardAvoidingView
            style={styles.screen}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <ScrollView
                contentContainerStyle={styles.container}
                contentInsetAdjustmentBehavior="automatic"
                keyboardShouldPersistTaps="handled"
            >
                <Text style={styles.title}>Create Account</Text>

                <Text style={styles.subtitle}>
                    Welcome to FoodMap!
                </Text>

                <TextInput
                    accessibilityLabel="Username"
                    style={styles.input}
                    placeholder="Username"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={submission.phase === "idle"}
                />

                <TextInput
                    accessibilityLabel="Email"
                    style={styles.input}
                    placeholder="Email"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={submission.phase === "idle"}
                />

                <TextInput
                    accessibilityLabel="Password"
                    style={styles.input}
                    placeholder="Password"
                    value={password}
                    onChangeText={setPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry
                    editable={submission.phase === "idle"}
                />

                <TextInput
                    accessibilityLabel="Confirm Password"
                    style={styles.input}
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry
                    editable={submission.phase === "idle"}
                />

                <Pressable
                    style={[
                        styles.button,
                        submission.phase !== "idle" && styles.buttonDisabled
                    ]}
                    onPress={handleRegister}
                    disabled={submission.phase !== "idle"}
                    accessibilityRole="button"
                >
                    <Text style={styles.buttonText}>
                        {isSubmitting
                            ? "Creating..."
                            : isRegistered ? "Account created" : "Create Account"}
                    </Text>
                </Pressable>

                <Pressable
                    style={styles.link}
                    onPress={openLogin}
                    disabled={isSubmitting || !canReturnToLogin}
                    accessibilityRole="button"
                >
                    <Text style={[
                        styles.linkText,
                        (isSubmitting || !canReturnToLogin) && styles.linkDisabled
                    ]}>
                        Back to login
                    </Text>
                </Pressable>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: "#fff"
    },
    container: {
        flexGrow: 1,
        justifyContent: "center",
        padding: 25
    },
    title: {
        fontSize: 30,
        fontWeight: "bold",
        textAlign: "center",
        marginBottom: 10
    },
    subtitle: {
        fontSize: 16,
        textAlign: "center",
        color: "#666",
        marginBottom: 30
    },
    input: {
        height: 50,
        borderWidth: 1,
        borderColor: "#ccc",
        borderRadius: 10,
        paddingHorizontal: 15,
        marginBottom: 15,
        fontSize: 16,
        color: "#222"
    },
    button: {
        backgroundColor: "#1b5ad0ff",
        padding: 16,
        borderRadius: 10,
        alignItems: "center",
        marginTop: 10
    },
    buttonDisabled: {
        opacity: 0.6
    },
    buttonText: {
        color: "#fff",
        fontSize: 17,
        fontWeight: "bold"
    },
    link: {
        padding: 16,
        alignItems: "center",
        marginTop: 8
    },
    linkText: {
        color: "#1b5ad0ff",
        fontSize: 16,
        fontWeight: "600"
    },
    linkDisabled: {
        opacity: 0.5
    }
});