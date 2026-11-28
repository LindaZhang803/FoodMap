function validateInput(input) {
  if (
    !input ||
    !["restaurant", "dish"].includes(input.reviewType)
  ) {
    throw new Error("Choose a review type.");
  }

  if (input.reviewType === "dish" && !input.dishId) {
    throw new Error("Select a dish first.");
  }

  if (
    input.reviewType === "restaurant" &&
    input.dishId != null
  ) {
    throw new Error(
      "Restaurant reviews cannot include a dish."
    );
  }

  if (
    !Number.isInteger(input.rating) ||
    input.rating < 1 ||
    input.rating > 5
  ) {
    throw new Error("Select 1–5 stars.");
  }

  // Spiciness is optional for dish reviews.
  if (
    input.reviewType === "dish" &&
    input.spicinessRating != null &&
    (
      !Number.isInteger(input.spicinessRating) ||
      input.spicinessRating < 1 ||
      input.spicinessRating > 5
    )
  ) {
    throw new Error("Select a spiciness rating from 1–5.");
  }

  if (
    input.reviewType === "restaurant" &&
    input.spicinessRating != null
  ) {
    throw new Error(
      "Restaurant reviews cannot include a spiciness rating."
    );
  }

  if (
    typeof input.comment !== "string" ||
    !input.comment.trim() ||
    input.comment.length > 2000
  ) {
    throw new Error(
      "Enter a comment (up to 2,000 characters)."
    );
  }
}

