import {
  API_ORIGIN,
} from "../../../config/api";

// =====================================================
// API Configuration
// =====================================================

const POSTS_PATH = "/api/posts";

function getOrigin() {
  return String(API_ORIGIN || "").replace(/\/+$/, "");
}

export function resolvePostImageUrl(value) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return null;
  }

  try {
    const url = new URL(
      value.trim(),
      getOrigin()
    );

    if (
      !["http:", "https:"].includes(url.protocol)
    ) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

// =====================================================
// Request Helper
// =====================================================

async function request(
  path,
  {
    method = "GET",
    token,
    body,
    signal,
  } = {}
) {
  const headers = {
    Accept: "application/json",
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (
    typeof token === "string" &&
    token.trim()
  ) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(
      `${getOrigin()}${path}`,
      {
        method,
        headers,
        body:
          body === undefined
            ? undefined
            : JSON.stringify(body),
        signal,
      }
    );
  } catch (error) {
    if (error?.name === "AbortError") {
      throw error;
    }

    throw new Error(
      "Unable to connect to the server."
    );
  }

  if (response.status === 204) {
    return null;
  }

  const payload = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    const error = new Error(
      payload?.message ||
        `Request failed (${response.status}).`
    );

    error.status = response.status;

    throw error;
  }

  return payload;
}

// =====================================================
// Public Post Feed
// =====================================================

export async function getPosts({
  category = "forYou",
  limit = 12,
  cursor = null,
  latitude,
  longitude,
  token,
  signal,
} = {}) {
  const params = new URLSearchParams();

  params.set("category", category);
  params.set("limit", String(limit));

  if (cursor) {
    params.set("cursor", cursor);
  }

  if (category === "nearby") {
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      throw new Error(
        "Location is required for Nearby."
      );
    }

    params.set("latitude", String(latitude));
    params.set("longitude", String(longitude));
  }

  const payload = await request(
    `${POSTS_PATH}?${params.toString()}`,
    {
      token,
      signal,
    }
  );

  if (
    !payload ||
    !Array.isArray(payload.items)
  ) {
    throw new Error(
      "Invalid post feed response."
    );
  }

  return {
    items: payload.items,
    nextCursor: payload.nextCursor || null,
    hasMore: Boolean(payload.hasMore),
  };
}

// =====================================================
// Post Details
// =====================================================

export async function getPost(
  postId,
  {
    token,
    signal,
  } = {}
) {
  const payload = await request(
    `${POSTS_PATH}/${encodeURIComponent(postId)}`,
    {
      token,
      signal,
    }
  );

  if (!payload?.post) {
    throw new Error(
      "Invalid post response."
    );
  }

  return payload.post;
}

// =====================================================
// Publish Post
// =====================================================

export async function createPost(
  {
    reviewId,
    title,
    caption = "",
  },
  token
) {
  if (!token) {
    throw new Error(
      "Sign in to publish a post."
    );
  }

  const payload = await request(
    POSTS_PATH,
    {
      method: "POST",
      token,
      body: {
        reviewId,
        title,
        caption,
      },
    }
  );

  return payload.post;
}

// =====================================================
// Like / Unlike
// =====================================================

export async function setPostLike(
  postId,
  liked,
  token
) {
  if (!token) {
    throw new Error(
      "Sign in to like posts."
    );
  }

  return request(
    `${POSTS_PATH}/${encodeURIComponent(postId)}/like`,
    {
      method: liked ? "PUT" : "DELETE",
      token,
    }
  );
}

// =====================================================
// Delete Post
// =====================================================

export async function deletePost(
  postId,
  token
) {
  if (!token) {
    throw new Error(
      "Sign in to delete posts."
    );
  }

  return request(
    `${POSTS_PATH}/${encodeURIComponent(postId)}`,
    {
      method: "DELETE",
      token,
    }
  );
}

// =====================================================
// Post Social Data
// =====================================================

export async function getPostSocial(
  postId,
  { token, signal } = {}
) {
  return request(
    `${POSTS_PATH}/${encodeURIComponent(postId)}/social`,
    { token, signal }
  );
}

// =====================================================
// Favorite / Unfavorite
// =====================================================

export async function setPostFavorite({
  postId,
  saved,
  token,
}) {
  return request(
    `${POSTS_PATH}/${encodeURIComponent(postId)}/favorite`,
    {
      method: saved ? "PUT" : "DELETE",
      token,
    }
  );
}

// =====================================================
// Create Comment
// =====================================================

export async function createPostComment({
  postId,
  content,
  token,
}) {
  return request(
    `${POSTS_PATH}/${encodeURIComponent(postId)}/comments`,
    {
      method: "POST",
      token,
      body: { content },
    }
  );
}