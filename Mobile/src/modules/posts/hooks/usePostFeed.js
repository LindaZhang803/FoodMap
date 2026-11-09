import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  getPosts,
} from "../services/postApi";

// =====================================================
// Merge Posts Without Duplicates
// =====================================================

function mergePosts(previous, incoming) {
  const map = new Map();

  for (const post of previous) {
    map.set(post.id, post);
  }

  for (const post of incoming) {
    map.set(post.id, post);
  }

  return [...map.values()];
}

// =====================================================
// Post Feed Hook
// =====================================================

export default function usePostFeed({
  token = null,
  pageSize = 12,
} = {}) {
  const [category, setCategory] =
    useState("forYou");

  const [location, setLocation] =
    useState(null);

  const [posts, setPosts] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [loadingMore, setLoadingMore] =
    useState(false);

  const [error, setError] =
    useState(null);

  const [nextCursor, setNextCursor] =
    useState(null);

  const [hasMore, setHasMore] =
    useState(false);

  const generation = useRef(0);
  const mounted = useRef(true);
  const activeController = useRef(null);
  const paginationBusy = useRef(false);

  // =====================================================
  // Lifecycle
  // =====================================================

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      generation.current += 1;

      activeController.current?.abort();
    };
  }, []);

  // =====================================================
  // Read Feed
  // =====================================================

  const readFirstPage = useCallback(
    async (isRefresh = false) => {
      const currentGeneration =
        ++generation.current;

      activeController.current?.abort();

      const controller =
        new AbortController();

      activeController.current = controller;

      paginationBusy.current = false;

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setLoadingMore(false);
      setError(null);

      try {
        if (
          category === "nearby" &&
          !location
        ) {
          setPosts([]);
          setHasMore(false);
          setNextCursor(null);
          return;
        }

        const result = await getPosts({
          category,
          limit: pageSize,
          token,
          latitude: location?.latitude,
          longitude: location?.longitude,
          signal: controller.signal,
        });

        if (
          !mounted.current ||
          currentGeneration !==
            generation.current
        ) {
          return;
        }

        setPosts(result.items);

        setNextCursor(
          result.nextCursor
        );

        setHasMore(
          result.hasMore
        );
      } catch (err) {
        if (
          !mounted.current ||
          currentGeneration !==
            generation.current ||
          err?.name === "AbortError"
        ) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load posts."
        );

        if (!isRefresh) {
          setPosts([]);
          setNextCursor(null);
          setHasMore(false);
        }
      } finally {
        if (
          mounted.current &&
          currentGeneration ===
            generation.current
        ) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [
      category,
      location,
      pageSize,
      token,
    ]
  );

  // =====================================================
  // Reload When Category / Session Changes
  // =====================================================

  useEffect(() => {
    readFirstPage(false);
  }, [readFirstPage]);

  // =====================================================
  // Refresh
  // =====================================================

  const refresh = useCallback(
    () => readFirstPage(true),
    [readFirstPage]
  );

  // =====================================================
  // Load More
  // =====================================================

  const loadMore = useCallback(
    async () => {
      if (
        paginationBusy.current ||
        loading ||
        refreshing ||
        loadingMore ||
        !hasMore ||
        !nextCursor
      ) {
        return;
      }

      paginationBusy.current = true;

      const currentGeneration =
        generation.current;

      setLoadingMore(true);
      setError(null);

      try {
        const result = await getPosts({
          category,
          limit: pageSize,
          cursor: nextCursor,
          token,
          latitude: location?.latitude,
          longitude: location?.longitude,
        });

        if (
          !mounted.current ||
          currentGeneration !==
            generation.current
        ) {
          return;
        }

        setPosts((current) =>
          mergePosts(
            current,
            result.items
          )
        );

        setNextCursor(
          result.nextCursor
        );

        setHasMore(
          result.hasMore
        );
      } catch (err) {
        if (
          mounted.current &&
          currentGeneration ===
            generation.current
        ) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load more posts."
          );
        }
      } finally {
        paginationBusy.current = false;

        if (
          mounted.current &&
          currentGeneration ===
            generation.current
        ) {
          setLoadingMore(false);
        }
      }
    },
    [
      category,
      hasMore,
      loading,
      loadingMore,
      location,
      nextCursor,
      pageSize,
      refreshing,
      token,
    ]
  );

  // =====================================================
  // Change Location
  // =====================================================

  const updateLocation = useCallback(
    (coordinates) => {
      if (
        coordinates &&
        Number.isFinite(
          coordinates.latitude
        ) &&
        Number.isFinite(
          coordinates.longitude
        )
      ) {
        setLocation({
          latitude:
            coordinates.latitude,

          longitude:
            coordinates.longitude,
        });
      } else {
        setLocation(null);
      }
    },
    []
  );

  // =====================================================
  // Optimistically Update Like Count
  // =====================================================

  const updatePost = useCallback(
    (updatedPost) => {
      if (!updatedPost?.id) {
        return;
      }

      setPosts((current) =>
        current.map((post) =>
          post.id === updatedPost.id
            ? {
                ...post,
                ...updatedPost,
              }
            : post
        )
      );
    },
    []
  );

  // =====================================================
  // Return Hook
  // =====================================================

  return {
    category,
    setCategory,

    location,
    updateLocation,

    posts,

    loading,
    refreshing,
    loadingMore,

    error,
    hasMore,

    refresh,
    loadMore,
    updatePost,
  };
}