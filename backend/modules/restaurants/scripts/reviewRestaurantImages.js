const fs = require("fs");
const path = require("path");

const {
    searchRestaurantImages
} = require("../services/restaurantImage.service");


// =====================================================
// 1. Helper Functions
// =====================================================

// Escape HTML special characters
function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}


// Validate URLs
function safeURL(value) {
    try {
        const url = new URL(value);

        const allowedHosts = [
            "commons.wikimedia.org",
            "upload.wikimedia.org",
            "thumb.wikimedia.org"
        ];

        if (
            url.protocol === "https:" &&
            allowedHosts.includes(url.hostname)
        ) {
            return url.href;
        }

        return "";

    } catch {
        return "";
    }
}


// Prevent embedded data from breaking the HTML script
function safeJSON(value) {
    return JSON.stringify(value)
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/&/g, "\\u0026")
        .replace(/\u2028/g, "\\u2028")
        .replace(/\u2029/g, "\\u2029");
}


// =====================================================
// 2. Generate Restaurant Image Review Page
// =====================================================

async function generateReviewPage() {

    try {

        // Restaurant information
        const restaurantName = "Tio's Tacos";
        const city = "Riverside California";

        console.log("Searching restaurant images...");

        // Search Wikimedia Commons
        const images = await searchRestaurantImages(
            restaurantName,
            city
        );

        console.log("Candidates found:", images.length);


        // =====================================================
        // 3. Prepare Review Data
        // =====================================================

        const reviewData = images.map((image, index) => ({
            id: index,

            title: image.title,

            imageUrl: safeURL(image.imageUrl),

            sourceUrl: safeURL(image.sourceUrl),

            author: image.author || "Unknown",

            license: image.license || "Unknown",

            licenseUrl: image.licenseUrl || null
        }));


        // =====================================================
        // 4. Generate Image Cards
        // =====================================================

        const cards = reviewData.map((image, index) => {

            const imageURL = escapeHTML(image.imageUrl);
            const sourceURL = escapeHTML(image.sourceUrl);
            const title = escapeHTML(image.title);
            const license = escapeHTML(image.license);
            const licenseURL = safeURL(image.licenseUrl);

            return `
                <div class="card" id="card-${index}">

                    <h2>Candidate ${index + 1}</h2>

                    ${
                        imageURL
                            ? `
                                <img
                                    src="${imageURL}"
                                    alt="Candidate ${index + 1}"
                                    loading="lazy"
                                >
                              `
                            : `
                                <div class="image-placeholder">
                                    Image unavailable
                                </div>
                              `
                    }

                    <div class="info">

                        <p>
                            <strong>Title:</strong>
                            ${title}
                        </p>

                        <p>
                            <strong>License:</strong>
                            ${license}
                        </p>

                        ${
                            sourceURL
                                ? `
                                    <p>
                                        <a
                                            href="${sourceURL}"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            View Original Image
                                        </a>
                                    </p>
                                  `
                                : ""
                        }

                        ${
                            licenseURL
                                ? `
                                    <p>
                                        <a
                                            href="${escapeHTML(licenseURL)}"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            View License
                                        </a>
                                    </p>
                                  `
                                : ""
                        }

                        <p class="warning">
                            Confirm the restaurant identity,
                            image content, and license
                            before approving.
                        </p>

                        <div class="review-actions">

                            <button
                                class="approve-btn"
                                onclick="approveImage(${index})"
                            >
                                Approve
                            </button>

                            <button
                                class="reject-btn"
                                onclick="rejectImage(${index})"
                            >
                                Reject
                            </button>

                            <button
                                class="pending-btn"
                                onclick="pendingImage(${index})"
                            >
                                Pending
                            </button>

                        </div>

                        <p
                            id="status-${index}"
                            class="review-status"
                        >
                            Pending
                        </p>

                    </div>

                </div>
            `;

        }).join("");


        // =====================================================
        // 5. Generate HTML
        // =====================================================

        const html = `
<!DOCTYPE html>
<html lang="en">

<head>

    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1"
    >

    <title>FoodMap Restaurant Image Review</title>

    <style>

        * {
            box-sizing: border-box;
        }

        body {
            font-family: Arial, sans-serif;
            background: #f5f5f5;
            margin: 0;
            padding: 30px;
        }

        h1 {
            text-align: center;
            margin-bottom: 10px;
        }

        .subtitle {
            text-align: center;
            color: #666;
            margin-bottom: 20px;
        }

        .summary {
            text-align: center;
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 20px;
        }

        .save-container {
            text-align: center;
            margin-bottom: 30px;
        }

        .save-btn {
            background: #1677d2;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 15px;
            cursor: pointer;
        }

        .save-btn:hover {
            background: #0958a5;
        }

        .container {
            display: grid;
            grid-template-columns:
                repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
            max-width: 1200px;
            margin: auto;
        }

        .card {
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 8px #00000015;
            border: 2px solid transparent;
        }

        .card h2 {
            padding: 0 16px;
            font-size: 20px;
        }

        .card img {
            width: 100%;
            height: 220px;
            object-fit: cover;
            background: #ddd;
        }

        .image-placeholder {
            width: 100%;
            height: 220px;
            display: flex;
            justify-content: center;
            align-items: center;
            background: #ddd;
            color: #888;
        }

        .info {
            padding: 16px;
        }

        .info p {
            overflow-wrap: anywhere;
        }

        a {
            color: #1677d2;
        }

        .warning {
            font-size: 12px;
            color: #777;
            margin-top: 15px;
            line-height: 1.5;
        }

        /* Review buttons */

        .review-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 20px;
        }

        .review-actions button {
            border: none;
            padding: 10px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
        }

        .approve-btn {
            background: #2e7d32;
            color: white;
        }

        .reject-btn {
            background: #c62828;
            color: white;
        }

        .pending-btn {
            background: #e0e0e0;
            color: #333;
        }

        .review-status {
            margin-top: 12px;
            font-size: 13px;
            font-weight: bold;
            text-transform: uppercase;
        }

        /* Review states */

        .card.approved {
            border-color: #2e7d32;
        }

        .card.rejected {
            border-color: #c62828;
            opacity: 0.7;
        }

        .card.pending {
            border-color: transparent;
        }

    </style>

</head>

<body>

    <h1 id="restaurant-name">
        ${escapeHTML(restaurantName)}
    </h1>

    <p class="subtitle">
        Restaurant Image Review —
        ${images.length} candidates
    </p>

    <p id="summary" class="summary">
        Approved: 0 |
        Rejected: 0 |
        Pending: ${images.length}
    </p>

    <div class="save-container">

        <button
            class="save-btn"
            onclick="saveReview()"
        >
            Save Review
        </button>

    </div>

    <div class="container">

        ${
            images.length
                ? cards
                : "<p>No candidate images found.</p>"
        }

    </div>


    <!-- ================================================= -->
    <!-- JavaScript Review Logic -->
    <!-- ================================================= -->

    <script>

        const restaurantName = ${safeJSON(restaurantName)};

        const city = ${safeJSON(city)};

        const images = ${safeJSON(reviewData)};

        // Initial review status
        const reviews = images.map(image => ({
            ...image,
            status: "pending"
        }));


        // =================================================
        // Update Review Status
        // =================================================

        function updateStatus(index, status) {

            reviews[index].status = status;

            const statusElement =
                document.getElementById("status-" + index);

            const card =
                document.getElementById("card-" + index);

            statusElement.textContent = status;

            card.classList.remove(
                "approved",
                "rejected",
                "pending"
            );

            card.classList.add(status);

            updateSummary();
        }


        // =================================================
        // Approve Image
        // =================================================

        function approveImage(index) {

            // Only one approved cover per restaurant
            reviews.forEach((review, i) => {

                if (
                    review.status === "approved" &&
                    i !== index
                ) {
                    updateStatus(i, "pending");
                }

            });

            updateStatus(index, "approved");
        }


        // =================================================
        // Reject Image
        // =================================================

        function rejectImage(index) {
            updateStatus(index, "rejected");
        }


        // =================================================
        // Set Image Back to Pending
        // =================================================

        function pendingImage(index) {
            updateStatus(index, "pending");
        }


        // =================================================
        // Update Summary
        // =================================================

        function updateSummary() {

            const approved = reviews.filter(
                review => review.status === "approved"
            ).length;

            const rejected = reviews.filter(
                review => review.status === "rejected"
            ).length;

            const pending = reviews.filter(
                review => review.status === "pending"
            ).length;

            document.getElementById(
                "summary"
            ).textContent =
                "Approved: " + approved +
                " | Rejected: " + rejected +
                " | Pending: " + pending;
        }


        // =================================================
        // Save Review as JSON
        // =================================================

        function saveReview() {

            const result = {

                restaurantName: restaurantName,

                city: city,

                reviewedAt:
                    new Date().toISOString(),

                images: reviews

            };

            const blob = new Blob(
                [JSON.stringify(result, null, 2)],
                {
                    type: "application/json"
                }
            );

            const url =
                URL.createObjectURL(blob);

            const link =
                document.createElement("a");

            link.href = url;

            link.download =
                "restaurant-image-review.json";

            document.body.appendChild(link);

            link.click();

            link.remove();

            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 1000);

        }

    </script>

</body>

</html>
        `;


        // =====================================================
        // 6. Save HTML File
        // =====================================================

        const outputPath = path.resolve(
            __dirname,
            "../../../image-review.html"
        );

        fs.writeFileSync(
            outputPath,
            html,
            "utf8"
        );

        console.log("Review page generated:");
        console.log(outputPath);

        console.log("Open the HTML file in your browser.");

    } catch (error) {

        console.error(
            "Review page failed:",
            error.message
        );

        process.exitCode = 1;
    }

}


// =====================================================
// 7. Run
// =====================================================

generateReviewPage();