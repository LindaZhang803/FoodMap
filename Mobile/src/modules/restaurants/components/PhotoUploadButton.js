import React, { useState } from "react";

import {
  View,
  Text,
  Image,
  Alert,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";

import * as ImagePicker from "expo-image-picker";
import { uploadRestaurantPhoto } from "../services/photoApi";

export default function PhotoUploadButton({ restaurantId }) {
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [uploading, setUploading] = useState(false);

  // 1. Select an image from the phone
  async function selectPhoto() {
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

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.length > 0) {
        setSelectedPhoto(result.assets[0]);
      }
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  }

  // 2. Upload selected image
  async function submitPhoto() {
    if (!selectedPhoto || uploading) {
      return;
    }

    if (!restaurantId) {
      Alert.alert("Error", "Restaurant ID is missing.");
      return;
    }

    try {
      setUploading(true);

      const result = await uploadRestaurantPhoto(
        restaurantId,
        selectedPhoto
      );

      if (result.status === "pending") {
        Alert.alert(
          "Upload Successful",
          "Your photo has been submitted for review."
        );

        setSelectedPhoto(null);
      } else {
        Alert.alert("Success", "Photo uploaded successfully.");
        setSelectedPhoto(null);
      }
    } catch (error) {
      Alert.alert(
        "Upload Failed",
        error.message || "Please try again."
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.selectButton}
        onPress={selectPhoto}
        disabled={uploading}
      >
        <Text style={styles.selectButtonText}>
          Upload Photo
        </Text>
      </Pressable>

      {selectedPhoto && (
        <View style={styles.previewContainer}>
          <Image
            source={{ uri: selectedPhoto.uri }}
            style={styles.preview}
            resizeMode="cover"
          />

          <Text style={styles.note}>
            Please upload only photos you own or have permission
            to share. Photos must belong to this restaurant.
          </Text>

          <Pressable
            style={[
              styles.submitButton,
              uploading && styles.disabledButton,
            ]}
            onPress={submitPhoto}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>
                Submit for Review
              </Text>
            )}
          </Pressable>

          <Pressable
            style={styles.cancelButton}
            onPress={() => setSelectedPhoto(null)}
            disabled={uploading}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
  },

  selectButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: "center",
  },

  selectButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },

  previewContainer: {
    marginTop: 16,
  },

  preview: {
    width: "100%",
    height: 220,
    borderRadius: 10,
  },

  note: {
    fontSize: 12,
    color: "#777",
    marginTop: 10,
    lineHeight: 18,
  },

  submitButton: {
    backgroundColor: "#16a34a",
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 12,
  },

  disabledButton: {
    opacity: 0.6,
  },

  submitButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },

  cancelButton: {
    paddingVertical: 12,
    alignItems: "center",
  },

  cancelText: {
    color: "#777",
    fontSize: 14,
  },
});