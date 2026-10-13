const API_BASE_URL = "http://localhost:3000";

export async function getRestaurants() {
  const response = await fetch(`${API_BASE_URL}/api/restaurants`);

  if (!response.ok) {
    throw new Error("Failed to fetch restaurants");
  }

  const data = await response.json();

  return data;
}