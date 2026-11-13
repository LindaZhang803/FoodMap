import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import {
  ScrollView,
  View,
  Text,
  Image,
  ActivityIndicator,
  Pressable,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";

import * as ImagePicker from "expo-image-picker";

import {
  ApiError,
  getMyReviews,
} from "../services/authApi";

import ReviewHistorySection from "./ReviewHistorySection";

import SpicinessQuestionnaireScreen from "./SpicinessQuestionnaireScreen";

import {
  colors,
  spacing,
  radius,
  typography,
} from "../../../shared/design/tokens";

import {
  AppButton,
  AppInput,
  AppCard,
} from "../../../shared/design/UIComponents";

import AppIcon from "../../../shared/components/AppIcon";

function listText(values) {
  return Array.isArray(values)
    ? values.filter((item) => typeof item === "string").join(", ")
    : "";
}

function parseList(value = "") {
  return [
    ...new Set(
      value
        .split(/[,，]/)
        .map((item) => item.trim())
        .filter(Boolean)
    ),
  ];
}

function makeDraft(user) {
  return {
    username: user.username || "",
    bio: user.bio || "",
    favoriteCuisines: listText(user.favoriteCuisines),
    foodPreferences: listText(user.foodPreferences),
  };
}

function makeProfileData(draft) {
  const username = draft.username.trim();

  if (!username) {
    throw new Error("Please enter a username.");
  }

  return {
    username,
    bio: draft.bio.trim(),
    favoriteCuisines: parseList(draft.favoriteCuisines),
    foodPreferences: parseList(draft.foodPreferences),
  };
}

function ProfileField({ label, value }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || "Not set"}</Text>
    </View>
  );
}

function ProfileEditor({
  draft,
  onChange,
  onSave,
  onCancel,
  disabled,
  isSaving,
}) {
  return (
    <View style={styles.editor}>
      <AppInput
        label="Username"
        leftIcon="user"
        value={draft.username}
        onChangeText={(value) => onChange("username", value)}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!disabled}
      />

      <AppInput
        label="Bio"
        leftIcon="edit"
        value={draft.bio}
        onChangeText={(value) => onChange("bio", value)}
        multiline
        editable={!disabled}
        placeholder="Tell others about yourself"
        style={styles.bioInput}
      />

      <AppInput
        label="Favorite Cuisines"
        leftIcon="cuisine"
        value={draft.favoriteCuisines}
        onChangeText={(value) => onChange("favoriteCuisines", value)}
        placeholder="Chinese, Japanese, Korean"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!disabled}
      />

      <Text style={styles.hint}>
        Separate cuisines with commas.
      </Text>

      <AppInput
        label="Food Preferences"
        leftIcon="restaurant"
        value={draft.foodPreferences}
        onChangeText={(value) => onChange("foodPreferences", value)}
        placeholder="Vegetarian, Mild"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!disabled}
      />

      <Text style={styles.hint}>
        Separate preferences with commas.
      </Text>

      <AppButton
        title={isSaving ? "Saving..." : "Save Changes"}
        icon="check"
        onPress={onSave}
        disabled={disabled}
        loading={isSaving}
        style={styles.editorButton}
      />

      <AppButton
        title="Cancel"
        icon="close"
        variant="secondary"
        onPress={onCancel}
        disabled={disabled}
        style={styles.editorButton}
      />
    </View>
  );
}

