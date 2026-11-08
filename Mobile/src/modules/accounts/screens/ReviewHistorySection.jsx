import React, { useEffect, useRef, useState } from "react";
import {
    View,
    Text,
    Pressable,
    ActivityIndicator,
    StyleSheet
} from "react-native";

export default function ReviewHistorySection({ token, loadReviews }) {
    const [reviews, setReviews] = useState([]);
    const [page, setPage] = useState(0);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [hasMore, setHasMore] = useState(false);

    const requestId = useRef(0);
    const inFlight = useRef(false);

    async function fetchPage(nextPage, replace = false) {
        if (!token || inFlight.current) return;

        const id = ++requestId.current;
        inFlight.current = true;
        setLoading(true);
        setError("");

        try {
            const result = await loadReviews(token, nextPage);

            if (id !== requestId.current) return;

            setReviews(current => {
                if (replace) return [...result.reviews];

                const ids = new Set(current.map(review => review.id));
                return [
                    ...current,
                    ...result.reviews.filter(review => !ids.has(review.id))
                ];
            });

            setPage(result.pagination.page);
            setTotal(result.pagination.total);
            setHasMore(
                result.reviews.length > 0 &&
                result.pagination.page * result.pagination.limit <
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

    function displayDate(value) {
        const date = value ? new Date(value) : null;

        return date && !Number.isNaN(date.getTime())
            ? date.toLocaleDateString()
            : "Date unavailable";
    }

    return (
        <View style={styles.section}>
            <Text style={styles.heading}>My reviews</Text>

            {page > 0 && (
                <Text style={styles.count}>
                    {total} review{total === 1 ? "" : "s"}
                </Text>
            )}

            {reviews.map(review => (
                <View key={review.id} style={styles.card}>
                    <View style={styles.row}>
                        <Text style={styles.type}>
                            {review.reviewType === "dish"
                                ? "Dish review"
                                : "Restaurant review"}
                        </Text>

                        <Text style={styles.rating}>
                            {`${review.rating} / 5`}
                        </Text>
                    </View>

                    <Text style={styles.comment}>{review.comment}</Text>

                    <Text style={styles.date}>
                        {displayDate(review.createdAt)}
                    </Text>
                </View>
            ))}

            {!loading && !error && page > 0 && reviews.length === 0 && (
                <Text style={styles.message}>
                    You have not written any reviews yet.
                </Text>
            )}

            {!!error && (
                <View>
                    <Text style={styles.error}>{error}</Text>

                    <Pressable
                        style={styles.button}
                        accessibilityRole="button"
                        onPress={() => fetchPage(page + 1, page === 0)}
                    >
                        <Text style={styles.buttonText}>Retry</Text>
                    </Pressable>
                </View>
            )}

            {loading && <ActivityIndicator color="#1b5ad0" />}

            {!loading && !error && hasMore && (
                <Pressable
                    style={styles.button}
                    accessibilityRole="button"
                    onPress={() => fetchPage(page + 1)}
                >
                    <Text style={styles.buttonText}>Load more</Text>
                </Pressable>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    section: {
        marginTop: 28,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: "#ddd"
    },
    heading: {
        fontSize: 22,
        fontWeight: "bold",
        marginBottom: 8
    },
    count: {
        color: "#666",
        marginBottom: 14
    },
    card: {
        padding: 16,
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 12,
        marginBottom: 12,
        backgroundColor: "#fafafa"
    },
    row: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 8
    },
    type: {
        fontWeight: "600",
        color: "#222"
    },
    rating: {
        fontWeight: "bold",
        color: "#1b5ad0"
    },
    comment: {
        fontSize: 15,
        lineHeight: 22,
        color: "#333"
    },
    date: {
        marginTop: 10,
        fontSize: 13,
        color: "#777"
    },
    message: {
        color: "#666",
        marginBottom: 12
    },
    error: {
        color: "#b42318",
        marginBottom: 10
    },
    button: {
        alignSelf: "center",
        backgroundColor: "#1b5ad0",
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 10,
        marginVertical: 10
    },
    buttonText: {
        color: "#fff",
        fontWeight: "bold"
    }
});