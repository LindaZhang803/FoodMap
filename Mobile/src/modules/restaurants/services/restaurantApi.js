import { API_ORIGIN } from "../../../config/api";

export async function getRestaurants() {
    const response = await fetch(
        `${API_ORIGIN}/api/restaurants`
    );

    if (!response.ok) {
        throw new Error("Failed to fetch restaurants");
    }

    const data = await response.json();

    return data;
}