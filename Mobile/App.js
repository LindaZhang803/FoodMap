import React, {
  useCallback,
  useRef,
  useState,
} from "react";

import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  StatusBar,
} from "react-native";

import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import RestaurantBrowser from "./RestaurantBrowser";

import AccountApp from "./AccountApp";

import useAuthSession from "./src/modules/accounts/hooks/useAuthSession";

import FeedRouteScreen from "./src/modules/feed/screens/FeedRouteScreen";

import PostFeedScreen from "./src/modules/posts/screens/PostFeedScreen";

import PostDetailScreen from "./src/modules/posts/screens/PostDetailScreen";

import CreatePostScreen from "./src/modules/posts/screens/CreatePostScreen";

import RestaurantDetailScreen from "./src/modules/restaurants/screens/RestaurantDetailScreen";

import DishBrowserScreen from "./src/modules/reviews/screens/DishBrowserScreen";

import AppIcon from "./src/shared/components/AppIcon";

import {
  colors,
  spacing,
  radius,
  typography,
} from "./src/shared/design/tokens";

// =====================================================
// Bottom Navigation
// =====================================================

const NAV_ITEMS = [
  {
    id: "home",
    label: "Home",
    icon: "home",
    activeIcon: "homeFilled",
  },
  {
    id: "explore",
    label: "Explore",
    icon: "discover",
    activeIcon: "discoverFilled",
  },
  {
    id: "create",
    label: "Create",
    icon: "add",
    activeIcon: "add",
  },
  {
    id: "wheel",
    label: "Wheel",
    icon: "wheel",
    activeIcon: "wheelFilled",
  },
  {
    id: "profile",
    label: "Profile",
    icon: "profile",
    activeIcon: "profileFilled",
  },
];

const PAGE_TITLES = {
  home: "FoodMap",
  explore: "Explore",
  create: "Create Review",
  wheel: "Decision Wheel",
  profile: "My Profile",
};

// =====================================================
// Application Entry
// =====================================================

export default function App() {
  return (
    <SafeAreaProvider>
      <FoodMapApp />
    </SafeAreaProvider>
  );
}

// =====================================================
// Main Application
// =====================================================

