const fs = require("fs");
const path = require("path");

const {
    convertOSMToRestaurant
} = require("../services/osm.service");

const filePath = path.resolve(
    __dirname,
    "../../../../data/riverside-restaurants-with-id.geojson"
);

const data = JSON.parse(
    fs.readFileSync(filePath, "utf8")
);

const restaurants = data.features
    .map(convertOSMToRestaurant)
    .filter(Boolean);

console.log("Total features:", data.features.length);
console.log("Valid restaurants:", restaurants.length);

console.log(
    "First restaurant:",
    JSON.stringify(restaurants[0], null, 2)
);

// Check duplicate OSM IDs
const ids = restaurants.map(
    restaurant => `${restaurant.osmType}/${restaurant.osmId}`
);

const uniqueIds = new Set(ids);

console.log("Total valid restaurants:", restaurants.length);
console.log("Unique restaurants:", uniqueIds.size);
console.log("Duplicate records:", ids.length - uniqueIds.size);