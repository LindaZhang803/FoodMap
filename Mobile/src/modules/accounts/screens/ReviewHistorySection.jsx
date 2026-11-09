import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  View,
  Text,
  StyleSheet,
} from "react-native";

import {
  colors,
  spacing,
  radius,
  typography,
} from "../../../shared/design/tokens";

import {
  AppButton,
  LoadingState,
  EmptyState,
  ErrorState,
} from "../../../shared/design/UIComponents";

export default function ReviewHistorySection({
  token,
  loadReviews,
}) {
  const [reviews, setReviews] = useState([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);

  const requestId = useRef(0);
  const inFlight = useRef(false);

  // =====================================================
  // 1. Load review history
  // =====================================================

  async function fetchPage(
    nextPage,
    replace = false
  ) {
    if (
      !token ||
      inFlight.current ||
      typeof loadReviews !== "function"
    ) {
      return;
    }

    const id = ++requestId.current;

    inFlight.current = true;

    setLoading(true);
    setError("");

    try {
      const result = await loadReviews(
        token,
        nextPage
      );

      if (id !== requestId.current) {
        return;
      }

      setReviews((current) => {
        if (replace) {
          return [...result.reviews];
        }

        const ids = new Set(
          current.map((review) => review.id)
        );

        return [
          ...current,
          ...result.reviews.filter(
            (review) => !ids.has(review.id)
          ),
        ];
      });

      setPage(result.pagination.page);
      setTotal(result.pagination.total);

      setHasMore(
        result.reviews.length > 0 &&
          result.pagination.page *
            result.pagination.limit <
            result.pagination.total
      );
    } catch (err) {
      if (id === requestId.current) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not load reviews."
        );
      }
    } finally {
      if (id === requestId.current) {
        inFlight.current = false;
        setLoading(false);
      }
    }
  }

  // =====================================================
  // 2. Reset when account changes
  // =====================================================

  useEffect(() => {
    setReviews([]);
    setPage(0);
    setTotal(0);
    setHasMore(false);

    fetchPage(1, true);

    return () => {
      requestId.current += 1;
      inFlight.current = false;
    };
  }, [token, loadReviews]);

  // =====================================================
  // 3. Date formatting
  // =====================================================

  function displayDate(value) {
    const date = value
      ? new Date(value)
      : null;

    return date &&
      !Number.isNaN(date.getTime())
      ? date.toLocaleDateString()
      : "Date unavailable";
  }

  // =====================================================
  // 4. Rating
  // =====================================================

  function renderRating(rating) {
    const numeric = Number(rating);

    if (!Number.isFinite(numeric)) {
      return "No rating";
    }

    return `★ ${numeric.toFixed(1)} / 5`;
  }

  // =====================================================
  // 5. Render
  // =====================================================

  return (
    <View style={styles.section}>
      {/* Header */}
      <View style={styles.header}>
        <Text
          accessibilityRole="header"
          style={styles.heading}
        >
          My Reviews
        </Text>

        {page > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.count}>
              {total} review
              {total === 1 ? "" : "s"}
            </Text>
          </View>
        )}
      </View>

      {/* Review cards */}
      {reviews.map((review) => (
        <View
          key={review.id}
          style={styles.card}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.type}>
              {review.reviewType === "dish"
                ? "Dish Review"
                : "Restaurant Review"}
            </Text>

            <Text style={styles.rating}>
              {renderRating(review.rating)}
            </Text>
          </View>

          <Text style={styles.comment}>
            {review.comment}
          </Text>

          <View style={styles.cardFooter}>
            <Text style={styles.date}>
              {displayDate(
                review.createdAt
              )}
            </Text>
          </View>
        </View>
      ))}

      {/* Initial loading */}
      {loading && reviews.length === 0 && (
        <LoadingState
          message="Loading your reviews..."
          style={styles.state}
        />
      )}

      {/* Empty state */}
      {!loading &&
        !error &&
        page > 0 &&
        reviews.length === 0 && (
          <EmptyState
            title="No Reviews Yet"
            description="Your restaurant and dish reviews will appear here."
            style={styles.state}
          />
        )}

      {/* Error */}
      {!!error && (
        <ErrorState
          title="Unable to Load Reviews"
          message={error}
          onRetry={() =>
            fetchPage(
              page + 1,
              page === 0
            )
          }
          style={styles.state}
        />
      )}

      {/* Loading more */}
      {loading && reviews.length > 0 && (
        <LoadingState
          message="Loading more reviews..."
          style={styles.smallState}
        />
      )}

      {/* Pagination */}
      {!loading &&
        !error &&
        hasMore && (
          <AppButton
            title="Load More Reviews"
            variant="outline"
            onPress={() =>
              fetchPage(page + 1)
            }
            style={styles.loadMoreButton}
          />
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.surface,
  },

  header: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },

  heading: {
    ...typography.section,
    color: colors.text,
  },

  countBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
  },

  count: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "700",
  },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },

  cardHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },

  type: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.text,
  },

  rating: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },

  comment: {
    ...typography.body,
    color: colors.text,
  },

  cardFooter: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },

  date: {
    ...typography.caption,
    color: colors.textMuted,
  },

  state: {
    minHeight: 180,
  },

  smallState: {
    minHeight: 100,
  },

  loadMoreButton: {
    marginTop: spacing.md,
  },
});