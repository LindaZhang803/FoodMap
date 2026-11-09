import React from "react";

import Ionicons from "@expo/vector-icons/Ionicons";

import {
  colors,
  sizes,
} from "../design/tokens";

// =====================================================
// FoodMap Icon System
// =====================================================

const ICON_NAMES = {
  // Navigation
  home: "home-outline",
  homeFilled: "home",

  discover: "compass-outline",
  discoverFilled: "compass",

  feed: "newspaper-outline",
  feedFilled: "newspaper",

  wheel: "disc-outline",
  wheelFilled: "disc",

  profile: "person-outline",
  profileFilled: "person",

  back: "arrow-back",
  forward: "arrow-forward",
  chevronBack: "chevron-back",
  chevronForward: "chevron-forward",
  chevronDown: "chevron-down",

  close: "close",
  menu: "menu",
  settings: "settings-outline",

  // Restaurant discovery
  search: "search-outline",
  filter: "options-outline",
  sort: "swap-vertical-outline",
  location: "location-outline",
  locationFilled: "location",
  nearby: "navigate-outline",
  restaurant: "restaurant-outline",
  cuisine: "fast-food-outline",
  price: "cash-outline",
  clock: "time-outline",

  // Reviews
  star: "star-outline",
  starFilled: "star",
  starHalf: "star-half",
  reviews: "chatbubble-outline",
  comment: "chatbubble-ellipses-outline",
  like: "heart-outline",
  likeFilled: "heart",
  edit: "create-outline",
  delete: "trash-outline",

  // Favorites
  favorite: "heart-outline",
  favoriteFilled: "heart",
  bookmark: "bookmark-outline",
  bookmarkFilled: "bookmark",

  // Photos
  camera: "camera-outline",
  image: "image-outline",
  upload: "cloud-upload-outline",
  addPhoto: "camera-outline",

  // Accounts
  user: "person-outline",
  userFilled: "person",
  email: "mail-outline",
  password: "lock-closed-outline",
  eye: "eye-outline",
  eyeOff: "eye-off-outline",
  login: "log-in-outline",
  logout: "log-out-outline",

  // Actions
  add: "add",
  remove: "remove",
  check: "checkmark",
  refresh: "refresh",
  retry: "refresh-outline",
  share: "share-outline",

  // States
  loading: "hourglass-outline",
  empty: "file-tray-outline",
  error: "alert-circle-outline",
  warning: "warning-outline",
  success: "checkmark-circle-outline",
  info: "information-circle-outline",
};

export default function AppIcon({
  name,
  size = sizes.iconMedium,
  color = colors.text,
  style,
  accessibilityLabel,
  ...props
}) {
  const iconName =
    ICON_NAMES[name] || name || "help-circle-outline";

  return (
    <Ionicons
      name={iconName}
      size={size}
      color={color}
      style={style}
      accessibilityLabel={accessibilityLabel}
      {...props}
    />
  );
}

export { ICON_NAMES };