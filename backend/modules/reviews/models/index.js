// Pass the team's shared Mongoose instance; this module does not open a connection.
const { validateReview } = require('../validators/review');
function createModels(mongoose) {
  const { Schema } = mongoose;
  const reference = (ref, required = true) => ({ type: Schema.Types.ObjectId, ref, required });
  const dishSchema = new Schema({
    restaurantId: reference('Restaurant'),
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', maxlength: 2000 },
    imageUrl: { type: String, default: null },
    averageRating: { type: Number, default: null, min: 1, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 }
  }, { timestamps: true });
  dishSchema.index({ restaurantId: 1 });
  const reviewSchema = new Schema({
    userId: reference('User'), restaurantId: reference('Restaurant'), dishId: reference('Dish', false),
    reviewType: { type: String, enum: ['restaurant', 'dish'], required: true },
    rating: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
    comment: { type: String, required: true, trim: true, maxlength: 2000 },
    photoUrls: { type: [String], default: [] }
  }, { timestamps: true });
  reviewSchema.pre('validate', function () {
    for (const error of validateReview({ ...this.toObject(), restaurantId: this.restaurantId?.toString(), dishId: this.dishId?.toString() })) this.invalidate('reviewType', error);
  });
  reviewSchema.index({ restaurantId: 1, reviewType: 1, createdAt: -1 });
  reviewSchema.index({ dishId: 1, createdAt: -1 });
  reviewSchema.index({ userId: 1, createdAt: -1 });
  const likeSchema = new Schema({ reviewId: reference('Review'), userId: reference('User') }, { timestamps: true });
  likeSchema.index({ reviewId: 1, userId: 1 }, { unique: true });
  return {
    Dish: mongoose.models.Dish || mongoose.model('Dish', dishSchema),
    Review: mongoose.models.Review || mongoose.model('Review', reviewSchema),
    ReviewLike: mongoose.models.ReviewLike || mongoose.model('ReviewLike', likeSchema)
  };
}
module.exports = { createModels };