function createReviewRepository({
  origin = "",
  fetchImpl = globalThis.fetch,
  fixtures = null,
  fileFromAsset = asset => {
    const { File } = require("expo-file-system");
    return new File(asset.uri);
  },
} = {}) {
  let sequence = 0;

  const matches = (review, target) =>
    review.restaurantId === target.restaurantId &&
    review.reviewType === target.reviewType &&
    (
      target.reviewType !== "dish" ||
      review.dishId === target.dishId
    );

  const demoUser = "demo-user";

  const decorate = ({ userId, _likes, ...review }) => ({
    ...review,
    spicinessRating: review.spicinessRating ?? null,
    isOwner: userId === demoUser,
    likeCount: (_likes || []).length,
    likedByMe: (_likes || []).includes(demoUser),
  });

  const requireToken = token => {
    if (!fixtures && !token) {
      throw new Error("Sign in to manage reviews.");
    }
  };

  const headers = token => ({
    "Content-Type": "application/json",
    ...(token
      ? { Authorization: `Bearer ${token}` }
      : {}),
  });

  function findOwned(id) {
    const review = fixtures.reviews.find(
      r => r.id === id
    );

    if (!review) {
      throw new Error("Review not found.");
    }

    if (review.userId !== demoUser) {
      throw new Error(
        "You can only change your own reviews."
      );
    }

    return review;
  }

  // =====================================================
  // Statistics for Fixture / Demo Mode
  // =====================================================

  function stats(target) {
    const rows = fixtures.reviews.filter(
      review => matches(review, target)
    );

    const overallRatings = rows
      .map(review => review.rating)
      .filter(
        rating =>
          Number.isInteger(rating) &&
          rating >= 1 &&
          rating <= 5
      );

    const ratingDistribution = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    for (const rating of overallRatings) {
      ratingDistribution[rating] += 1;
    }

    const ratingSum = overallRatings.reduce(
      (sum, rating) => sum + rating,
      0
    );

    // Spiciness is calculated separately.
    const spicinessRatings = rows
      .map(review => review.spicinessRating)
      .filter(
        rating =>
          Number.isInteger(rating) &&
          rating >= 1 &&
          rating <= 5
      )
      .sort((a, b) => a - b);

    const spicinessDistribution = {
      level1: 0,
      level2: 0,
      level3: 0,
      level4: 0,
      level5: 0,
    };

    for (const value of spicinessRatings) {
      spicinessDistribution[`level${value}`] += 1;
    }

    const middle = Math.floor(
      spicinessRatings.length / 2
    );

    let medianSpiciness = null;

    if (spicinessRatings.length > 0) {
      medianSpiciness =
        spicinessRatings.length % 2 === 1
          ? spicinessRatings[middle]
          : (
              spicinessRatings[middle - 1] +
              spicinessRatings[middle]
            ) / 2;
    }

    return {
      averageRating:
        overallRatings.length > 0
          ? ratingSum / overallRatings.length
          : null,

      reviewCount: rows.length,

      ratingDistribution,

      medianSpiciness,

      spicinessDistribution,

      spicinessRatingCount:
        spicinessRatings.length,
    };
  }

  function refreshStats(target) {
    const statistics = stats(target);

    const dish =
      target.reviewType === "dish" &&
      fixtures.dishes.find(
        d => d.id === target.dishId
      );

    if (dish) {
      Object.assign(dish, statistics);
    }

    return statistics;
  }

  // =====================================================
  // Network Request
  // =====================================================

  async function request(path, options = {}) {
    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      15000
    );

    try {
      const response = await fetchImpl(
        `${origin}${path}`,
        {
          ...options,
          signal: controller.signal,
        }
      );

      const body = await response.json();

      if (!response.ok) {
        throw new Error(
          body.message || "Unable to load reviews."
        );
      }

      return body;
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    // =====================================================
    // List Reviews
    // =====================================================

    async list(
      target,
      page = 1,
      sort = "mostRecent",
      token
    ) {
      if (
        !["mostRecent", "mostLiked"].includes(sort)
      ) {
        throw new Error("Invalid review sort.");
      }

      if (fixtures) {
        const rows = fixtures.reviews
          .filter(r => matches(r, target))
          .slice()
          .sort((a, b) => {
            const likes =
              sort === "mostLiked"
                ? (b._likes || []).length -
                  (a._likes || []).length
                : 0;

            return (
              likes ||
              String(b.createdAt).localeCompare(
                String(a.createdAt)
              ) ||
              b.id.localeCompare(a.id)
            );
          });

        return {
          reviews: rows
            .slice(
              (page - 1) * 20,
              page * 20
            )
            .map(decorate),

          statistics: stats(target),

          pagination: {
            page,
            limit: 20,
            total: rows.length,
          },
        };
      }

      const params =
        `restaurantId=${encodeURIComponent(
          target.restaurantId
        )}` +
        `&reviewType=${target.reviewType}` +
        `&page=${page}` +
        `&sort=${sort}` +
        (
          target.dishId
            ? `&dishId=${encodeURIComponent(
                target.dishId
              )}`
            : ""
        );

      return request(
        `/api/reviews?${params}`,
        {
          headers: headers(token),
        }
      );
    },

    // =====================================================
    // Create Review
    // =====================================================

    async create(input, token) {
      validateInput(input);

      if (!fixtures && !token) {
        throw new Error(
          "Sign in to post a review."
        );
      }

      // Overall rating and spiciness rating are separate.
      const payload = {
        restaurantId: input.restaurantId,
        reviewType: input.reviewType,
        rating: input.rating,
        comment: input.comment.trim(),
        photoUrls: input.photoUrls ?? [],
      };

      if (input.reviewType === "dish") {
        payload.dishId = input.dishId;

        // Do not send null/undefined on creation.
        // Backend validator accepts omitted optional spiciness.
        if (input.spicinessRating != null) {
          payload.spicinessRating =
            input.spicinessRating;
        }
      }

      if (fixtures) {
        const dish =
          input.dishId &&
          fixtures.dishes.find(
            d => d.id === input.dishId
          );

        if (
          input.reviewType === "dish" &&
          (
            !dish ||
            dish.restaurantId !== input.restaurantId
          )
        ) {
          throw new Error(
            "Dish does not belong to this restaurant."
          );
        }

        const review = {
          ...payload,
          id:
            `demo-review-${Date.now()}-` +
            `${++sequence}`,
          userId: demoUser,
          createdAt: new Date().toISOString(),
        };

        fixtures.reviews.push(review);

        return {
          review: decorate(review),
          statistics: refreshStats(input),
        };
      }

      return request("/api/reviews", {
        method: "POST",
        headers: headers(token),
        body: JSON.stringify(payload),
      });
    },

    // =====================================================
    // Edit Review
    // =====================================================

    async edit(id, input, token) {
      requireToken(token);

      const allowed = [
        "rating",
        "spicinessRating",
        "comment",
        "photoUrls",
      ];

      if (
        Object.keys(input).some(
          key => !allowed.includes(key)
        )
      ) {
        throw new Error(
          "Only rating, spicinessRating, " +
          "comment and photos can be edited."
        );
      }

      if (fixtures) {
        const review = findOwned(id);

        const next = {
          ...review,
          ...input,
        };

        validateInput(next);

        Object.assign(review, {
          rating: next.rating,
          comment: next.comment.trim(),
          photoUrls: next.photoUrls,
          updatedAt: new Date().toISOString(),
        });

        // Preserve the ability to clear spiciness.
        if (
          Object.prototype.hasOwnProperty.call(
            input,
            "spicinessRating"
          )
        ) {
          if (input.spicinessRating == null) {
            delete review.spicinessRating;
          } else {
            review.spicinessRating =
              input.spicinessRating;
          }
        }

        return {
          review: decorate(review),
          statistics: refreshStats(review),
        };
      }

      return request(
        `/api/reviews/${encodeURIComponent(id)}`,
        {
          method: "PUT",
          headers: headers(token),
          body: JSON.stringify(input),
        }
      );
    },

    // =====================================================
    // Delete Review
    // =====================================================

    async remove(id, token) {
      requireToken(token);

      if (fixtures) {
        const review = findOwned(id);

        fixtures.reviews.splice(
          fixtures.reviews.indexOf(review),
          1
        );

        return {
          statistics: refreshStats(review),
        };
      }

      return request(
        `/api/reviews/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers: headers(token),
        }
      );
    },

    // =====================================================
    // Like Review
    // =====================================================

    async like(id, enabled, token) {
      requireToken(token);

      if (fixtures) {
        const review = fixtures.reviews.find(
          r => r.id === id
        );

        if (!review) {
          throw new Error("Review not found.");
        }

        const users = new Set(
          review._likes || []
        );

        if (enabled) {
          users.add(demoUser);
        } else {
          users.delete(demoUser);
        }

        review._likes = [...users];

        return {
          likeCount: users.size,
          likedByMe: users.has(demoUser),
        };
      }

      return request(
        `/api/reviews/${encodeURIComponent(id)}/like`,
        {
          method: enabled ? "POST" : "DELETE",
          headers: headers(token),
        }
      );
    },

    // =====================================================
    // Upload Photo
    // =====================================================

    async uploadPhoto(asset, token) {
      requireToken(token);

      if (fixtures) {
        return {
          photoUrl: asset.uri,
        };
      }

      const form = new FormData();

      // Expo SDK 57 supports File/Blob uploads.
      form.append(
        "photo",
        fileFromAsset(asset),
        asset.fileName || "review.jpg"
      );

      return request(
        "/api/review-photos",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: form,
        }
      );
    },

    // =====================================================
    // My Reviews
    // =====================================================

    async mine(token, page = 1) {
      requireToken(token);

      if (fixtures) {
        const rows = fixtures.reviews
          .filter(r => r.userId === demoUser)
          .slice()
          .reverse();

        return {
          reviews: rows
            .slice(
              (page - 1) * 20,
              page * 20
            )
            .map(decorate),

          pagination: {
            page,
            limit: 20,
            total: rows.length,
          },
        };
      }

      return request(
        `/api/reviews/mine?page=${page}`,
        {
          headers: headers(token),
        }
      );
    },
  };
}

module.exports = {
  createReviewRepository,
  validateInput,
};