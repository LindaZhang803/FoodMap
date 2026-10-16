import { File } from "expo-file-system";

import { API_ORIGIN } from "../../../config/api";

export async function uploadRestaurantPhoto(restaurantId, asset) {
  if (!restaurantId) {
    throw new Error("Restaurant ID is missing");
  }

  if (!asset?.uri) {
    throw new Error("No photo selected");
  }

  const formData = new FormData();

  const file = new File(asset.uri);

  formData.append("photo", file);

  const response = await fetch(
    `${API_ORIGIN}/api/restaurants/${restaurantId}/photos`,
    {
      method: "POST",
      body: formData,
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Photo upload failed");
  }

  return result;
}