export default function ProfileScreen({
  user,
  token,
  onLogout,
  onSave,
  onChangeAvatar,

  onOpenFavorites,
  onOpenWantToTry,

  isLoggingOut = false,
  isSaving = false,
  isUploading = false,
}) {
  const [failedImageUri, setFailedImageUri] = useState("");
  const [avatarStep, setAvatarStep] = useState("idle");
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(() => makeDraft(user));

  // Spiciness Questionnaire
  const [showSpicinessQuestionnaire, setShowSpicinessQuestionnaire] =
    useState(false);

  const imageUri =
    typeof user.profileImage === "string" &&
    /^https?:\/\//i.test(user.profileImage)
      ? user.profileImage
      : "";

  const mounted = useRef(false);
  const screenOperation = useRef(null);
  const displayedUserId = useRef(user.id);
  const currentImageUri = useRef(imageUri);

  const busy =
    isSaving ||
    isLoggingOut ||
    isUploading ||
    avatarStep !== "idle";

  const canEdit = typeof onSave === "function" && !busy;

  const canChangeAvatar =
    typeof onChangeAvatar === "function" &&
    !busy &&
    !isEditing;

  useEffect(() => {
    mounted.current = true;
    setAvatarStep("idle");

    return () => {
      mounted.current = false;
      screenOperation.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    currentImageUri.current = imageUri;
  }, [imageUri]);

  useLayoutEffect(() => {
    if (displayedUserId.current !== user.id) {
      displayedUserId.current = user.id;
      screenOperation.current = null;
      setAvatarStep("idle");
      setIsEditing(false);
      setFailedImageUri("");
      setDraft(makeDraft(user));
      setShowSpicinessQuestionnaire(false);
    }
  }, [user]);

  function isCurrentOperation(id) {
    return (
      mounted.current &&
      screenOperation.current === id &&
      displayedUserId.current === user.id
    );
  }

  function beginEdit() {
    if (!mounted.current || !canEdit || screenOperation.current) {
      return;
    }

    setDraft(makeDraft(user));
    setIsEditing(true);
  }

  function changeDraft(field, value) {
    if (!mounted.current || busy || screenOperation.current) {
      return;
    }

    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function cancelEdit() {
    if (!mounted.current || busy || screenOperation.current) {
      return;
    }

    Keyboard.dismiss();
    setIsEditing(false);
  }

  async function handleSave() {
    if (
      !mounted.current ||
      busy ||
      screenOperation.current ||
      typeof onSave !== "function"
    ) {
      return;
    }

    const id = Symbol("profile-save");
    screenOperation.current = id;
    Keyboard.dismiss();

    try {
      const savedUser = await onSave(makeProfileData(draft));

      if (!savedUser || !isCurrentOperation(id)) {
        return;
      }

      setIsEditing(false);
      Alert.alert("Success", "Profile updated successfully.");
    } catch (error) {
      if (isCurrentOperation(id)) {
        Alert.alert(
          "Save failed",
          error instanceof Error ? error.message : "Please try again."
        );
      }
    } finally {
      if (screenOperation.current === id) {
        screenOperation.current = null;
      }
    }
  }

  async function selectAvatar(id) {
    if (!isCurrentOperation(id)) {
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!isCurrentOperation(id) || result.canceled) {
      return null;
    }

    const asset = result.assets?.[0];

    if (!asset || typeof asset.uri !== "string" || !asset.uri) {
      throw new ApiError("Please select a photo and try again.");
    }

    return asset;
  }

  async function handleChangeAvatar() {
    if (
      !mounted.current ||
      !canChangeAvatar ||
      screenOperation.current
    ) {
      return;
    }

    const id = Symbol("avatar-change");
    screenOperation.current = id;
    setAvatarStep("choosing");
    Keyboard.dismiss();

    try {
      const asset = await selectAvatar(id);

      if (!asset || !isCurrentOperation(id)) {
        return;
      }

      setAvatarStep("uploading");

      const savedUser = await onChangeAvatar(asset);

      if (!savedUser || !isCurrentOperation(id)) {
        return;
      }

      setFailedImageUri("");
      Alert.alert("Success", "Avatar updated successfully.");
    } catch (error) {
      if (isCurrentOperation(id)) {
        Alert.alert(
          "Avatar update failed",
          error instanceof ApiError
            ? error.message
            : "Could not change your avatar. Please try again."
        );
      }
    } finally {
      if (isCurrentOperation(id)) {
        setAvatarStep("idle");
        screenOperation.current = null;
      }
    }
  }

  async function handleLogout() {
    if (
      !mounted.current ||
      busy ||
      isEditing ||
      screenOperation.current ||
      typeof onLogout !== "function"
    ) {
      return;
    }

    const id = Symbol("profile-logout");
    screenOperation.current = id;

    try {
      await onLogout();
    } catch (error) {
      if (isCurrentOperation(id)) {
        Alert.alert(
          "Logout failed",
          error instanceof Error ? error.message : "Please try again."
        );
      }
    } finally {
      if (screenOperation.current === id) {
        screenOperation.current = null;
      }
    }
  }

  // =====================================================
  // Spiciness Questionnaire Navigation
  // =====================================================

  if (showSpicinessQuestionnaire) {
    return (
      <SpicinessQuestionnaireScreen
        initialValues={{
          preferredSpiciness:
            user.spicinessPreferences?.preferredSpiciness ?? null,

          spicyFoodFrequency:
            user.spicinessPreferences?.spicyFoodFrequency ?? null,

          maximumSpiciness:
            user.spicinessPreferences?.maximumSpiciness ?? null,
        }}

        onBack={() => {
          setShowSpicinessQuestionnaire(false);
        }}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileHeader}>
          <View style={styles.avatarWrapper}>
            {imageUri && failedImageUri !== imageUri ? (
              <Image
                key={imageUri}
                source={{ uri: imageUri }}
                style={styles.avatar}
                onError={() => {
                  if (
                    mounted.current &&
                    currentImageUri.current === imageUri
                  ) {
                    setFailedImageUri(imageUri);
                  }
                }}
              />
            ) : (
              <View
                style={[
                  styles.avatar,
                  styles.avatarPlaceholder,
                ]}
              >
                <Text style={styles.avatarLetter}>
                  {user.username?.charAt(0).toUpperCase() || "U"}
                </Text>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.avatarAddButton,
                !canChangeAvatar && styles.buttonDisabled,
                pressed && styles.avatarAddPressed,
              ]}
              onPress={handleChangeAvatar}
              disabled={!canChangeAvatar}
              accessibilityRole="button"
              accessibilityLabel="Change profile photo"
              accessibilityHint="Opens your photo library"
              accessibilityState={{
                disabled: !canChangeAvatar,
                busy: avatarStep !== "idle" || isUploading,
              }}
            >
              <View style={styles.avatarAddCircle}>
                {avatarStep !== "idle" || isUploading ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.white}
                  />
                ) : (
                  <AppIcon
                    name="camera"
                    size={19}
                    color={colors.white}
                  />
                )}
              </View>
            </Pressable>
          </View>

          <Text style={styles.username}>{user.username}</Text>
          <Text style={styles.profileSubtitle}>
            FoodMap Member
          </Text>
        </View>

        <AppCard style={styles.sectionCard}>
          <View style={styles.sectionHeading}>
            <AppIcon
              name="user"
              size={20}
              color={colors.primary}
            />
            <Text style={styles.sectionTitle}>
              Account Information
            </Text>
          </View>

          <ProfileField
            label="Email"
            value={user.email}
          />

          {isEditing ? (
            <ProfileEditor
              draft={draft}
              onChange={changeDraft}
              onSave={handleSave}
              onCancel={cancelEdit}
              disabled={busy}
              isSaving={isSaving}
            />
          ) : (
            <View>
              <ProfileField
                label="Bio"
                value={user.bio || "Not set"}
              />

              <ProfileField
                label="Favorite Cuisines"
                value={
                  listText(user.favoriteCuisines) || "Not set"
                }
              />

              <ProfileField
                label="Food Preferences"
                value={
                  listText(user.foodPreferences) || "Not set"
                }
              />

              {/* Spiciness Preferences */}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit Spiciness Preferences"
                disabled={busy}
                onPress={() => {
                  setShowSpicinessQuestionnaire(true);
                }}
                style={({ pressed }) => [
                  styles.spicinessEntry,
                  pressed && styles.collectionPressed,
                ]}
              >
                <View style={styles.collectionInfo}>
                  <Text style={styles.collectionTitle}>
                    Spiciness Preferences
                  </Text>

                  <Text style={styles.collectionDescription}>
                    Set your preferred spice level, eating frequency,
                    and maximum spiciness.
                  </Text>
                </View>

                <AppIcon
                  name="forward"
                  size={20}
                  color={colors.textSecondary}
                />
              </Pressable>

              <AppButton
                title="Edit Profile"
                icon="edit"
                onPress={beginEdit}
                disabled={!canEdit}
                style={styles.editButton}
              />
            </View>
          )}
        </AppCard>

        <AppCard style={styles.sectionCard}>
          <View style={styles.sectionHeading}>
            <AppIcon
              name="reviews"
              size={20}
              color={colors.primary}
            />
            <Text style={styles.sectionTitle}>
              My Reviews
            </Text>
          </View>

          <ReviewHistorySection
            key={user.id}
            token={token}
            loadReviews={getMyReviews}
          />
        </AppCard>

        {/* ================================================
            Favorites & Want to Try
        ================================================ */}

        <AppCard style={styles.sectionCard}>

          <View style={styles.sectionHeading}>
            <AppIcon
              name="favoriteFilled"
              size={20}
              color={colors.primary}
            />

            <Text style={styles.sectionTitle}>
              My Collections
            </Text>
          </View>

          {/* Favorites */}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View Favorites"
            accessibilityState={{
              disabled: typeof onOpenFavorites !== "function",
            }}
            disabled={typeof onOpenFavorites !== "function"}
            onPress={onOpenFavorites}
            style={({ pressed }) => [
              styles.collectionItem,
              pressed && styles.collectionPressed,
            ]}
          >
            <View style={styles.collectionInfo}>
              <Text style={styles.collectionTitle}>
                Favorites
              </Text>

              <Text style={styles.collectionDescription}>
                View your saved restaurants and dishes.
              </Text>
            </View>

            <AppIcon
              name="forward"
              size={20}
              color={colors.textSecondary}
            />
          </Pressable>

          {/* Want to Try */}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View Want to Try"
            accessibilityState={{
              disabled: typeof onOpenWantToTry !== "function",
            }}
            disabled={typeof onOpenWantToTry !== "function"}
            onPress={onOpenWantToTry}
            style={({ pressed }) => [
              styles.collectionItem,
              pressed && styles.collectionPressed,
            ]}
          >
            <View style={styles.collectionInfo}>
              <Text style={styles.collectionTitle}>
                Want to Try
              </Text>

              <Text style={styles.collectionDescription}>
                Explore your Want to Try list.
              </Text>
            </View>

            <AppIcon
              name="forward"
              size={20}
              color={colors.textSecondary}
            />
          </Pressable>

        </AppCard>

        <View style={styles.logoutSection}>
          <AppButton
            title={isLoggingOut ? "Logging out..." : "Log Out"}
            icon="logout"
            onPress={handleLogout}
            disabled={
              busy ||
              isEditing ||
              typeof onLogout !== "function"
            }
            loading={isLoggingOut}
            variant="outline"
            style={styles.logoutButton}
            textStyle={styles.logoutText}
          />

          <Text style={styles.note}>
            Logging out also ends this account's other active sessions.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: 40,
  },
  profileHeader: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
    marginBottom: spacing.md,
  },
  avatarWrapper: {
    width: 110,
    height: 110,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    fontSize: 36,
    fontWeight: "800",
    color: colors.primary,
  },
  avatarAddButton: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarAddCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: colors.white,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarAddPressed: {
    opacity: 0.75,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  username: {
    ...typography.title,
    color: colors.text,
    textAlign: "center",
  },
  profileSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  sectionCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.section,
    color: colors.text,
  },
  field: {
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  fieldValue: {
    ...typography.body,
    color: colors.text,
  },
  editor: {
    marginTop: spacing.sm,
  },
  bioInput: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: -spacing.sm,
    marginBottom: spacing.lg,
  },
  editorButton: {
    marginTop: spacing.md,
  },
  editButton: {
    marginTop: spacing.md,
  },
  logoutSection: {
    marginTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  logoutButton: {
    borderColor: colors.error,
  },
  logoutText: {
    color: colors.error,
  },
  note: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },

  // =====================================================
  // Collections
  // =====================================================

  collectionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    paddingVertical: spacing.lg,

    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  collectionInfo: {
    flex: 1,
    marginRight: spacing.md,
  },

  collectionTitle: {
    ...typography.body,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.xs,
  },

  collectionDescription: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  collectionPressed: {
    opacity: 0.65,
  },

  spicinessEntry: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.lg,
    marginBottom: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
});
