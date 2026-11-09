import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  SafeAreaInsetsContext,
  SafeAreaProvider,
  SafeAreaView,
} from "react-native-safe-area-context";

import {
  HomeFeedView,
} from "./HomeFeedScreen";

import {
  FeedRepository,
} from "../services/FeedRepository";

import {
  UserPreferenceRepository,
} from "../services/UserPreferenceRepository";

import {
  createLiveAccountSource,
  createLiveCatalogSources,
  resolveCatalogImageUrl,
} from "../services/liveSources";

import usePersonalizedFeed from "../hooks/usePersonalizedFeed";

import {
  SavedPlaceActions,
  SavedPlacesScreen,
  useLiveSavedPlaces,
} from "../favorites";

import DecisionWheel from "../wheel/DecisionWheel";

import {
  colors,
  spacing,
  radius,
  typography,
} from "../../../shared/design/tokens";

// =====================================================
// Context
// =====================================================

const ExperienceContext =
  createContext(null);

// Original tabs retained for compatibility.
const LEGACY_TABS = [
  "Discover",
  "Want to Try",
  "Wheel",
];

// Bottom Navigation Home sub-tabs.
const HOME_TABS = [
  "Discover",
  "Want to Try",
];

// =====================================================
// Shared Feed Experience
// =====================================================

export function useFeedExperience() {
  const experience = useContext(
    ExperienceContext
  );

  if (!experience) {
    throw new Error(
      "useFeedExperience must be used inside FeedExperience."
    );
  }

  return experience;
}

// =====================================================
// Provider
// =====================================================

export default function FeedExperience(
  props
) {
  const insets = useContext(
    SafeAreaInsetsContext
  );

  return insets == null ? (
    <SafeAreaProvider>
      <Experience {...props} />
    </SafeAreaProvider>
  ) : (
    <Experience {...props} />
  );
}

// =====================================================
// Experience
// =====================================================

