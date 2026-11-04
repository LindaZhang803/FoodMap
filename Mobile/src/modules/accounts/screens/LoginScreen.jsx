
import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    Pressable,
    Alert,
    StyleSheet
} from "react-native";

export default function LoginScreen() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    function handleLogin() {
        if (!email.trim() || !password) {
            Alert.alert("Error", "Please fill in all fields");
            return;
        }

        Alert.alert("Success", "Login UI is ready!");
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Welcome Back!</Text>
            <Text style={styles.subtitle}>Log in to FoodMap</Text>

            <TextInput
                style={styles.input}
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
            />

            <TextInput
                style={styles.input}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
            />

            <Pressable
                style={styles.button}
                onPress={handleLogin}
            >
                <Text style={styles.buttonText}>Login</Text>
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
