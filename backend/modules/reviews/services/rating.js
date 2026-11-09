function calculateRating(reviews) {
  if (!reviews.length) return { averageRating: null, reviewCount: 0 };
  if (reviews.some(({ rating }) => !Number.isInteger(rating) || rating < 1 || rating > 5)) throw new Error('Invalid rating');
  return { averageRating: reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length, reviewCount: reviews.length };
}
module.exports = { calculateRating };
