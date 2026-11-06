import React, {
    useEffect,
    useLayoutEffect,
    useRef,
    useState
} from "react";

import {
    ScrollView,
    View,
    Text,
    TextInput,
    Image,
    ActivityIndicator,
    Pressable,
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    StyleSheet
} from "react-native";

import * as ImagePicker from "expo-image-picker";

import { ApiError } from "../services/authApi";

function listText(values) {
    return Array.isArray(values)
        ? values.filter(item => typeof item === "string").join(", ")
        : "";
}

function parseList(value = "") {
    return [...new Set(
        value
            .split(/[,，]/)
            .map(item => item.trim())
            .filter(Boolean)
    )];
}

function makeDraft(user) {
    return {
        username: user.username,
        bio: user.bio,
        favoriteCuisines: listText(user.favoriteCuisines),
        foodPreferences: listText(user.foodPreferences)
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
        foodPreferences: parseList(draft.foodPreferences)
    };
}

function ProfileField({ label, value }) {
    return (
        <View style={styles.field}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value}>{value}</Text>
        </View>
    );
}

function ProfileButton({
    title,
    onPress,
    disabled = false,
    secondary = false
}) {
    return (
        <Pressable
            style={[
                styles.button,
                secondary && styles.secondaryButton,
                disabled && styles.buttonDisabled
            ]}
            onPress={onPress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ disabled }}
        >
            <Text style={[
                styles.buttonText,
                secondary && styles.secondaryButtonText
            ]}>
                {title}
            </Text>
        </Pressable>
    );
}

function FormField({ label, ...props }) {
    return (
        <View style={styles.field}>
            <Text style={styles.label}>{label}</Text>

            <TextInput
                accessibilityLabel={label}
                style={[
                    styles.input,
                    props.multiline && styles.multilineInput
                ]}
                {...props}
            />
        </View>
    );
}

function ProfileEditor({
    draft,
    onChange,
    onSave,
    onCancel,
    disabled,
    isSaving
}) {
    return (
        <View>
            <FormField
                label="Username"
                value={draft.username}
                onChangeText={value => onChange("username", value)}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!disabled}
            />

            <FormField
                label="Bio"
                value={draft.bio}
                onChangeText={value => onChange("bio", value)}
                multiline
                editable={!disabled}
            />

            <FormField
                label="Favorite cuisines"
                value={draft.favoriteCuisines}
                onChangeText={value => onChange("favoriteCuisines", value)}
                placeholder="Chinese, Japanese, Korean"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!disabled}
            />

            <Text style={styles.hint}>
                Separate cuisines with commas.
            </Text>

            <FormField
                label="Food preferences"
                value={draft.foodPreferences}
                onChangeText={value => onChange("foodPreferences", value)}
                placeholder="Vegetarian, Mild"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!disabled}
            />

            <Text style={styles.hint}>
                Separate preferences with commas, e.g. Vegetarian, Mild
            </Text>

            <ProfileButton
                title={isSaving ? "Saving..." : "Save changes"}
                onPress={onSave}
                disabled={disabled}
            />

            <ProfileButton
                title="Cancel"
                onPress={onCancel}
                disabled={disabled}
                secondary
            />
        </View>
    );
}