function FoodMapApp() {
  const insets = useSafeAreaInsets();

  const session = useAuthSession();

  const auth = session.auth;

  const isAuthenticated =
    auth?.phase === "signedIn";

  const token = isAuthenticated
    ? auth?.token ?? null
    : null;

  const currentUserId = isAuthenticated
    ? auth?.user?.id ?? null
    : null;

  // =====================================================
  // 1. Navigation State
  // =====================================================

  const [page, setPage] = useState("home");

  const accountReturnPage = useRef("home");

  // =====================================================
  // 2. Home Post Navigation
  // =====================================================

  const [selectedPostId, setSelectedPostId] =
    useState(null);

  const [
    selectedPostRestaurantId,
    setSelectedPostRestaurantId,
  ] = useState(null);

  const [showPostRestaurantDishes, setShowPostRestaurantDishes] =
    useState(false);

  // Used to reload Home after a post is deleted.
  const [postFeedRevision, setPostFeedRevision] =
    useState(0);

  // =====================================================
  // 3. Authentication Navigation
  // =====================================================

  const openAccount = useCallback(
    (returnPage = "home") => {
      accountReturnPage.current = returnPage;
      setPage("profile");
    },
    []
  );

  const handleLoginRequired = useCallback(
    (returnPage = "home") => {
      openAccount(returnPage);
    },
    [openAccount]
  );

  const handleSessionExpired = useCallback(
    () => {
      openAccount("wheel");

      session.logout().catch((error) => {
        Alert.alert(
          "Sign-in required",
          error instanceof Error
            ? error.message
            : "Please sign in again."
        );
      });
    },
    [openAccount, session.logout]
  );

  const handleLoginSuccess = useCallback(
    () => {
      const destination =
        accountReturnPage.current;

      accountReturnPage.current = "home";

      const validDestination =
        NAV_ITEMS.some(
          (item) => item.id === destination
        );

      setPage(
        validDestination
          ? destination
          : "home"
      );
    },
    []
  );

  // =====================================================
  // 4. Bottom Navigation
  // =====================================================

  function navigateTo(nextPage) {
    if (nextPage === page) {
      // Return from a post detail to the Home feed.
      if (nextPage === "home") {
        closeHomeDetails();
      }

      return;
    }

    // Creating reviews requires authentication.
    if (
      nextPage === "create" &&
      !isAuthenticated
    ) {
      handleLoginRequired("create");
      return;
    }

    // The existing Decision Wheel is still
    // hosted by the authenticated Feed module.
    if (
      nextPage === "wheel" &&
      !isAuthenticated
    ) {
      handleLoginRequired("wheel");
      return;
    }

    if (nextPage === "profile") {
      accountReturnPage.current = "profile";
    }

    setPage(nextPage);
  }

  // =====================================================
  // 5. Notifications
  // =====================================================

  function openNotifications() {
    Alert.alert(
      "Notifications",
      "Notifications are not available yet."
    );
  }

  // =====================================================
  // 6. Post Navigation
  // =====================================================

  function openPost(post) {
    const id =
      typeof post === "string"
        ? post
        : post?.id;

    if (!id) {
      return;
    }

    setSelectedPostId(id);
    setSelectedPostRestaurantId(null);
    setShowPostRestaurantDishes(false);
  }

  function closeHomeDetails() {
    setSelectedPostId(null);
    setSelectedPostRestaurantId(null);
    setShowPostRestaurantDishes(false);
  }

  function backFromPost() {
    closeHomeDetails();
  }

  // =====================================================
  // 7. Restaurant Navigation from Post
  // =====================================================

  function openPostRestaurant(restaurantId) {
    const id =
      typeof restaurantId === "string"
        ? restaurantId
        : restaurantId?._id;

    if (!id) {
      return;
    }

    setSelectedPostRestaurantId(id);
    setShowPostRestaurantDishes(false);
  }

  function backFromPostRestaurant() {
    setSelectedPostRestaurantId(null);
    setShowPostRestaurantDishes(false);
  }

  function openPostRestaurantDishes() {
    if (!selectedPostRestaurantId) {
      return;
    }

    setShowPostRestaurantDishes(true);
  }

  function backFromPostRestaurantDishes() {
    setShowPostRestaurantDishes(false);
  }

  // =====================================================
  // 8. Post Deletion
  // =====================================================

  function handlePostDeleted() {
    closeHomeDetails();

    setPostFeedRevision(
      (current) => current + 1
    );
  }

  // =====================================================
  // Post Published
  // =====================================================

  function handlePostPublished(post) {
    // Refresh Home so the new post is visible.
    setPostFeedRevision(
      (current) => current + 1
    );

    // Clear any previously opened post details.
    closeHomeDetails();

    // Return to the public food feed.
    setPage("home");
  }

  // =====================================================
  // 9. Header
  // =====================================================

  const isHomeDetail =
    page === "home" &&
    Boolean(selectedPostId);

  const headerTitle =
    PAGE_TITLES[page] || "FoodMap";

  function renderHeader() {
    return (
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top,
          },
        ]}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerTitleRow}>
            {page === "home" && (
              <View style={styles.brandIcon}>
                <AppIcon
                  name="restaurant"
                  size={20}
                  color={colors.white}
                />
              </View>
            )}

            <Text
              style={styles.headerTitle}
              numberOfLines={1}
            >
              {headerTitle}
            </Text>
          </View>

          {page === "home" &&
          !isHomeDetail ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              onPress={openNotifications}
              style={({ pressed }) => [
                styles.headerAction,
                pressed && styles.pressed,
              ]}
            >
              <AppIcon
                name="notifications-outline"
                size={24}
                color={colors.text}
              />
            </Pressable>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>
      </View>
    );
  }

  // =====================================================
  // 10. Bottom Navigation
  // =====================================================

  function renderBottomNavigation() {
    return (
      <View
        style={[
          styles.bottomNavigation,
          {
            paddingBottom: Math.max(
              insets.bottom,
              spacing.sm
            ),
          },
        ]}
      >
        {NAV_ITEMS.map((item) => {
          const selected =
            page === item.id;

          const isCreate =
            item.id === "create";

          return (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{
                selected,
              }}
              onPress={() =>
                navigateTo(item.id)
              }
              style={({ pressed }) => [
                styles.navItem,
                pressed && styles.pressed,
              ]}
            >
              {isCreate ? (
                <View
                  style={[
                    styles.createIcon,
                    selected &&
                      styles.createIconSelected,
                  ]}
                >
                  <AppIcon
                    name="add"
                    size={26}
                    color={colors.white}
                  />
                </View>
              ) : (
                <AppIcon
                  name={
                    selected
                      ? item.activeIcon
                      : item.icon
                  }
                  size={23}
                  color={
                    selected
                      ? colors.primary
                      : colors.textSecondary
                  }
                />
              )}

              <Text
                numberOfLines={1}
                style={[
                  styles.navLabel,
                  selected &&
                    styles.navLabelSelected,
                ]}
              >
                {item.label}
              </Text>

              {selected && (
                <View
                  style={styles.activeIndicator}
                />
              )}
            </Pressable>
          );
        })}
      </View>
    );
  }

  // =====================================================
  // 11. Home Content
  // =====================================================

  function renderHome() {
    // Restaurant dishes opened from a post.
    if (
      selectedPostRestaurantId &&
      showPostRestaurantDishes
    ) {
      return (
        <DishBrowserScreen
          key={
            `post-dishes-${selectedPostRestaurantId}`
          }
          restaurantId={
            selectedPostRestaurantId
          }
          demo={false}
          token={token}
          authToken={token}
          isAuthenticated={
            isAuthenticated
          }
          onLoginPress={() =>
            handleLoginRequired("home")
          }
          onBack={
            backFromPostRestaurantDishes
          }
        />
      );
    }

    // Restaurant detail opened from a post.
    if (selectedPostRestaurantId) {
      return (
        <RestaurantDetailScreen
          key={
            `post-restaurant-${selectedPostRestaurantId}`
          }
          restaurantId={
            selectedPostRestaurantId
          }
          onBack={
            backFromPostRestaurant
          }
          onViewDishes={
            openPostRestaurantDishes
          }
        />
      );
    }

    // Post detail.
    if (selectedPostId) {
      return (
        <PostDetailScreen
          key={selectedPostId}
          postId={selectedPostId}
          token={token}
          currentUserId={
            currentUserId
          }
          onBack={backFromPost}
          onRestaurantPress={
            openPostRestaurant
          }
          onLoginRequired={() =>
            handleLoginRequired("home")
          }
          onDeleted={
            handlePostDeleted
          }
        />
      );
    }

    // Public Home Feed.
    return (
      <PostFeedScreen
        key={postFeedRevision}
        token={token}
        onPostPress={openPost}
        onLoginRequired={() =>
          handleLoginRequired("home")
        }
      />
    );
  }

  // =====================================================
  // 12. Main Render
  // =====================================================

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={
          colors.surface
        }
      />

      {renderHeader()}

      {/* ===============================================
          HOME - Public Food Posts
      =============================================== */}

      <View
        style={[
          styles.content,
          page !== "home" &&
            styles.hidden,
        ]}
        accessibilityElementsHidden={
          page !== "home"
        }
        importantForAccessibility={
          page === "home"
            ? "auto"
            : "no-hide-descendants"
        }
      >
        {renderHome()}
      </View>

      {/* ===============================================
          EXPLORE - Restaurant Discovery
      =============================================== */}

      <View
        style={[
          styles.content,
          page !== "explore" &&
            styles.hidden,
        ]}
        accessibilityElementsHidden={
          page !== "explore"
        }
        importantForAccessibility={
          page === "explore"
            ? "auto"
            : "no-hide-descendants"
        }
      >
        <RestaurantBrowser
          mode="explore"
          token={token}
          isAuthenticated={
            isAuthenticated
          }
          onLoginPress={() =>
            handleLoginRequired("explore")
          }
        />
      </View>

      {/* ===============================================
          CREATE - Food Posts and Reviews
      =============================================== */}

      <View
        style={[
          styles.content,
          page !== "create" &&
            styles.hidden,
        ]}
        accessibilityElementsHidden={
          page !== "create"
        }
        importantForAccessibility={
          page === "create"
            ? "auto"
            : "no-hide-descendants"
        }
      >
        {isAuthenticated && (
          <CreatePostScreen
            token={token}
            isAuthenticated={isAuthenticated}
            onLoginRequired={() =>
              handleLoginRequired("create")
            }
            onPublished={handlePostPublished}
          />
        )}
      </View>

      {/* ===============================================
          PROFILE - Accounts
      =============================================== */}

      <View
        style={[
          styles.content,
          page !== "profile" &&
            styles.hidden,
        ]}
        accessibilityElementsHidden={
          page !== "profile"
        }
        importantForAccessibility={
          page === "profile"
            ? "auto"
            : "no-hide-descendants"
        }
      >
        <AccountApp
          session={session}
          onLoginSuccess={
            handleLoginSuccess
          }
        />
      </View>

      {renderBottomNavigation()}
    </View>
  );
}

