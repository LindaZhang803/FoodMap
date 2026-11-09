// FoodMap Design System
// Centralized colors, spacing, typography and shape tokens.

export const colors = {
  primary: "#FF3654",
  primaryPressed: "#E82D49",
  primaryLight: "#FFF0F3",

  background: "#FAFAFA",
  surface: "#FFFFFF",
  surfaceSecondary: "#F5F5F5",

  text: "#222222",
  textSecondary: "#757575",
  textMuted: "#A0A0A0",

  border: "#EBEBEB",
  divider: "#F0F0F0",

  success: "#22A06B",
  successLight: "#E8F7EF",

  warning: "#D99118",
  warningLight: "#FFF7E8",

  error: "#DC3545",
  errorLight: "#FFF0F0",

  white: "#FFFFFF",
  black: "#000000",

  overlay: "rgba(0,0,0,0.45)",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

export const typography = {
  hero: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "800",
  },

  title: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "700",
  },

  section: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "700",
  },

  cardTitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
  },

  body: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "400",
  },

  caption: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "400",
  },

  button: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
  },
};

export const sizes = {
  buttonHeight: 48,
  inputHeight: 48,
  iconSmall: 16,
  iconMedium: 20,
  iconLarge: 24,
  pagePadding: 16,
};

export const shadows = {
  card: {
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    elevation: 2,
  },
};

const designSystem = {
  colors,
  spacing,
  radius,
  typography,
  sizes,
  shadows,
};

export default designSystem;