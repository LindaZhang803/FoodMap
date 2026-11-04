const isId = value => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
function validateReview(input) {
  const errors = [];
  if (!isId(input.restaurantId)) errors.push('restaurantId must be a MongoDB ObjectId');
  if (!['restaurant', 'dish'].includes(input.reviewType)) errors.push('Invalid reviewType');
  if (input.reviewType === 'dish' && !isId(input.dishId)) errors.push('Dish reviews require dishId');
  if (input.reviewType === 'restaurant' && input.dishId != null) errors.push('Restaurant reviews cannot include dishId');
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) errors.push('rating must be an integer from 1 to 5');
  if (typeof input.comment !== 'string' || !input.comment.trim() || input.comment.length > 2000) errors.push('comment must contain 1–2000 characters');
  if (!Array.isArray(input.photoUrls) || input.photoUrls.length > 5 || new Set(input.photoUrls).size !== input.photoUrls.length || input.photoUrls.some(url => typeof url !== 'string' || !/^\/api\/review-photos\/[a-f0-9]{24}\/image$/i.test(url))) errors.push('photoUrls must contain at most 5 distinct uploaded review photo URLs');
  return errors;
}
module.exports = { validateReview };
