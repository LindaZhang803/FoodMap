import React, { useEffect, useRef, useState } from "react";

import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
} from "react-native";

import * as ImagePicker from "expo-image-picker";

import {
  colors,
  spacing,
  radius,
  typography,
} from "../../../shared/design/tokens";

import {
  AppButton,
  AppInput,
  LoadingState,
  EmptyState,
  ErrorState,
} from "../../../shared/design/UIComponents";

import AppIcon from "../../../shared/components/AppIcon";

// =====================================================
// Rating Distribution
// =====================================================

function RatingDistribution({ statistics }) {
  const distribution = statistics?.ratingDistribution;

  const hasDistribution =
    distribution &&
    typeof distribution === "object" &&
    !Array.isArray(distribution);

  const ratings = [5, 4, 3, 2, 1].map((stars) => {
    const raw = hasDistribution
      ? distribution[stars]
      : undefined;

    const count = Number(raw);

    return {
      stars,
      count,
      valid:
        raw !== undefined &&
        raw !== null &&
        Number.isInteger(count) &&
        count >= 0,
    };
  });

  const total = ratings.reduce(
    (sum, item) => sum + item.count,
    0
  );

  const valid =
    hasDistribution &&
    ratings.every((item) => item.valid) &&
    total === Number(statistics?.reviewCount);

  if (!valid) {
    return (
      <View style={styles.ratingDistribution}>
        <Text style={styles.distributionTitle}>
          Rating Distribution
        </Text>

        <Text style={styles.distributionEmpty}>
          Rating distribution unavailable
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.ratingDistribution}>
      <Text style={styles.distributionTitle}>
        Rating Distribution
      </Text>

      {ratings.map(({ stars, count }) => {
        const percentage =
          total > 0
            ? (count / total) * 100
            : 0;

        return (
          <View
            key={stars}
            style={styles.distributionRow}
          >
            <Text style={styles.distributionStars}>
              {stars} ★
            </Text>

            <View style={styles.distributionTrack}>
              <View
                style={[
                  styles.distributionFill,
                  {
                    width: `${percentage}%`,
                  },
                ]}
              />
            </View>

            <Text style={styles.distributionNumber}>
              {count}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function ReviewStars({ rating, size = 18 }) {
  const value = Math.max(
    0,
    Math.min(5, Math.round(Number(rating) || 0))
  );

  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((number) => (
        <AppIcon
          key={number}
          name={number <= value ? "starFilled" : "star"}
          size={size}
          color={colors.primary}
        />
      ))}
    </View>
  );
}

export default function ReviewPanel({
  restaurantId,
  dishId,
  repository,
  token,
  demo = false,
  origin,
  syntheticSession,
  onCreated,
  onLoginPress,
}) {
  const [photos, setPhotos] = useState([]);
  const [sort, setSort] = useState("mostRecent");
  const [editingId, setEditingId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const busy = useRef(false);
  const mounted = useRef(true);

  const [type, setType] = useState(
    dishId ? "dish" : "restaurant"
  );

  const [title, setTitle] = useState("");
  const [rating, setRating] = useState(0);
  const [spicinessRating, setSpicinessRating] = useState(null);
  const [comment, setComment] = useState("");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  const target = {
    restaurantId,
    reviewType: type,
    ...(type === "dish" ? { dishId } : {}),
  };

  const key = [
    restaurantId,
    dishId || "",
    type,
    page,
    refresh,
    sort,
  ].join(":");

  // Real review writes require a signed-in session.
  // The demo flag alone must never grant write permissions.
  const canWriteReview =
    typeof token === "string" &&
    token.trim().length > 0;

  const effectiveToken = canWriteReview ? token : null;

  // Preserve fixture reads for isolated development,
  // without allowing demo-only review writes.
  useEffect(() => {
    let active = true;
    setError(null);

    repository
      .list(
        {
          restaurantId,
          reviewType: type,
          ...(type === "dish" ? { dishId } : {}),
        },
        page,
        sort,
        effectiveToken
      )
      .then((data) => {
        if (active) {
          setResult({ key, token: effectiveToken, data });
        }
      })
      .catch((err) => {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load reviews."
          );
        }
      });

    return () => {
      active = false;
    };
  }, [
    repository,
    restaurantId,
    dishId,
    type,
    page,
    sort,
    effectiveToken,
    key,
  ]);

  const data =
    result?.key === key &&
    result.token === effectiveToken
      ? result.data
      : null;

  function resetForm() {
    setEditingId(null);
    setDeleteId(null);

    setTitle("");
    setRating(0);
    setSpicinessRating(null);
    setComment("");

    setPhotos([]);
    setFormError(null);
    setNotice("");
  }

  function validateReviewForm() {
    if (!restaurantId) {
      return "Please select a restaurant.";
    }

    if (type === "dish" && !dishId) {
      return "Please select a dish.";
    }

    if (!title.trim()) {
      return "Please enter a review title.";
    }

    if (title.trim().length > 120) {
      return "Review title must be 120 characters or fewer.";
    }

    if (
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5
    ) {
      return "Please select an overall rating from 1 to 5.";
    }

    if (
      spicinessRating !== null &&
      (
        !Number.isInteger(spicinessRating) ||
        spicinessRating < 1 ||
        spicinessRating > 5
      )
    ) {
      return "Spiciness rating must be between 1 and 5.";
    }

    if (!comment.trim()) {
      return "Please enter your review.";
    }

    if (comment.length > 2000) {
      return "Review must be 2000 characters or fewer.";
    }

    return null;
  }

  async function submit() {
    if (busy.current || !canWriteReview) return;

    const validationError = validateReviewForm();

    if (validationError) {
      setFormError(validationError);
      return;
    }

    busy.current = true;
    setSaving(true);
    setFormError(null);
    setNotice("");

    try {
      const input = {
        rating,
        comment,
        photoUrls: photos.map((photo) => photo.url),
      };

      const created = editingId
        ? await repository.edit(editingId, input, effectiveToken)
        : await repository.create(
            { ...target, ...input },
            effectiveToken
          );

      if (!mounted.current) return;

      setRating(0);
      setComment("");
      setPhotos([]);
      setEditingId(null);
      setPage(1);
      setRefresh((value) => value + 1);

      setNotice(
        demo
          ? "Demo review saved in memory."
          : "Review saved."
      );

      onCreated?.(target, created.statistics);
    } catch (err) {
      if (mounted.current) {
        setFormError(err.message);
      }
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  async function selectPhoto() {
    if (
      busy.current ||
      !canWriteReview ||
      photos.length >= 5
    ) {
      return;
    }

    busy.current = true;
    setSaving(true);
    setFormError(null);

    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        throw new Error(
          "Photo access was declined. You can still post without a photo."
        );
      }

      const picked =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.8,
        });

      if (picked.canceled || !picked.assets?.length) {
        return;
      }

      const asset = picked.assets[0];

      if (
        asset.fileSize != null &&
        asset.fileSize > 5 * 1024 * 1024
      ) {
        throw new Error("Photo must be 5 MB or smaller.");
      }

      const uploaded = await repository.uploadPhoto(
        asset,
        effectiveToken
      );

      if (mounted.current) {
        setPhotos((current) => [
          ...current,
          {
            url: uploaded.photoUrl,
            preview: asset.uri,
          },
        ]);
      }
    } catch (err) {
      if (mounted.current) {
        setFormError(err.message);
      }
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  async function changeReview(review, action) {
    if (busy.current || !canWriteReview) return;

    busy.current = true;
    setSaving(true);
    setFormError(null);
    setNotice("");

    try {
      if (action === "delete") {
        const changed = await repository.remove(
          review.id,
          effectiveToken
        );

        if (!mounted.current) return;

        setDeleteId(null);
        setEditingId(null);
        setRating(0);
        setComment("");
        setPhotos([]);
        setPage(1);

        onCreated?.(target, changed.statistics);
        setNotice("Review deleted.");
      } else {
        await repository.like(
          review.id,
          !review.likedByMe,
          effectiveToken
        );

        if (!mounted.current) return;
      }

      setRefresh((value) => value + 1);
    } catch (err) {
      if (mounted.current) {
        setFormError(err.message);
      }
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  function startEditing(review) {
    setEditingId(review.id);
    setDeleteId(null);
    setRating(review.rating);
    setComment(review.comment);

    setPhotos(
      (review.photoUrls || []).map((url) => ({
        url,
        preview: url.startsWith("/")
          ? origin + url
          : url,
      }))
    );

    setFormError(null);
    setNotice("");
  }

  return (
    <View style={styles.panel}>
      <View style={styles.sectionHeading}>
        <AppIcon
          name="reviews"
          size={22}
          color={colors.primary}
        />
        <Text style={styles.heading}>Reviews</Text>
      </View>

      <View style={styles.row}>
        {[
          "restaurant",
          ...(dishId ? ["dish"] : []),
        ].map((value) => {
          const selected = type === value;

          return (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              disabled={saving}
              style={[
                styles.chip,
                selected && styles.activeChip,
              ]}
              onPress={() => {
                setType(value);
                setPage(1);
                resetForm();
              }}
            >
              <Text
                style={[
                  styles.chipText,
                  selected && styles.activeChipText,
                ]}
              >
                {value === "dish"
                  ? "Dish Reviews"
                  : "Restaurant Reviews"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.row}>
        {[
          ["mostRecent", "Most Recent"],
          ["mostLiked", "Most Liked"],
        ].map(([value, label]) => {
          const selected = sort === value;

          return (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              disabled={saving}
              style={[
                styles.sortChip,
                selected && styles.activeSortChip,
              ]}
              onPress={() => {
                setSort(value);
                setPage(1);
              }}
            >
              <Text
                style={[
                  styles.sortText,
                  selected && styles.activeSortText,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <ErrorState
          title="Unable to load reviews"
          message={error}
          onRetry={() => setRefresh((value) => value + 1)}
        />
      ) : !data ? (
        <LoadingState message="Loading reviews..." />
      ) : (
        <>
          <View style={styles.summary}>
            {data.statistics.averageRating != null && (
              <AppIcon
                name="starFilled"
                size={20}
                color={colors.primary}
              />
            )}

            <Text style={styles.summaryRating}>
              {data.statistics.averageRating == null
                ? "No ratings yet"
                : `${Number(
                    data.statistics.averageRating
                  ).toFixed(1)} / 5`}
            </Text>

            <Text style={styles.summaryCount}>
              {data.statistics.reviewCount} reviews
            </Text>
          </View>

          {/* Rating Distribution */}

          <RatingDistribution
            statistics={data.statistics}
          />

          {data.reviews.length === 0 && (
            <EmptyState
              title="No reviews yet"
              description="Be the first to share your experience."
              style={styles.emptyState}
            />
          )}

          {data.reviews.map((review) => (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <ReviewStars rating={review.rating} />

                {review.isOwner && (
                  <Text style={styles.ownerBadge}>
                    Your Review
                  </Text>
                )}
              </View>

              <Text style={styles.reviewComment}>
                {review.comment}
              </Text>

              <View style={styles.photoRow}>
                {(review.photoUrls || []).map((url) => (
                  <Image
                    key={url}
                    source={{
                      uri: url.startsWith("/")
                        ? origin + url
                        : url,
                    }}
                    style={styles.photo}
                    accessibilityLabel="Review photo"
                  />
                ))}
              </View>

              <View style={styles.actionRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    `${review.likedByMe ? "Unlike" : "Like"} ` +
                    `review ${review.id}`
                  }
                  disabled={saving || !canWriteReview}
                  onPress={() => changeReview(review, "like")}
                  style={[
                    styles.actionButton,
                    (saving || !canWriteReview) &&
                      styles.disabled,
                  ]}
                >
                  <AppIcon
                    name={review.likedByMe ? "favoriteFilled" : "like"}
                    size={19}
                    color={
                      review.likedByMe
                        ? colors.primary
                        : colors.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.actionText,
                      review.likedByMe && styles.likedText,
                    ]}
                  >
                    {review.likeCount || 0}
                  </Text>
                </Pressable>

                {review.isOwner && canWriteReview && (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      disabled={saving}
                      style={styles.actionButton}
                      onPress={() => startEditing(review)}
                    >
                      <AppIcon
                        name="edit"
                        size={18}
                        color={colors.textSecondary}
                      />
                      <Text style={styles.actionText}>Edit</Text>
                    </Pressable>

                    <Pressable
                      accessibilityRole="button"
                      disabled={saving}
                      style={styles.actionButton}
                      onPress={() => setDeleteId(review.id)}
                    >
                      <AppIcon
                        name="delete"
                        size={18}
                        color={colors.error}
                      />
                      <Text style={styles.deleteText}>Delete</Text>
                    </Pressable>
                  </>
                )}
              </View>

              {deleteId === review.id && (
                <View style={styles.deleteConfirm}>
                  <Text style={styles.confirmText}>
                    Delete this review?
                  </Text>

                  <View style={styles.row}>
                    <AppButton
                      title="Confirm Delete"
                      icon="delete"
                      variant="danger"
                      disabled={saving}
                      onPress={() =>
                        changeReview(review, "delete")
                      }
                      style={styles.confirmButton}
                    />

                    <AppButton
                      title="Cancel"
                      variant="secondary"
                      disabled={saving}
                      onPress={() => setDeleteId(null)}
                      style={styles.confirmButton}
                    />
                  </View>
                </View>
              )}
            </View>
          ))}

          <View style={styles.pagination}>
            {page > 1 && (
              <AppButton
                title="Previous"
                icon="chevronBack"
                variant="outline"
                onPress={() => setPage((value) => value - 1)}
                style={styles.pageButton}
              />
            )}

            {page * data.pagination.limit <
              data.pagination.total && (
              <AppButton
                title="Next"
                icon="chevronForward"
                variant="outline"
                onPress={() => setPage((value) => value + 1)}
                style={styles.pageButton}
              />
            )}
          </View>
        </>
      )}

      {canWriteReview ? (
        <View style={styles.formSection}>
          <Text style={styles.heading}>
            {editingId
              ? "Edit Your Review"
              : `Write a ${type} review`}
          </Text>

          <AppInput
            label="Review Title"
            accessibilityLabel="Review Title"
            placeholder="Give your review a title..."
            value={title}
            onChangeText={setTitle}
            maxLength={120}
            editable={!saving}
          />

          <Text style={styles.fieldLabel}>Overall Rating (Required)</Text>

          <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={`${value} spiciness`}
                accessibilityState={{
                  selected: spicinessRating === value,
                }}
                disabled={saving}
                onPress={() => {
                  setSpicinessRating(
                    spicinessRating === value ? null : value
                  );
                }}
                style={styles.starButton}
              >
                <AppIcon
                  name={
                    value <= (spicinessRating ?? 0)
                      ? "starFilled"
                      : "star"
                  }
                  size={32}
                  color={colors.primary}
                />
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>
            Spiciness Rating (Optional)
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear spiciness rating"
            disabled={saving || spicinessRating === null}
            onPress={() => setSpicinessRating(null)}
          >
            <Text style={styles.clearRatingText}>
              Clear Spiciness Rating
            </Text>
          </Pressable>

          <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={`${value} stars`}
                accessibilityState={{ selected: rating === value }}
                disabled={saving}
                onPress={() => setRating(value)}
                style={styles.starButton}
              >
                <AppIcon
                  name={value <= rating ? "starFilled" : "star"}
                  size={32}
                  color={colors.primary}
                />
              </Pressable>
            ))}
          </View>

          <AppInput
            label="Your Review"
            leftIcon="comment"
            accessibilityLabel="Review comment"
            placeholder="Share your dining experience..."
            multiline
            maxLength={2000}
            editable={!saving}
            value={comment}
            onChangeText={setComment}
            style={styles.commentInput}
          />

          <Text style={styles.characterCount}>
            {comment.length}/2000
          </Text>

          <View style={styles.photoRow}>
            {photos.map((photo, index) => (
              <View
                key={`${photo.url}-${index}`}
                style={styles.selectedPhoto}
              >
                <Image
                  source={{ uri: photo.preview }}
                  style={styles.photo}
                  accessibilityLabel="Selected review photo"
                />

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove photo ${index + 1}`}
                  disabled={saving}
                  onPress={() =>
                    setPhotos((current) =>
                      current.filter((_, i) => i !== index)
                    )
                  }
                  style={styles.removePhotoButton}
                >
                  <AppIcon
                    name="delete"
                    size={15}
                    color={colors.error}
                  />
                  <Text style={styles.removePhoto}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </View>

          <AppButton
            title={`Add Photo (${photos.length}/5)`}
            icon="camera"
            variant="outline"
            disabled={saving || photos.length >= 5}
            onPress={selectPhoto}
            style={styles.photoButton}
          />

          {formError && (
            <Text
              accessibilityRole="alert"
              style={styles.formError}
            >
              {formError}
            </Text>
          )}

          <AppButton
            title={editingId ? "Save Changes" : "Submit Review"}
            icon="check"
            loading={saving}
            disabled={saving}
            onPress={submit}
            style={styles.submitButton}
          />

          {editingId && (
            <AppButton
              title="Cancel Edit"
              variant="secondary"
              disabled={saving}
              onPress={resetForm}
              style={styles.cancelEditButton}
            />
          )}

          {!!notice && (
            <Text
              accessibilityLiveRegion="polite"
              style={styles.notice}
            >
              {notice}
            </Text>
          )}
        </View>
      ) : (
        <View style={styles.loginRequired}>
          <AppIcon
            name="login"
            size={28}
            color={colors.primary}
          />

          <Text style={styles.loginTitle}>
            Sign In to Write a Review
          </Text>

          <Text style={styles.loginDescription}>
            You can read reviews without an account.
            Sign in to rate dishes, write reviews,
            upload photos and like other reviews.
          </Text>

          {typeof onLoginPress === "function" && (
            <AppButton
              title="Log In / Sign Up"
              icon="login"
              onPress={onLoginPress}
              style={styles.loginButton}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  heading: {
    ...typography.section,
    color: colors.text,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
  },
  activeChip: {
    backgroundColor: colors.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  activeChipText: {
    color: colors.white,
  },
  sortChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
  },
  activeSortChip: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  sortText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  activeSortText: {
    color: colors.primary,
    fontWeight: "700",
  },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginVertical: spacing.lg,
  },
  summaryRating: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.primary,
  },
  summaryCount: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  reviewCard: {
    backgroundColor: colors.surface,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  stars: {
    flexDirection: "row",
    gap: 2,
  },
  ownerBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  reviewComment: {
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.md,
  },
  photoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  photo: {
    width: 110,
    height: 90,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.md,
  },
  actionButton: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
  },
  actionText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  likedText: {
    color: colors.primary,
  },
  deleteText: {
    fontSize: 13,
    color: colors.error,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.5,
  },
  deleteConfirm: {
    padding: spacing.md,
    marginTop: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.errorLight,
  },
  confirmText: {
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.md,
  },
  confirmButton: {
    flexGrow: 1,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  pageButton: {
    flexGrow: 1,
  },
  emptyState: {
    minHeight: 160,
  },
  formSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.xl,
    paddingTop: spacing.xl,
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  starRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  starButton: {
    padding: spacing.xs,
  },
  commentInput: {
    minHeight: 120,
  },
  characterCount: {
    textAlign: "right",
    fontSize: 11,
    color: colors.textMuted,
    marginTop: -spacing.sm,
    marginBottom: spacing.lg,
  },
  selectedPhoto: {
    alignItems: "center",
  },
  removePhotoButton: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  removePhoto: {
    color: colors.error,
    fontSize: 12,
  },
  photoButton: {
    marginTop: spacing.sm,
  },
  submitButton: {
    marginTop: spacing.lg,
  },
  cancelEditButton: {
    marginTop: spacing.sm,
  },
  formError: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.md,
  },
  notice: {
    ...typography.caption,
    color: colors.success,
    marginTop: spacing.md,
    textAlign: "center",
  },
  loginRequired: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginTop: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
  },
  loginTitle: {
    ...typography.section,
    color: colors.text,
    textAlign: "center",
  },
  loginDescription: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
  },
  loginButton: {
    marginTop: spacing.lg,
    alignSelf: "stretch",
  },

  clearRatingText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: "600",
    marginBottom: spacing.lg,
  },

  // =====================================================
  // Rating Distribution Styles
  // =====================================================

  ratingDistribution: {
    marginBottom: spacing.xl,
    padding: spacing.lg,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
  },

  distributionTitle: {
    ...typography.section,
    color: colors.text,
    marginBottom: spacing.lg,
  },

  distributionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.md,
  },

  distributionStars: {
    width: 42,
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
  },

  distributionTrack: {
    flex: 1,
    height: 10,
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    overflow: "hidden",
  },

  distributionFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
  },

  distributionNumber: {
    width: 35,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "right",
  },

  distributionEmpty: {
    ...typography.body,
    color: colors.textMuted,
  },
});
