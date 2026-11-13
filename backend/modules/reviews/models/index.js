const { validateReview } = require('../validators/review');

function createModels(mongoose) {
  const { Schema } = mongoose;

  const reference = (ref, required = true) => ({
    type: Schema.Types.ObjectId,
    ref,
    required
  });

  const dishSchema = new Schema({
    restaurantId: reference('Restaurant'),
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    description: {
      type: String,
      default: '',
      maxlength: 2000
    },
    imageUrl: {
      type: String,
      default: null
    },
    averageRating: {
      type: Number,
      default: null,
      min: 1,
      max: 5
    },
    reviewCount: {
      type: Number,
      default: 0,
      min: 0
    },
    medianSpiciness: {
      type: Number,
      default: null,
      min: 1,
      max: 5
    },
    spicinessDistribution: {
      level1: { type: Number, default: 0, min: 0 },
      level2: { type: Number, default: 0, min: 0 },
      level3: { type: Number, default: 0, min: 0 },
      level4: { type: Number, default: 0, min: 0 },
      level5: { type: Number, default: 0, min: 0 }
    },
    spicinessRatingCount: {
      type: Number,
      default: 0,
      min: 0
    }
  }, { timestamps: true });

  dishSchema.index({ restaurantId: 1 });

  const reviewSchema = new Schema({
    userId: reference('User'),
    restaurantId: reference('Restaurant'),
    dishId: reference('Dish', false),
    reviewType: {
      type: String,
      enum: ['restaurant', 'dish'],
      required: true
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: Number.isInteger
    },
    spicinessRating: {
      type: Number,
      min: 1,
      max: 5,
      validate: Number.isInteger
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },
    photoUrls: {
      type: [String],
      default: []
    },
    likeCount: {
      type: Number,
      default: 0,
      min: 0
    }
  }, { timestamps: true });

  reviewSchema.pre('validate', function () {
    const errors = validateReview({
      ...this.toObject(),
      restaurantId: this.restaurantId?.toString(),
      dishId: this.dishId?.toString()
    });

    for (const error of errors) {
      this.invalidate('reviewType', error);
    }
  });

  reviewSchema.index({
    restaurantId: 1,
    reviewType: 1,
    createdAt: -1
  });

  reviewSchema.index({ dishId: 1, createdAt: -1 });
  reviewSchema.index({ userId: 1, createdAt: -1 });

  const likeSchema = new Schema({
    reviewId: reference('Review'),
    userId: reference('User')
  }, { timestamps: true });

  likeSchema.index(
    { reviewId: 1, userId: 1 },
    { unique: true }
  );

  const photoSchema = new Schema({
    userId: reference('User'),
    reviewId: reference('Review', false),

    data: {
      type: Buffer,
      required: true,
      select: false
    },

    contentType: {
      type: String,
      default: 'image/jpeg',
      enum: ['image/jpeg']
    },

    status: {
      type: String,
      required: true,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },

    reviewedAt: {
      type: Date,
      default: null
    },

    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
  }, {
    timestamps: true,
    collection: 'review_photos'
  });

  photoSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  photoSchema.index({ reviewId: 1 });
  photoSchema.index({ status: 1, createdAt: 1 });

  return {
    ReviewPhoto:
      mongoose.models.ReviewPhoto ||
      mongoose.model('ReviewPhoto', photoSchema),
    Dish:
      mongoose.models.Dish ||
      mongoose.model('Dish', dishSchema),
    Review:
      mongoose.models.Review ||
      mongoose.model('Review', reviewSchema),
    ReviewLike:
      mongoose.models.ReviewLike ||
      mongoose.model('ReviewLike', likeSchema)
  };
}

module.exports = { createModels };