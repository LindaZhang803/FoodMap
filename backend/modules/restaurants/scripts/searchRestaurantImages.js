const {
    searchRestaurantImages
} = require("../services/restaurantImage.service");

async function main() {
    try {
        const images = await searchRestaurantImages(
            "Tio's Tacos",
            "Riverside California"
        );

        console.log("Candidates found:", images.length);

        images.forEach((image, index) => {
            console.log(`\nCandidate ${index + 1}`);
            console.log("Title:", image.title);
            console.log("Image:", image.imageUrl);
            console.log("Source:", image.sourceUrl);
            console.log("License:", image.license);
        });

    } catch (error) {
        console.error("Image search failed:", error.message);
        process.exitCode = 1;
    }
}

main();