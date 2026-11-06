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

export default function LoginScreen({
    onLogin,
    onOpenRegister,
    initialEmail = "",
    isSubmitting = false
}) {
    const [email, setEmail] = useState(initialEmail);
    const [password, setPassword] = useState("");

    const mounted = useRef(false);
    const loginRequest = useRef(null);

    const canOpenRegister =
        typeof onOpenRegister === "function" && !isSubmitting;

    useEffect(() => {
        mounted.current = true;

        return () => {
            mounted.current = false;
            loginRequest.current = null;
        };
    }, []);

    async function handleLogin() {
        if (!mounted.current || isSubmitting || loginRequest.current) {
            return;
        }

        if (!email.trim() || !password) {
            Alert.alert("Error", "Please fill in all fields");
            return;
        }

        const id = Symbol("login-request");
        loginRequest.current = id;
        Keyboard.dismiss();

        try {
            await onLogin({
                email: email.trim().toLowerCase(),
                password
            });
        } catch (error) {
            if (mounted.current && loginRequest.current === id) {
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

    function openRegister() {
        if (!mounted.current || !canOpenRegister || loginRequest.current) {
            return;
        }

        Keyboard.dismiss();
        setPassword("");
        onOpenRegister();
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
                <Text style={styles.title}>Welcome Back!</Text>

                <Text style={styles.subtitle}>
                    Log in to FoodMap
                </Text>

                <TextInput
                    accessibilityLabel="Email"
                    style={styles.input}
                    placeholder="Email"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isSubmitting}
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
                    editable={!isSubmitting}
                />

                <Pressable
                    style={[
                        styles.button,
                        isSubmitting && styles.buttonDisabled
                    ]}
                    onPress={handleLogin}
                    disabled={isSubmitting}
                    accessibilityRole="button"
                >
                    <Text style={styles.buttonText}>
                        {isSubmitting ? "Logging in..." : "Login"}
                    </Text>
                </Pressable>

                <Pressable
                    style={styles.link}
                    onPress={openRegister}
                    disabled={!canOpenRegister}
                    accessibilityRole="button"
                >
                    <Text style={[
                        styles.linkText,
                        !canOpenRegister && styles.linkDisabled
                    ]}>
                        Create an account
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