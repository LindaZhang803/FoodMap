import React, {
  useState,
} from "react";

import RestaurantDetailScreen from "../../restaurants/screens/RestaurantDetailScreen";

import DishBrowserScreen from "../../reviews/screens/DishBrowserScreen";

import {
  getMyProfile,
} from "../../accounts/services/authApi";

import {
  API_ORIGIN,
} from "../../../config/api";

import FoodMapFeed from "./FoodMapFeed";

// =====================================================
// Profile Reader
// =====================================================

const readSelfProfile = ({ token }) =>
  getMyProfile(token);

// =====================================================
// Feed Route Screen
// =====================================================

export default function FeedRouteScreen({
  auth,
  onLoginRequired,
  onSessionExpired,

  // "home" or "wheel"
  navigationTab = "home",
}) {
  const [
    restaurantId,
    setRestaurantId,
  ] = useState(null);

  const [
    showDishes,
    setShowDishes,
  ] = useState(false);

  // =====================================================
  // 1. Open Restaurant
  // =====================================================

  function openRestaurant(id) {
    const targetId =
      typeof id === "string"
        ? id
        : id?._id;

    if (!targetId) {
      return;
    }

    setShowDishes(false);
    setRestaurantId(targetId);
  }

  // =====================================================
  // 2. Open Dish
  // =====================================================

  function openDish(
    dishId,
    parentRestaurantId
  ) {
    // The current DishBrowserScreen
    // opens reviews through restaurantId.
    const targetRestaurantId =
      typeof parentRestaurantId === "string"
        ? parentRestaurantId
        : parentRestaurantId?._id;

    if (!targetRestaurantId) {
      return;
    }

    setRestaurantId(
      targetRestaurantId
    );

    setShowDishes(true);
  }

  // =====================================================
  // 3. Back to Feed
  // =====================================================

  function backToFeed() {
    setShowDishes(false);
    setRestaurantId(null);
  }

  // =====================================================
  // 4. Open Dishes
  // =====================================================

  function openDishes() {
    if (!restaurantId) {
      return;
    }

    setShowDishes(true);
  }

  // =====================================================
  // 5. Back to Restaurant
  // =====================================================

  function backToRestaurant() {
    setShowDishes(false);
  }

  // =====================================================
  // 6. Detail Rendering
  // =====================================================

  function renderDetail(experience) {
    if (!restaurantId) {
      return null;
    }

    const renderRestaurantActions =
      experience?.renderRestaurantActions;

    if (showDishes) {
      return (
        <DishBrowserScreen
          key={`dishes-${restaurantId}`}
          restaurantId={restaurantId}
          token={auth?.token ?? null}
          apiOrigin={API_ORIGIN}
          demo={false}
          onBack={backToRestaurant}
          onLoginPress={
            onLoginRequired
          }
        />
      );
    }

    return (
      <RestaurantDetailScreen
        key={`restaurant-${restaurantId}`}
        restaurantId={restaurantId}
        onBack={backToFeed}
        onViewDishes={openDishes}
        renderRestaurantActions={
          renderRestaurantActions
        }
      />
    );
  }

  // =====================================================
  // 7. Feed Experience
  // =====================================================

  return (
    <FoodMapFeed
      auth={auth}
      readSelfProfile={
        readSelfProfile
      }
      onLoginRequired={
        onLoginRequired
      }
      onSessionExpired={
        onSessionExpired
      }
      onRestaurantPress={
        openRestaurant
      }
      onDishPress={
        openDish
      }
      renderDetail={
        renderDetail
      }
      navigationTab={
        navigationTab
      }
    />
  );
}