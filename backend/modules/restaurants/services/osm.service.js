function convertOSMToRestaurant(feature) {
    const properties = feature.properties || {};
    const geometry = feature.geometry;

    // 1. Only accept restaurant records
    if (properties.amenity !== "restaurant") {
        return null;
    }

    // 2. Check restaurant name
    if (!properties.name || !properties.name.trim()) {
        return null;
    }

    // 3. Validate OSM identification
    if (
        !["node", "way", "relation"].includes(properties["@type"]) ||
        properties["@id"] == null
    ) {
        return null;
    }

    // 4. Extract coordinates
    if (!geometry || geometry.type !== "Point") {
        return null;
    }

    const [longitude, latitude] = geometry.coordinates || [];

    if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
    ) {
        return null;
    }

    // 5. Build restaurant address
    const address = [
        properties["addr:housenumber"],
        properties["addr:street"],
        properties["addr:city"],
        properties["addr:state"]
    ].filter(Boolean).join(" ");

    // 6. Return FoodMap restaurant data
    return {
        name: properties.name.trim(),
        description: "",
        address: address,
        latitude: latitude,
        longitude: longitude,
        cuisineType: properties.cuisine || "Unknown",
        priceRange: null,
        rating: null,
        reviewCount: 0,
        imageUrl: null,
        openingHours: properties.opening_hours || "",
        osmId: String(properties["@id"]),
        osmType: properties["@type"],
        dataSource: "osm"
    };
}

module.exports = {
    convertOSMToRestaurant
};