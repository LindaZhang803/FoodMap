const fs = require("fs");
const path = require("path");

// =====================================================
// 1. File Paths
// =====================================================

const inputPath = path.resolve(
    __dirname,
    "../../../../data/image-reviews/batch-image-candidates.json"
);

const outputPath = path.resolve(
    __dirname,
    "../../../batch-image-review.html"
);

// =====================================================
// 2. Helper Functions
// =====================================================

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

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

function safeJSON(value) {
    return JSON.stringify(value)
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/&/g, "\\u0026")
        .replace(/\u2028/g, "\\u2028")
        .replace(/\u2029/g, "\\u2029");
}

// =====================================================
// 3. Generate Review Page
// =====================================================

function generateBatchReviewPage() {
    try {
        // Read existing candidate data
        const data = JSON.parse(
            fs.readFileSync(inputPath, "utf8")
        );

        if (!Array.isArray(data.restaurants)) {
            throw new Error("Invalid batch candidate data");
        }

        console.log(
            "Restaurants found:",
            data.restaurants.length
        );

        // Normalize candidate data
        const restaurants = data.restaurants.map(item => ({
            restaurant: {
                mongoId: String(item.restaurant.mongoId || ""),
                osmId: String(item.restaurant.osmId || ""),
                osmType: item.restaurant.osmType,
                name: item.restaurant.name,
                address: item.restaurant.address || "",
                latitude: item.restaurant.latitude,
                longitude: item.restaurant.longitude
            },

            images: (item.images || []).map(image => ({
                title: image.title,
                imageUrl: safeURL(image.imageUrl),
                sourceUrl: safeURL(image.sourceUrl),
                author: image.author || "Unknown",
                license: image.license || "Unknown",
                licenseUrl: image.licenseUrl || null,
                status: "pending"
            }))
        }));

        // =================================================
        // 4. Generate Restaurant Sections
        // =================================================

        const sections = restaurants.map((item, restaurantIndex) => {

            const restaurant = item.restaurant;

            const cards = item.images.map((image, imageIndex) => {

                const imageURL = escapeHTML(image.imageUrl);
                const sourceURL = escapeHTML(image.sourceUrl);

                let licenseLink = "";

                try {
                    const url = new URL(image.licenseUrl);

                    if (
                        url.protocol === "https:" &&
                        [
                            "creativecommons.org",
                            "www.creativecommons.org",
                            "commons.wikimedia.org"
                        ].includes(url.hostname)
                    ) {
                        licenseLink = url.href;
                    }
                } catch {
                    // No valid license URL
                }

                return `
                    <div
                        class="card"
                        id="card-${restaurantIndex}-${imageIndex}"
                    >

                        <h3>Candidate ${imageIndex + 1}</h3>

                        ${
                            imageURL
                                ? `
                                    <img
                                        src="${imageURL}"
                                        alt="Candidate image"
                                        loading="lazy"
                                    >
                                  `
                                : `
                                    <div class="placeholder">
                                        Image unavailable
                                    </div>
                                  `
                        }

                        <div class="card-info">

                            <p>
                                <strong>Title:</strong>
                                ${escapeHTML(image.title)}
                            </p>

                            <p>
                                <strong>License:</strong>
                                ${escapeHTML(image.license)}
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
                                licenseLink
                                    ? `
                                        <p>
                                            <a
                                                href="${escapeHTML(licenseLink)}"
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
                                Confirm restaurant identity,
                                photo content, and license
                                before approving.
                            </p>

                            <div class="actions">

                                <button
                                    class="approve"
                                    data-restaurant="${restaurantIndex}"
                                    data-image="${imageIndex}"
                                    data-status="approved"
                                >
                                    Approve
                                </button>

                                <button
                                    class="reject"
                                    data-restaurant="${restaurantIndex}"
                                    data-image="${imageIndex}"
                                    data-status="rejected"
                                >
                                    Reject
                                </button>

                                <button
                                    class="pending"
                                    data-restaurant="${restaurantIndex}"
                                    data-image="${imageIndex}"
                                    data-status="pending"
                                >
                                    Pending
                                </button>

                            </div>

                            <p
                                class="status"
                                id="status-${restaurantIndex}-${imageIndex}"
                            >
                                PENDING
                            </p>

                        </div>

                    </div>
                `;
            }).join("");

            return `
                <section class="restaurant-section">

                    <div class="restaurant-header">

                        <h2>
                            ${restaurantIndex + 1}.
                            ${escapeHTML(restaurant.name)}
                        </h2>

                        <p>
                            <strong>Address:</strong>
                            ${escapeHTML(restaurant.address || "Unavailable")}
                        </p>

                        <p>
                            <strong>OSM:</strong>
                            ${escapeHTML(restaurant.osmType)}
                            /
                            ${escapeHTML(restaurant.osmId)}
                        </p>

                        <p>
                            <strong>Coordinates:</strong>
                            ${escapeHTML(restaurant.latitude)},
                            ${escapeHTML(restaurant.longitude)}
                        </p>

                        <p>
                            <strong>Candidates:</strong>
                            ${item.images.length}
                        </p>

                    </div>

                    <div class="image-grid">

                        ${
                            item.images.length
                                ? cards
                                : `
                                    <p class="empty">
                                        No candidate images found.
                                    </p>
                                  `
                        }

                    </div>

                </section>
            `;
        }).join("");

        // =================================================
        // 5. Generate HTML
        // =================================================

        const html = `
<!DOCTYPE html>
<html lang="en">

<head>

    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1"
    >

    <title>FoodMap Batch Image Review</title>

    <style>

        * {
            box-sizing: border-box;
        }

        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 30px;
            background: #f5f5f5;
        }

        h1 {
            text-align: center;
            margin-bottom: 10px;
        }

        .subtitle {
            text-align: center;
            color: #666;
        }

        .summary {
            text-align: center;
            font-weight: bold;
            margin: 20px 0;
        }

        .toolbar {
            text-align: center;
            margin-bottom: 35px;
        }

        .save-button {
            background: #1677d2;
            color: white;
            border: none;
            padding: 12px 25px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 15px;
        }

        .restaurant-section {
            max-width: 1300px;
            margin: 30px auto;
            padding: 25px;
            background: #fff;
            border-radius: 14px;
        }

        .restaurant-header {
            border-bottom: 1px solid #ddd;
            margin-bottom: 20px;
            padding-bottom: 12px;
        }

        .restaurant-header h2 {
            margin-top: 0;
        }

        .restaurant-header p {
            color: #555;
            font-size: 14px;
        }

        .image-grid {
            display: grid;
            grid-template-columns:
                repeat(auto-fill, minmax(250px, 1fr));
            gap: 18px;
        }

        .card {
            border: 2px solid #eee;
            border-radius: 10px;
            overflow: hidden;
            background: #fff;
        }

        .card h3 {
            padding: 0 14px;
        }

        .card img {
            width: 100%;
            height: 200px;
            object-fit: cover;
            background: #eee;
        }

        .placeholder {
            height: 200px;
            background: #e5e5e5;
            display: flex;
            justify-content: center;
            align-items: center;
            color: #888;
        }

        .card-info {
            padding: 14px;
        }

        .card-info p {
            overflow-wrap: anywhere;
        }

        .warning {
            color: #777;
            font-size: 12px;
            line-height: 1.5;
        }

        .actions {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-top: 15px;
        }

        .actions button {
            border: none;
            border-radius: 6px;
            padding: 9px 12px;
            cursor: pointer;
            font-weight: bold;
        }

        .approve {
            background: #2e7d32;
            color: white;
        }

        .reject {
            background: #c62828;
            color: white;
        }

        .pending {
            background: #ddd;
            color: #333;
        }

        .status {
            font-size: 12px;
            font-weight: bold;
        }

        .card.approved {
            border-color: #2e7d32;
        }

        .card.rejected {
            border-color: #c62828;
            opacity: 0.65;
        }

        .empty {
            padding: 25px;
            color: #888;
        }

    </style>

</head>

<body>

    <h1>FoodMap — Batch Restaurant Image Review</h1>

    <p class="subtitle">
        ${restaurants.length} restaurants
    </p>

    <p id="summary" class="summary"></p>

    <div class="toolbar">

        <button
            class="save-button"
            id="save-review"
        >
            Save Review
        </button>

        <p id="storage-status"></p>

    </div>

    ${sections}

    <script>

        // =============================================
        // Review Data
        // =============================================

        const restaurants = ${safeJSON(restaurants)};

        // Key includes the candidate batch timestamp.
        // This prevents an old review from being applied
        // to a newly generated candidate batch.
        const storageKey = ${safeJSON(
            "foodmap-review-" + (data.generatedAt || "unknown")
        )};

        const validStatuses = [
            "approved",
            "rejected",
            "pending"
        ];

        // =============================================
        // Local Storage
        // =============================================

        function saveProgress() {

            try {

                const statuses = restaurants.map(item => ({
                    osmType: item.restaurant.osmType,
                    osmId: item.restaurant.osmId,
                    statuses: item.images.map(image => image.status)
                }));

                localStorage.setItem(
                    storageKey,
                    JSON.stringify(statuses)
                );

                document.getElementById(
                    "storage-status"
                ).textContent = "Progress saved locally.";

            } catch (error) {

                document.getElementById(
                    "storage-status"
                ).textContent =
                    "Local storage unavailable. Export JSON to save.";

            }
        }

        function loadProgress() {

            try {

                const saved = JSON.parse(
                    localStorage.getItem(storageKey) || "null"
                );

                if (!Array.isArray(saved)) {
                    return;
                }

                restaurants.forEach(item => {

                    const matching = saved.find(entry =>
                        entry.osmType === item.restaurant.osmType &&
                        entry.osmId === item.restaurant.osmId
                    );

                    if (!matching ||
                        !Array.isArray(matching.statuses) ||
                        matching.statuses.length !== item.images.length) {
                        return;
                    }

                    matching.statuses.forEach((status, index) => {
                        if (validStatuses.includes(status)) {
                            item.images[index].status = status;
                        }
                    });

                    // Restore at most one approval per restaurant
                    let approvedSeen = false;

                    item.images.forEach(image => {
                        if (image.status === "approved") {
                            if (approvedSeen) {
                                image.status = "pending";
                            }
                            approvedSeen = true;
                        }
                    });
                });

            } catch (error) {
                console.warn("Could not restore progress.");
            }
        }

        // =============================================
        // Review Actions
        // =============================================

        function updateStatus(restaurantIndex, imageIndex, status) {

            const item = restaurants[restaurantIndex];

            if (!item ||
                !item.images[imageIndex] ||
                !validStatuses.includes(status)) {
                return;
            }

            // Each restaurant has at most one approved cover
            if (status === "approved") {

                item.images.forEach((image, index) => {

                    if (index !== imageIndex &&
                        image.status === "approved") {
                        image.status = "pending";
                    }
                });
            }

            item.images[imageIndex].status = status;

            renderStatuses();
            saveProgress();
        }

        // =============================================
        // Render Current Status
        // =============================================

        function renderStatuses() {

            let approved = 0;
            let rejected = 0;
            let pending = 0;

            restaurants.forEach((item, rIndex) => {

                item.images.forEach((image, iIndex) => {

                    const card = document.getElementById(
                        "card-" + rIndex + "-" + iIndex
                    );

                    const label = document.getElementById(
                        "status-" + rIndex + "-" + iIndex
                    );

                    card.classList.remove(
                        "approved",
                        "rejected"
                    );

                    card.classList.add(image.status);

                    label.textContent =
                        image.status.toUpperCase();

                    if (image.status === "approved") {
                        approved++;
                    } else if (image.status === "rejected") {
                        rejected++;
                    } else {
                        pending++;
                    }
                });
            });

            document.getElementById(
                "summary"
            ).textContent =
                "Approved: " + approved +
                " | Rejected: " + rejected +
                " | Pending: " + pending;
        }

        // =============================================
        // Export Review JSON
        // =============================================

        function saveReview() {

            const result = {
                generatedAt: new Date().toISOString(),
                sourceGeneratedAt: ${safeJSON(
                    data.generatedAt || null
                )},
                totalRestaurants: restaurants.length,
                restaurants: restaurants
            };

            const blob = new Blob(
                [JSON.stringify(result, null, 2)],
                { type: "application/json" }
            );

            const url = URL.createObjectURL(blob);

            const link = document.createElement("a");

            link.href = url;
            link.download = "batch-image-review.json";

            document.body.appendChild(link);
            link.click();
            link.remove();

            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 1000);
        }

        // =============================================
        // Event Listeners
        // =============================================

        document.addEventListener("click", event => {

            const button = event.target.closest(
                "button[data-status]"
            );

            if (!button) {
                return;
            }

            updateStatus(
                Number(button.dataset.restaurant),
                Number(button.dataset.image),
                button.dataset.status
            );
        });

        document.getElementById(
            "save-review"
        ).addEventListener("click", saveReview);

        // =============================================
        // Initialize
        // =============================================

        loadProgress();
        renderStatuses();

    </script>

</body>
</html>
        `;

        // =================================================
        // 6. Write HTML
        // =================================================

        fs.writeFileSync(outputPath, html, "utf8");

        console.log("Batch review page generated:");
        console.log(outputPath);

        const totalCandidates = restaurants.reduce(
            (total, item) => total + item.images.length,
            0
        );

        console.log("Total candidates:", totalCandidates);

    } catch (error) {

        console.error(
            "Batch review generation failed:",
            error.message
        );

        process.exitCode = 1;
    }
}

generateBatchReviewPage();