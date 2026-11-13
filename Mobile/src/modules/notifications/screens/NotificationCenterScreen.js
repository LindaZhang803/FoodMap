import React, { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";

import {
  colors,
  spacing,
  radius,
  typography,
} from "../../../shared/design/tokens";

import AppIcon from "../../../shared/components/AppIcon";

// =====================================================
// Demo Notifications
// Replace with backend data when the API is available.
// =====================================================

const DEMO_NOTIFICATIONS = [
  {
    id: "demo-like-1",
    type: "like",
    title: "New Like",
    message: "Someone liked your food review.",
    createdAt: "2026-11-13T10:30:00",
    read: false,
    postId: null,
  },
  {
    id: "demo-reply-1",
    type: "reply",
    title: "New Comment Reply",
    message: "Someone replied to your comment.",
    createdAt: "2026-11-13T09:15:00",
    read: false,
    postId: null,
  },
  {
    id: "demo-system-1",
    type: "system",
    title: "Welcome to FoodMap",
    message: "Discover restaurants and share your experiences.",
    createdAt: "2026-11-12T16:00:00",
    read: true,
    destination: "explore",
  },
];

// =====================================================
// Helpers
// =====================================================

function getNotificationIcon(type) {
  switch (type) {
    case "like":
      return "like";

    case "reply":
      return "comment";

    default:
      return "notifications-outline";
  }
}

function formatDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString();
}

// =====================================================
// Notification Center Screen
// =====================================================

export default function NotificationCenterScreen({
  onBack,
  onOpenPost,
  onOpenHome,
  onOpenExplore,
}) {
  const [notifications, setNotifications] = useState(
    () => DEMO_NOTIFICATIONS.map((item) => ({ ...item }))
  );

  const unreadCount = notifications.filter(
    (item) => !item.read
  ).length;

  const insets = useSafeAreaInsets();

  // =====================================================
  // Mark One Notification as Read
  // =====================================================

  function markAsRead(id) {
    setNotifications((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, read: true }
          : item
      )
    );
  }

  // =====================================================
  // Mark All as Read
  // =====================================================

  function markAllAsRead() {
    setNotifications((current) =>
      current.map((item) => ({
        ...item,
        read: true,
      }))
    );
  }

  // =====================================================
  // Open Notification
  // =====================================================

  function openNotification(item) {
    markAsRead(item.id);

    // Actual post navigation requires a valid backend post ID.
    if (
      (item.type === "like" || item.type === "reply") &&
      item.postId &&
      typeof onOpenPost === "function"
    ) {
      onOpenPost(item.postId);
      return;
    }

    // Demo notifications without post IDs open the feed.
    if (item.type === "like" || item.type === "reply") {
      onOpenHome?.();
      return;
    }

    if (item.destination === "explore") {
      onOpenExplore?.();
    }
  }

  // =====================================================
  // Render
  // =====================================================

  return (
    <View style={styles.container}>
      {/* Header */}

      <View
		style={[
			styles.header,
			{
			paddingTop: insets.top,
			height: 54 + insets.top,
			},
		]}
		>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back from notifications"
          onPress={onBack}
          style={styles.backButton}
        >
          <AppIcon
            name="back"
            size={24}
            color={colors.primary}
          />
        </Pressable>

        <Text style={styles.headerTitle}>
          Notification Center
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary */}

        <View style={styles.summary}>
          <View>
            <Text style={styles.heading}>
              Notifications
            </Text>

            <Text style={styles.subtitle}>
              {unreadCount === 0
                ? "You're all caught up."
                : `${unreadCount} unread notification${
                    unreadCount === 1 ? "" : "s"
                  }`}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mark all as read"
            disabled={unreadCount === 0}
            onPress={markAllAsRead}
            style={[
              styles.markAllButton,
              unreadCount === 0 && styles.disabled,
            ]}
          >
            <Text style={styles.markAllText}>
              Mark All Read
            </Text>
          </Pressable>
        </View>

        {/* Notification List */}

        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <AppIcon
              name="notifications-outline"
              size={42}
              color={colors.textMuted}
            />

            <Text style={styles.emptyTitle}>
              No Notifications Yet
            </Text>

            <Text style={styles.emptyDescription}>
              Your notifications will appear here.
            </Text>
          </View>
        ) : (
          notifications.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`Open notification: ${item.title}`}
              onPress={() => openNotification(item)}
              style={({ pressed }) => [
                styles.notificationCard,
                !item.read && styles.unreadCard,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.iconContainer}>
                <AppIcon
                  name={getNotificationIcon(item.type)}
                  size={22}
                  color={colors.primary}
                />
              </View>

              <View style={styles.notificationContent}>
                <View style={styles.titleRow}>
                  <Text style={styles.notificationTitle}>
                    {item.title}
                  </Text>

                  {!item.read && (
                    <View style={styles.unreadDot} />
                  )}
                </View>

                <Text style={styles.message}>
                  {item.message}
                </Text>

                <Text style={styles.time}>
                  {formatDate(item.createdAt)}
                </Text>

                <Text style={styles.readStatus}>
                  {item.read ? "Read" : "Unread"}
                </Text>
              </View>

              <AppIcon
                name="forward"
                size={18}
                color={colors.textMuted}
              />
            </Pressable>
          ))
        )}
      </ScrollView>
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

  header: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  backButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },

  headerSpacer: {
    width: 42,
  },

  scrollView: {
    flex: 1,
  },

  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },

  summary: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },

  heading: {
    ...typography.title,
    color: colors.text,
  },

  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  markAllButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
  },

  markAllText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },

  disabled: {
    opacity: 0.5,
  },

  notificationCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },

  unreadCard: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },

  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
  },

  notificationContent: {
    flex: 1,
    minWidth: 0,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },

  notificationTitle: {
    ...typography.cardTitle,
    color: colors.text,
    flexShrink: 1,
  },

  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },

  message: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  time: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },

  readStatus: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.primary,
    marginTop: spacing.xs,
  },

  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxxl,
    gap: spacing.md,
  },

  emptyTitle: {
    ...typography.section,
    color: colors.text,
  },

  emptyDescription: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
  },

  pressed: {
    opacity: 0.75,
  },
});