// =====================================================
// Styles
// =====================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    flex: 1,
    minHeight: 0,
  },

  hidden: {
    display: "none",
  },

  // =====================================================
  // Header
  // =====================================================

  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  headerContent: {
    height: 56,
    paddingHorizontal: spacing.lg,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
    minWidth: 0,
  },

  brandIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    ...typography.title,
    color: colors.text,
    flexShrink: 1,
  },

  headerAction: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },

  headerSpacer: {
    width: 44,
    height: 44,
  },

  // =====================================================
  // Bottom Navigation
  // =====================================================

  bottomNavigation: {
    flexDirection: "row",
    alignItems: "flex-start",

    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xs,

    backgroundColor: colors.surface,

    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  navItem: {
    flex: 1,
    minWidth: 0,
    minHeight: 58,

    alignItems: "center",
    justifyContent: "center",

    gap: spacing.xs,
  },

  navLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.textSecondary,
  },

  navLabelSelected: {
    color: colors.primary,
    fontWeight: "700",
  },

  activeIndicator: {
    position: "absolute",
    top: -8,

    width: 24,
    height: 3,

    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },

  createIcon: {
    width: 38,
    height: 38,

    borderRadius: radius.pill,

    backgroundColor: colors.primary,

    alignItems: "center",
    justifyContent: "center",
  },

  createIconSelected: {
    backgroundColor: colors.primaryPressed,
  },

  pressed: {
    opacity: 0.75,
  },
});