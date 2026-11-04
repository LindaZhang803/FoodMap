
import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    Pressable,
    Alert,
    StyleSheet
} from "react-native";

export default function RegisterScreen() {
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    function handleRegister() {
        if (!username.trim() || !email.trim() ||
            !password || !confirmPassword) {
            Alert.alert("Error", "Please fill in all fields");
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert("Error", "Passwords do not match");
            return;
        }

        Alert.alert("Success", "Form is ready for backend integration");
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Welcome to FoodMap!</Text>

            <TextInput
                style={styles.input}
                placeholder="Username"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
            />

            <TextInput
                style={styles.input}
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
            />

            <TextInput
                style={styles.input}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
            />

            <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
            />

            <Pressable style={styles.button} onPress={handleRegister}>
                <Text style={styles.buttonText}>Create Account</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        padding: 25,
        backgroundColor: "#fff"
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
        fontSize: 16
    },
    button: {
        backgroundColor: "#1b5ad0ff",
        padding: 16,
        borderRadius: 10,
        alignItems: "center",
        marginTop: 10
    },
    buttonText: {
        color: "#fff",
        fontSize: 17,
        fontWeight: "bold"
    }
});
