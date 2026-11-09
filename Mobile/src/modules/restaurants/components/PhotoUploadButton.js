import React, { useState } from "react";

import {
  View,
  Text,
  Image,
  Alert,
  StyleSheet,
} from "react-native";

import * as ImagePicker from "expo-image-picker";

import { uploadRestaurantPhoto } from "../services/photoApi";

import {
  colors,
  spacing,
  radius,
  typography,
} from "../../../shared/design/tokens";

import {
  AppButton,
} from "../../../shared/design/UIComponents";

export default function PhotoUploadButton({
  restaurantId,
}) {
  const [selectedPhoto, setSelectedPhoto] =
    useState(null);

  const [uploading, setUploading] =
    useState(false);

  // =====================================================
  // 1. Select photo
  // =====================================================

  async function selectPhoto() {
    if (uploading) return;

    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission Required",
          "Please allow FoodMap to access your photos."
        );

        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });

      if (
        !result.canceled &&
        result.assets?.length > 0
      ) {
        setSelectedPhoto(result.assets[0]);
      }
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error
          ? error.message
          : "Unable to select photo."
      );
    }
  }

  // =====================================================
  // 2. Upload photo
  // =====================================================

  async function submitPhoto() {
    if (!selectedPhoto || uploading) {
      return;
    }

    if (!restaurantId) {
      Alert.alert(
        "Error",
        "Restaurant ID is missing."
      );

      return;
    }

    try {
      setUploading(true);

      const result =
        await uploadRestaurantPhoto(
          restaurantId,
          selectedPhoto
        );

      if (result.status === "pending") {
        Alert.alert(
          "Upload Successful",
          "Your photo has been submitted for review."
        );
      } else {
        Alert.alert(
          "Success",
          "Photo uploaded successfully."
        );
      }

      setSelectedPhoto(null);
    } catch (error) {
      Alert.alert(
        "Upload Failed",
        error instanceof Error
          ? error.message
          : "Please try again."
      );
    } finally {
      setUploading(false);
    }
  }

  // =====================================================
  // 3. Cancel selected photo
  // =====================================================

  function cancelPhoto() {
    if (uploading) {
      return;
    }

    setSelectedPhoto(null);
  }

  // =====================================================
  // 4. Render
  // =====================================================

  return (
    <View style={styles.container}>
      {!selectedPhoto ? (
        <View style={styles.uploadArea}>
          <View style={styles.uploadIcon}>
            <Text style={styles.uploadIconText}>
              +
            </Text>
          </View>

          <Text style={styles.title}>
            Share a Restaurant Photo
          </Text>

          <Text style={styles.description}>
            Add a photo from your dining experience.
          </Text>

          <AppButton
            title="Choose Photo"
            onPress={selectPhoto}
            disabled={uploading}
            style={styles.chooseButton}
          />
        </View>
      ) : (
        <View style={styles.previewContainer}>
          <Text style={styles.previewTitle}>
            Photo Preview
          </Text>

          <Image
            source={{
              uri: selectedPhoto.uri,
            }}
            style={styles.preview}
            resizeMode="cover"
            accessibilityLabel="Selected restaurant photo"
          />

          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>
              Photo Submission
            </Text>

            <Text style={styles.note}>
              Upload only photos you own or have
              permission to share. Photos must
              belong to this restaurant.
            </Text>

            <Text style={styles.note}>
              Submitted photos may require review
              before appearing publicly.
            </Text>
          </View>

          <AppButton
            title={
              uploading
                ? "Uploading..."
                : "Submit for Review"
            }
            loading={uploading}
            disabled={uploading}
            onPress={submitPhoto}
            style={styles.submitButton}
          />

          <AppButton
            title="Cancel"
            variant="secondary"
            disabled={uploading}
            onPress={cancelPhoto}
            style={styles.cancelButton}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.md,
  },

  uploadArea: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.xxl,
    alignItems: "center",
  },

  uploadIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },

  uploadIconText: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "600",
    color: colors.primary,
  },

  title: {
    ...typography.section,
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.sm,
  },

  description: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
  },

  chooseButton: {
    marginTop: spacing.xl,
    alignSelf: "stretch",
  },

  previewContainer: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },

  previewTitle: {
    ...typography.section,
    color: colors.text,
    marginBottom: spacing.lg,
  },

  preview: {
    width: "100%",
    height: 220,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
  },

  notice: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    gap: spacing.sm,
  },

  noticeTitle: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.primary,
  },

  note: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  submitButton: {
    marginTop: spacing.xl,
  },

  cancelButton: {
    marginTop: spacing.md,
  },
});