export default function ProfileScreen({
    user,
    onLogout,
    onSave,
    onChangeAvatar,
    isLoggingOut = false,
    isSaving = false,
    isUploading = false
}) {
    const [failedImageUri, setFailedImageUri] = useState("");
    const [avatarStep, setAvatarStep] = useState("idle");
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState(() => makeDraft(user));

    const imageUri = /^https?:\/\//i.test(user.profileImage)
        ? user.profileImage
        : "";

    const mounted = useRef(false);
    const screenOperation = useRef(null);
    const displayedUserId = useRef(user.id);
    const currentImageUri = useRef(imageUri);

    const busy = (
        isSaving ||
        isLoggingOut ||
        isUploading ||
        avatarStep !== "idle"
    );

    const canEdit = typeof onSave === "function" && !busy;

    const canChangeAvatar = (
        typeof onChangeAvatar === "function" &&
        !busy &&
        !isEditing
    );

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

        setDraft(current => ({
            ...current,
            [field]: value
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
                    error instanceof Error
                        ? error.message
                        : "Please try again."
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
            quality: 0.8
        });

        if (!isCurrentOperation(id) || result.canceled) {
            return null;
        }

        const asset = result.assets?.[0];

        if (!asset || typeof asset.uri !== "string" || !asset.uri) {
            throw new ApiError(
                "Please select a photo and try again."
            );
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
                    error instanceof Error
                        ? error.message
                        : "Please try again."
                );
            }
        } finally {
            if (screenOperation.current === id) {
                screenOperation.current = null;
            }
        }
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
            >
                <Text style={styles.title}>
                    {isEditing ? "Edit Profile" : "My Profile"}
                </Text>

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
                        <View style={[
                            styles.avatar,
                            styles.avatarPlaceholder
                        ]}>
                            <Text style={styles.avatarLetter}>
                                {user.username.charAt(0).toUpperCase()}
                            </Text>
                        </View>
                    )}

                    <Pressable
                        style={({ pressed }) => [
                            styles.avatarAddButton,
                            !canChangeAvatar && styles.buttonDisabled,
                            pressed && styles.avatarAddPressed
                        ]}
                        onPress={handleChangeAvatar}
                        disabled={!canChangeAvatar}
                        accessibilityRole="button"
                        accessibilityLabel="Change profile photo"
                        accessibilityHint="Opens your photo library"
                        accessibilityState={{
                            disabled: !canChangeAvatar,
                            busy: avatarStep !== "idle" || isUploading
                        }}
                    >
                        <View style={styles.avatarAddCircle}>
                            {avatarStep !== "idle" || isUploading ? (
                                <ActivityIndicator
                                    size="small"
                                    color="#fff"
                                />
                            ) : (
                                <Text style={styles.avatarAddIcon}>
                                    +
                                </Text>
                            )}
                        </View>
                    </Pressable>
                </View>

                <Text style={styles.username}>
                    {user.username}
                </Text>

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
                            label="Favorite cuisines"
                            value={
                                listText(user.favoriteCuisines) ||
                                "Not set"
                            }
                        />

                        <ProfileField
                            label="Food preferences"
                            value={
                                listText(user.foodPreferences) ||
                                "Not set"
                            }
                        />

                        <ProfileButton
                            title="Edit profile"
                            onPress={beginEdit}
                            disabled={!canEdit}
                        />
                    </View>
                )}

                <ProfileButton
                    title={isLoggingOut ? "Logging out..." : "Log out"}
                    onPress={handleLogout}
                    disabled={
                        busy ||
                        isEditing ||
                        typeof onLogout !== "function"
                    }
                    secondary
                />

                <Text style={styles.note}>
                    Logging out also ends this account's other active sessions.
                </Text>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: "#fff"
    },
    container: {
        flexGrow: 1,
        padding: 25,
        paddingBottom: 40
    },
    title: {
        fontSize: 30,
        fontWeight: "bold",
        textAlign: "center",
        marginBottom: 25
    },
    avatarWrapper: {
        width: 110,
        height: 110,
        position: "relative",
        alignSelf: "center",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 24
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50
    },
    avatarPlaceholder: {
        backgroundColor: "#eaf0ff",
        justifyContent: "center",
        alignItems: "center"
    },
    avatarLetter: {
        fontSize: 36,
        fontWeight: "bold",
        color: "#1b5ad0ff"
    },
    avatarAddButton: {
        position: "absolute",
        right: 0,
        bottom: 0,
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center"
    },
    avatarAddCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        borderWidth: 3,
        borderColor: "#fff",
        backgroundColor: "#1b5ad0ff",
        alignItems: "center",
        justifyContent: "center"
    },
    avatarAddIcon: {
        color: "#fff",
        fontSize: 26,
        lineHeight: 28,
        fontWeight: "500",
        textAlign: "center",
        includeFontPadding: false
    },
    avatarAddPressed: {
        opacity: 0.75
    },
    username: {
        fontSize: 24,
        fontWeight: "bold",
        textAlign: "center",
        marginBottom: 30
    },
    field: {
        marginBottom: 20
    },
    label: {
        fontSize: 14,
        color: "#666",
        marginBottom: 6
    },
    value: {
        fontSize: 17,
        color: "#222",
        lineHeight: 25
    },
    input: {
        minHeight: 50,
        borderWidth: 1,
        borderColor: "#ccc",
        borderRadius: 10,
        paddingHorizontal: 15,
        paddingVertical: 12,
        fontSize: 16,
        color: "#222"
    },
    multilineInput: {
        minHeight: 100,
        textAlignVertical: "top"
    },
    hint: {
        fontSize: 13,
        color: "#666",
        marginBottom: 8
    },
    button: {
        backgroundColor: "#1b5ad0ff",
        padding: 16,
        borderRadius: 10,
        alignItems: "center",
        marginTop: 12
    },
    secondaryButton: {
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#1b5ad0ff"
    },
    buttonDisabled: {
        opacity: 0.5
    },
    buttonText: {
        color: "#fff",
        fontSize: 17,
        fontWeight: "bold"
    },
    secondaryButtonText: {
        color: "#1b5ad0ff"
    },
    note: {
        color: "#666",
        fontSize: 13,
        textAlign: "center",
        marginTop: 12
    }
});