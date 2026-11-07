import React, { useState } from "react";

import {
    View,
    Text,
    Pressable,
    SafeAreaView,
    StyleSheet
} from "react-native";

import RestaurantBrowser from "./RestaurantBrowser";
import AccountApp from "./AccountApp";

export default function App() {
    const [page, setPage] = useState("restaurants");

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.navigation}>
                <View style={styles.tabs}>
                    <Pressable
                        accessibilityRole="tab"
                        accessibilityState={{
                            selected: page === "restaurants"
                        }}
                        onPress={() => setPage("restaurants")}
                        style={[
                            styles.tab,
                            page === "restaurants" && styles.activeTab
                        ]}
                    >
                        <Text style={styles.tabText}>
                            Restaurants
                        </Text>
                    </Pressable>

                    <Pressable
                        accessibilityRole="tab"
                        accessibilityState={{
                            selected: page === "account"
                        }}
                        onPress={() => setPage("account")}
                        style={[
                            styles.tab,
                            page === "account" && styles.activeTab
                        ]}
                    >
                        <Text style={styles.tabText}>
                            My account
                        </Text>
                    </Pressable>
                </View>
            </SafeAreaView>

            <View
                style={[
                    styles.content,
                    page !== "restaurants" && styles.hidden
                ]}
            >
                <RestaurantBrowser />
            </View>

            <View
                style={[
                    styles.content,
                    page !== "account" && styles.hidden
                ]}
            >
                <AccountApp />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff"
    },
    navigation: {
        backgroundColor: "#fff"
    },
    tabs: {
        flexDirection: "row",
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: "#e5e7eb"
    },
    tab: {
        flex: 1,
        alignItems: "center",
        paddingVertical: 12,
        borderRadius: 8
    },
    activeTab: {
        backgroundColor: "#eaf0ff"
    },
    tabText: {
        color: "#1b5ad0",
        fontSize: 16,
        fontWeight: "600"
    },
    content: {
        flex: 1
    },
    hidden: {
        display: "none"
    }
});