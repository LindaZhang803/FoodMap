import React, {
  useMemo,
} from "react";

import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  API_ORIGIN,
} from "../../../config/api";

import {
  getRestaurants,
} from "../../restaurants/services/restaurantApi";

import {
  filterRestaurants,
} from "../../restaurants/utils/restaurantFilters";

import {
  createDishRepository,
} from "../../reviews/services/dishRepository";

import {
  toFeedSession,
} from "../services/accountSession";

import FeedExperience from "./FeedExperience";

// =====================================================
// FoodMap Feed
// =====================================================

/**
 * Uses the existing Accounts authentication state.
 *
 * No duplicate authentication session is created.
 *
 * Supports:
 * - Discover
 * - Want to Try
 * - Decision Wheel
 */

export default function FoodMapFeed({
  auth,

  preferenceRevision = 0,

  onLoginRequired,

  onSessionExpired,

  navigationTab,

  ...props
}) {
  // =====================================================
  // 1. Dish Repository
  // =====================================================

  const getDishes = useMemo(() => {
    const repository =
      createDishRepository({
        origin: API_ORIGIN,
      });

    return repository.getDishes.bind(
      repository
    );
  }, []);

  // =====================================================
  // 2. Shared Accounts Session
  // =====================================================

  const session = useMemo(() => {
    const current =
      toFeedSession(auth);

    if (!current) {
      return null;
    }

    return {
      ...current,
      preferenceRevision,
    };
  }, [
    auth?.phase,
    auth?.user?.id,
    auth?.token,
    preferenceRevision,
  ]);

  // =====================================================
  // 3. Signed-Out State
  // =====================================================

  if (!session) {
    return (
      <View style={styles.signIn}>
        <Text style={styles.message}>
          Sign in to use FoodMap.
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign in to use FoodMap"
          disabled={
            typeof onLoginRequired !==
            "function"
          }
          accessibilityState={{
            disabled:
              typeof onLoginRequired !==
              "function",
          }}
          onPress={
            onLoginRequired
          }
          style={styles.button}
        >
          <Text style={styles.buttonText}>
            Sign In
          </Text>
        </Pressable>
      </View>
    );
  }

  // =====================================================
  // 4. Feed Experience
  // =====================================================

  return (
    <FeedExperience
      {...props}

      // Shared session.
      session={session}

      // Backend.
      origin={API_ORIGIN}

      // Catalog.
      getRestaurants={
        getRestaurants
      }

      getDishes={
        getDishes
      }

      // Existing filtering.
      filterRestaurants={
        filterRestaurants
      }

      // Authentication callbacks.
      onLoginRequired={
        onLoginRequired
      }

      onSessionExpired={
        onSessionExpired
      }

      // IMPORTANT:
      // "wheel" opens DecisionWheel directly.
      // It does not open Want to Try.
      navigationTab={
        navigationTab
      }
    />
  );
}

// =====================================================
// Styles
// =====================================================

const styles = StyleSheet.create({
  signIn: {
    flex: 1,

    alignItems: "center",
    justifyContent: "center",

    padding: 24,
    gap: 16,

    backgroundColor: "#f5f5f5",
  },

  message: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },

  button: {
    minHeight: 44,

    justifyContent: "center",

    paddingHorizontal: 16,

    borderRadius: 10,

    backgroundColor: "#2563eb",
  },

  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
