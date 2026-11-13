import { File } from "expo-file-system";

const API_BASE_URL = "http://127.0.0.1:3000";
const REQUEST_TIMEOUT_MS = 15000;
const AVATAR_TIMEOUT_MS = 30000;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const AVATAR_PATH_PATTERN = /^\/uploads\/avatars\/[a-f0-9]{24}-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.jpg$/;

const IMAGE_EXTENSIONS = Object.freeze({
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
});

const IMAGE_MIME_TYPES = Object.freeze({
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp"
});

export class ApiError extends Error {
    constructor(message, status = 0) {
        super(message);
        this.name = "ApiError";
        this.status = status;
    }
}

function getErrorMessage(result) {
    const errors = Array.isArray(result?.errors)
        ? result.errors
            .filter(item => typeof item === "string")
            .join(", ")
        : "";

    return errors || (
        typeof result?.message === "string"
            ? result.message
            : "The request failed. Please try again."
    );
}

async function readResponse(response, signal) {
    try {
        return await response.json();
    } catch (error) {
        if (signal.aborted) {
            throw error;
        }

        return null;
    }
}

async function request(path, {
    method = "GET",
    data,
    token,
    formData,
    timeoutMs = REQUEST_TIMEOUT_MS
} = {}) {
    const controller = new AbortController();

    const timeoutId = setTimeout(
        () => controller.abort(),
        timeoutMs
    );

    const isMultipart = formData !== undefined;

    try {
        const response = await fetch(API_BASE_URL + path, {
            method,
            headers: {
                Accept: "application/json",
                ...(isMultipart
                    ? {}
                    : { "Content-Type": "application/json" }),
                ...(token
                    ? { Authorization: "Bearer " + token }
                    : {})
            },
            ...(isMultipart
                ? { body: formData }
                : data === undefined
                    ? {}
                    : { body: JSON.stringify(data) }),
            signal: controller.signal
        });

        const result = await readResponse(
            response,
            controller.signal
        );

        if (!response.ok) {
            throw new ApiError(
                getErrorMessage(result),
                response.status
            );
        }

        return result;
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }

        throw new ApiError(
            controller.signal.aborted
                ? "The request timed out. Please try again."
                : "Could not connect to the server. Please try again."
        );
    } finally {
        clearTimeout(timeoutId);
    }
}

