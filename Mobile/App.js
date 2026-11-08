import React, { useState } from "react";

import {
    View,
    Text,
    Image,
    Pressable,
    SafeAreaView,
    StyleSheet
} from "react-native";

import RestaurantBrowser from "./RestaurantBrowser";
import AccountApp from "./AccountApp";

export default function App() {
    const [page, setPage] = useState("home");
    const [user, setUser] = useState(null);
    const [failedImage, setFailedImage] = useState("");

    const avatarUri =
        typeof user?.profileImage === "string"
            ? user.profileImage
            : "";

    const showImage =
        !!avatarUri && failedImage !== avatarUri;

    const initial =
        user?.username?.trim()?.charAt(0)?.toUpperCase() || "";

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.header}>
                <View style={styles.headerContent}>
                    {page === "account" ? (
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Back to home"
                            hitSlop={8}
                            style={styles.backButton}
                            onPress={() => setPage("home")}
                        >
                            <Text style={styles.backText}>
                                ‹
                            </Text>
                        </Pressable>
                    ) : (
                        <View style={styles.spacer} />
                    )}

                    {page === "home" && (
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={
                                user
                                    ? "Open my profile"
                                    : "Log in or create an account"
                            }
                            hitSlop={6}
                            style={styles.avatarButton}
                            onPress={() => setPage("account")}
                        >
                            {showImage ? (
                                <Image
                                    key={avatarUri}
                                    source={{ uri: avatarUri }}
                                    style={styles.avatarImage}
                                    onError={() => {
                                        setFailedImage(avatarUri);
                                    }}
                                />
                            ) : initial ? (
                                <Text style={styles.initial}>
                                    {initial}
                                </Text>
                            ) : (
                                <View
                                    style={styles.person}
                                    accessible={false}
                                >
                                    <View style={styles.personHead} />
                                    <View style={styles.personBody} />
                                </View>
                            )}
                        </Pressable>
                    )}
                </View>
            </SafeAreaView>

            <View
                style={[
                    styles.content,
                    page !== "home" && styles.hidden
                ]}
                accessibilityElementsHidden={page !== "home"}
                importantForAccessibility={
                    page === "home"
                        ? "auto"
                        : "no-hide-descendants"
                }
            >
                <RestaurantBrowser />
            </View>

            <View
                style={[
                    styles.content,
                    page !== "account" && styles.hidden
                ]}
                accessibilityElementsHidden={page !== "account"}
                importantForAccessibility={
                    page === "account"
                        ? "auto"
                        : "no-hide-descendants"
                }
            >
                <AccountApp
                    onUserChange={setUser}
                    onLoginSuccess={() => setPage("home")}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff"
    },
    header: {
        backgroundColor: "#fff"
    },
    headerContent: {
        height: 52,
        paddingHorizontal: 18,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between"
    },
    spacer: {
        width: 44,
        height: 44
    },
    backButton: {
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center"
    },
    backText: {
        color: "#1b5ad0",
        fontSize: 42,
        lineHeight: 46
    },
    avatarButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: "#eaf0ff",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "#dbe5ff"
    },
    avatarImage: {
        width: "100%",
        height: "100%",
        resizeMode: "cover"
    },
    initial: {
        fontSize: 21,
        fontWeight: "700",
        color: "#1b5ad0"
    },
    person: {
        alignItems: "center",
        justifyContent: "center"
    },
    personHead: {
        width: 11,
        height: 11,
        borderRadius: 6,
        backgroundColor: "#1b5ad0",
        marginBottom: 3
    },
    personBody: {
        width: 23,
        height: 13,
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        borderBottomLeftRadius: 4,
        borderBottomRightRadius: 4,
        backgroundColor: "#1b5ad0"
    },
    content: {
        flex: 1
    },
    hidden: {
        display: "none"
    }
});