function Experience({
  getRestaurants,
  getDishes,
  origin,

  dishReadComplete = true,

  session,
  readSelfProfile,

  onLoginRequired,
  onSessionExpired,

  onRestaurantPress,
  onDishPress,

  fetchImpl,
  favoritesClient,

  RestaurantCardComponent,

  resolveImageUrl,
  filterRestaurants,

  userLocation,
  onRequestLocation,

  policy,
  renderDetail,

  // New Bottom Navigation integration.
  // Values: "home", "wheel", or undefined.
  navigationTab,
}) {
  // =====================================================
  // 1. Navigation
  // =====================================================

  const [tab, setTab] =
    useState("Discover");

  const externallyControlled =
    navigationTab === "home" ||
    navigationTab === "wheel";

  // Wheel is opened directly from the bottom bar.
  const activeTab =
    navigationTab === "wheel"
      ? "Wheel"
      : externallyControlled
        ? tab === "Want to Try"
          ? "Want to Try"
          : "Discover"
        : tab;

  const visibleTabs =
    externallyControlled
      ? HOME_TABS
      : LEGACY_TABS;

  // =====================================================
  // 2. Session
  // =====================================================

  const userId =
    session?.userId ?? null;

  const token =
    session?.token ?? null;

  const preferenceRevision =
    session?.preferenceRevision ?? 0;

  const current = useRef(null);

  const expired = useRef(
    onSessionExpired
  );

  expired.current =
    onSessionExpired;

  const accountIdentity = useMemo(
    () => ({
      active: false,
    }),
    [
      userId,
      token,
      origin,
      readSelfProfile,
    ]
  );

  current.current =
    accountIdentity;

  // =====================================================
  // 3. Feed Repository
  // =====================================================

  const feedRepository = useMemo(
    () =>
      new FeedRepository(
        createLiveCatalogSources({
          getRestaurants,
          getDishes,
          origin,
          dishReadComplete,
        })
      ),
    [
      getRestaurants,
      getDishes,
      origin,
      dishReadComplete,
    ]
  );

  // =====================================================
  // 4. Account Source
  // =====================================================

  const accountSource = useMemo(
    () =>
      createLiveAccountSource({
        readSelfProfile,
        userId,
        token,
        origin,

        isCurrentSession: () =>
          current.current ===
            accountIdentity &&
          accountIdentity.active,

        onSessionExpired: () =>
          expired.current?.(),
      }),
    [
      readSelfProfile,
      userId,
      token,
      origin,
      accountIdentity,
    ]
  );

  useEffect(() => {
    accountIdentity.active = true;

    return () => {
      accountIdentity.active = false;
      accountSource.cancelPending();
    };
  }, [
    accountSource,
    accountIdentity,
  ]);

  // =====================================================
  // 5. Preferences
  // =====================================================

  const preferenceRepository = useMemo(
    () =>
      new UserPreferenceRepository({
        accountSource,
      }),
    [accountSource]
  );

  // =====================================================
  // 6. Personalized Feed
  // =====================================================

  const feed = usePersonalizedFeed({
    feedRepository,
    preferenceRepository,
    userId,
    preferenceRevision,
    policy,
  });

  // =====================================================
  // 7. Favorites
  // =====================================================

  const savedPlaces = useLiveSavedPlaces({
    session,
    origin,
    fetchImpl,
    client: favoritesClient,
    onLoginRequired,
    onSessionExpired,
  });

  // =====================================================
  // 8. Restaurants
  // =====================================================

  const restaurants = useMemo(
    () =>
      feed.candidates.map(
        (candidate) =>
          candidate.restaurant
      ),
    [feed.candidates]
  );

  // =====================================================
  // 9. Dishes
  // =====================================================

  const dishes = useMemo(
    () =>
      feed.candidates.flatMap(
        (candidate) =>
          candidate.dishes
      ),
    [feed.candidates]
  );

  // =====================================================
  // 10. Images
  // =====================================================

  const imageResolver = useCallback(
    (value) =>
      resolveImageUrl
        ? resolveImageUrl(value)
        : resolveCatalogImageUrl(
            value,
            origin
          ),
    [
      resolveImageUrl,
      origin,
    ]
  );

  // =====================================================
  // 11. Restaurant Favorite Actions
  // =====================================================

  const renderRestaurantActions =
    useCallback(
      (restaurant) => (
        <SavedPlaceActions
          restaurant={restaurant}
          savedPlaces={savedPlaces}
        />
      ),
      [savedPlaces]
    );

  // =====================================================
  // 12. Dish Favorite Actions
  // =====================================================

  const renderDishActions =
    useCallback(
      (dish) => (
        <SavedPlaceActions
          dish={dish}
          savedPlaces={savedPlaces}
        />
      ),
      [savedPlaces]
    );

  // =====================================================
  // 13. Shared Context
  // =====================================================

  const experience = {
    feed,
    savedPlaces,
    renderRestaurantActions,
    renderDishActions,
  };

  // =====================================================
  // 14. Detail Screen
  // =====================================================

  const detail =
    renderDetail?.(experience);

  // =====================================================
  // 15. Home Sub-tabs
  // =====================================================

  function renderTab(name) {
    const selected =
      activeTab === name;

    return (
      <Pressable
        key={name}
        accessibilityRole="tab"
        accessibilityLabel={name}
        accessibilityState={{
          selected,
        }}
        onPress={() =>
          setTab(name)
        }
        style={({ pressed }) => [
          styles.tab,

          selected &&
            styles.selected,

          pressed &&
            styles.pressed,
        ]}
      >
        <Text
          style={[
            styles.tabText,

            selected &&
              styles.selectedText,
          ]}
        >
          {name}
        </Text>
      </Pressable>
    );
  }

  // =====================================================
  // 16. Render
  // =====================================================

  return (
    <ExperienceContext.Provider
      value={experience}
    >
      <SafeAreaView
        edges={[]}
        style={styles.screen}
      >
        {/* ============================================
            Home Sub-tabs

            Not displayed in independent Wheel mode.
        ============================================ */}

        {!detail &&
          navigationTab !== "wheel" && (
            <View style={styles.tabs}>
              {visibleTabs.map(
                renderTab
              )}
            </View>
          )}

        {/* ============================================
            Discover
        ============================================ */}

        <View
          style={
            activeTab === "Discover" &&
            !detail
              ? styles.page
              : styles.hidden
          }
          accessibilityElementsHidden={
            activeTab !== "Discover" ||
            Boolean(detail)
          }
          importantForAccessibility={
            activeTab === "Discover" &&
            !detail
              ? "auto"
              : "no-hide-descendants"
          }
        >
          <HomeFeedView
            feed={feed}
            safeAreaEdges={[]}
            showRefreshButton={
              Platform.OS === "web"
            }
            RestaurantCardComponent={
              RestaurantCardComponent
            }
            onRestaurantPress={
              onRestaurantPress
            }
            renderRestaurantActions={
              renderRestaurantActions
            }
          />
        </View>

        {/* ============================================
            Want to Try
        ============================================ */}

        <View
          style={
            activeTab === "Want to Try" &&
            !detail
              ? styles.page
              : styles.hidden
          }
          accessibilityElementsHidden={
            activeTab !== "Want to Try" ||
            Boolean(detail)
          }
          importantForAccessibility={
            activeTab === "Want to Try" &&
            !detail
              ? "auto"
              : "no-hide-descendants"
          }
        >
          <SavedPlacesScreen
            savedPlaces={savedPlaces}
            safeAreaEdges={[]}
            showRefreshButton={
              Platform.OS === "web"
            }
            onRestaurantPress={
              onRestaurantPress
            }
            onDishPress={
              onDishPress
            }
          />
        </View>

        {/* ============================================
            Independent Decision Wheel
        ============================================ */}

        <View
          style={
            activeTab === "Wheel" &&
            !detail
              ? styles.page
              : styles.hidden
          }
          accessibilityElementsHidden={
            activeTab !== "Wheel" ||
            Boolean(detail)
          }
          importantForAccessibility={
            activeTab === "Wheel" &&
            !detail
              ? "auto"
              : "no-hide-descendants"
          }
        >
          <DecisionWheel
            restaurants={restaurants}
            dishes={dishes}
            savedPlaces={
              savedPlaces.favorites
            }
            savedDishes={
              savedPlaces.favoriteDishes
            }
            privateSessionKey={
              savedPlaces.sessionScope
            }
            onRestaurantPress={
              onRestaurantPress
            }
            onDishPress={
              onDishPress
            }
            resolveImageUrl={
              imageResolver
            }
            filterRestaurants={
              filterRestaurants
            }
            userLocation={
              userLocation
            }
            onRequestLocation={
              onRequestLocation
            }
          />
        </View>

        {/* ============================================
            Restaurant / Dish Details
        ============================================ */}

        {detail}
      </SafeAreaView>
    </ExperienceContext.Provider>
  );
}

// =====================================================
// Styles
// =====================================================

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  page: {
    flex: 1,
    minHeight: 0,
  },

  hidden: {
    display: "none",
  },

  // =====================================================
  // Home Sub-tabs
  // =====================================================

  tabs: {
    flexDirection: "row",
    flexWrap: "wrap",

    gap: spacing.sm,

    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,

    backgroundColor: colors.surface,

    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  tab: {
    minHeight: 44,

    justifyContent: "center",

    paddingHorizontal: spacing.lg,

    borderRadius: radius.pill,

    borderWidth: 1,
    borderColor: colors.border,

    backgroundColor: colors.surface,
  },

  selected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  pressed: {
    opacity: 0.8,
  },

  tabText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "700",
  },

  selectedText: {
    color: colors.white,
  },
});