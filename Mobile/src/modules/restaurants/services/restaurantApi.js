import { API_ORIGIN } from "../../../config/api";

export async function getRestaurants({ searchQuery = '', filters = {}, sortBy = 'default', userLocation = null, signal } = {}) {
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    for (const key of ['cuisine', 'minPrice', 'maxPrice', 'minRating']) {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') params.set(key, String(filters[key]));
    }
    const sort = { rating: 'highestRated', nearest: 'distance' }[sortBy] || sortBy;
    if (sort !== 'default') params.set('sort', sort);
    const distance = filters.customDistance !== '' && filters.customDistance != null ? filters.customDistance : filters.distance;
    if (distance != null) params.set('maxDistance', String(distance));
    if (userLocation && (distance != null || sort === 'distance')) {
        params.set('latitude', String(userLocation.latitude));
        params.set('longitude', String(userLocation.longitude));
    }
    const query = params.toString();
    const response = await fetch(
        `${API_ORIGIN}/api/restaurants${query ? '?' + query : ''}`,
        { signal }
    );

    if (!response.ok) {
        throw new Error("Failed to fetch restaurants");
    }

    const data = await response.json();

    return data;
}