function readProfileImage(profileImage) {
    if (typeof profileImage !== "string") {
        return "";
    }

    const value = profileImage.trim();
    const match = AVATAR_PATH_PATTERN.exec(value);

    if (match && match[0] === value) {
        return API_BASE_URL + value;
    }

    return /^https?:\/\/[^\s/?#]+(?:[/?#][^\s]*)?$/i.test(value)
        ? value
        : "";
}

function readUser(user) {
    if (
        !user ||
        typeof user.id !== "string" ||
        !user.id.trim() ||
        typeof user.username !== "string" ||
        typeof user.email !== "string"
    ) {
        throw new ApiError(
            "Server returned invalid user information."
        );
    }

    return {
        ...user,
        bio: typeof user.bio === "string" ? user.bio : "",
        profileImage: readProfileImage(user.profileImage),
        favoriteCuisines: Array.isArray(user.favoriteCuisines)
            ? user.favoriteCuisines.filter(
                item => typeof item === "string"
            )
            : [],
        foodPreferences: Array.isArray(user.foodPreferences)
            ? user.foodPreferences.filter(
                item => typeof item === "string"
            )
            : []
    };
}

function readAvatarFile(asset) {
    if (
        !asset ||
        typeof asset.uri !== "string" ||
        !/^(file|content):\/\/[^\s]+$/i.test(asset.uri)
    ) {
        throw new ApiError(
            "Please choose an image from your photo library."
        );
    }

    if (
        asset.fileSize !== undefined &&
        (!Number.isFinite(asset.fileSize) || asset.fileSize <= 0)
    ) {
        throw new ApiError(
            "The selected image is empty or invalid."
        );
    }

    if (asset.fileSize > MAX_AVATAR_BYTES) {
        throw new ApiError(
            "Please choose an image no larger than 5 MB.",
            413
        );
    }

    const extension = /\.([a-z0-9]+)$/i
        .exec(asset.uri.split(/[?#]/)[0])?.[1]
        ?.toLowerCase();

    const mimeType = (
        typeof asset.mimeType === "string"
            ? asset.mimeType.trim().toLowerCase()
            : ""
    ) || IMAGE_MIME_TYPES[extension];

    if (
        !Object.prototype.hasOwnProperty.call(
            IMAGE_EXTENSIONS,
            mimeType
        )
    ) {
        throw new ApiError(
            "Please choose a JPEG, PNG, or WebP image.",
            415
        );
    }

    let file;
    let actualSize;
    let actualType;

    try {
        file = new File(asset.uri);
        actualSize = file.size;
        actualType = file.type;

        if (
            !file.exists ||
            !Number.isFinite(actualSize) ||
            actualSize <= 0
        ) {
            throw new Error("Selected image is unavailable.");
        }
    } catch {
        throw new ApiError(
            "Could not read the selected photo. Please choose it again."
        );
    }

    if (actualSize > MAX_AVATAR_BYTES) {
        throw new ApiError(
            "Please choose an image no larger than 5 MB.",
            413
        );
    }

    if (
        typeof actualType !== "string" ||
        !Object.prototype.hasOwnProperty.call(
            IMAGE_EXTENSIONS,
            actualType.trim().toLowerCase()
        )
    ) {
        throw new ApiError(
            "Please choose a JPEG, PNG, or WebP photo.",
            415
        );
    }

    return file;
}

export async function registerUser(data) {
    const result = await request("/api/auth/register", {
        method: "POST",
        data
    });

    return {
        ...result,
        user: readUser(result?.user)
    };
}

export async function loginUser(data) {
    const result = await request("/api/auth/login", {
        method: "POST",
        data
    });

    if (
        typeof result?.token !== "string" ||
        !result.token.trim()
    ) {
        throw new ApiError(
            "Server returned an invalid login response."
        );
    }

    return {
        ...result,
        user: readUser(result.user)
    };
}

export async function getMyProfile(token) {
    const result = await request("/api/users/me", {
        token
    });

    return {
        ...result,
        user: readUser(result?.user)
    };
}

export async function updateMyProfile(token, data) {
    const result = await request("/api/users/me", {
        method: "PUT",
        token,
        data
    });

    return {
        ...result,
        user: readUser(result?.user)
    };
}

export async function uploadMyAvatar(token, asset) {
    if (typeof token !== "string" || !token.trim()) {
        throw new ApiError(
            "Please log in again.",
            401
        );
    }

    const file = readAvatarFile(asset);
    const formData = new FormData();

    formData.append("avatar", file);

    const result = await request("/api/users/me/avatar", {
        method: "POST",
        token,
        formData,
        timeoutMs: AVATAR_TIMEOUT_MS
    });

    const user = readUser(result?.user);

    if (!user.profileImage) {
        throw new ApiError(
            "Server returned an invalid avatar response."
        );
    }

    return {
        ...result,
        user
    };
}

export async function getMyReviews(token, page = 1) {
    if (typeof token !== "string" || !token.trim()) {
        throw new ApiError(
            "Please log in again.",
            401
        );
    }

    if (
        !Number.isSafeInteger(page) ||
        page < 1 ||
        page > 10000
    ) {
        throw new ApiError("Invalid page.");
    }

    const result = await request(
        "/api/reviews/mine?page=" + page,
        { token }
    );

    const pagination = result?.pagination;

    if (
        !Array.isArray(result?.reviews) ||
        !pagination ||
        pagination.page !== page ||
        pagination.limit !== 20 ||
        !Number.isSafeInteger(pagination.total) ||
        pagination.total < 0 ||
        result.reviews.length > pagination.limit
    ) {
        throw new ApiError(
            "Server returned invalid review information."
        );
    }

    const reviews = result.reviews.map(review => {
        if (
            !review ||
            typeof review.id !== "string" ||
            !review.id.trim() ||
            typeof review.comment !== "string" ||
            !Number.isInteger(review.rating) ||
            review.rating < 1 ||
            review.rating > 5 ||
            !["restaurant", "dish"].includes(review.reviewType)
        ) {
            throw new ApiError(
                "Server returned invalid review information."
            );
        }

        return {
            id: review.id,
            restaurantId: typeof review.restaurantId === "string"
                ? review.restaurantId
                : "",
            dishId: typeof review.dishId === "string"
                ? review.dishId
                : null,
            reviewType: review.reviewType,
            rating: review.rating,
            comment: review.comment,
            createdAt: typeof review.createdAt === "string"
                ? review.createdAt
                : ""
        };
    });

    return {
        reviews,
        pagination: {
            page: pagination.page,
            limit: pagination.limit,
            total: pagination.total
        }
    };
}

export async function logoutUser(token) {
    await request("/api/auth/logout", {
        method: "POST",
        token
    });
}
