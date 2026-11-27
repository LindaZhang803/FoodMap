const { rankDishes } = require('./rankDishes');
const { readSpicinessQuestionnaire } = require('../../accounts/validators/spicinessQuestionnaire');
async function readDishRanking({ Dish, Restaurant, Review, User, connection, userId = null, location = null, mode = 'forYou', now = new Date(), favoriteCuisines, spicinessAnswers }) {
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const needsUser = mode === 'forYou' && userId && (favoriteCuisines === undefined || spicinessAnswers === undefined);
  const [dishes, restaurants, recent, favorites, user] = await Promise.all([
    Dish.find({}).lean(), Restaurant.find({}).lean(),
    Review.aggregate([
      { $match: { reviewType: 'dish', createdAt: { $gte: since } } },
      { $group: { _id: '$dishId', recentReviews: { $sum: 1 }, likes: { $sum: '$likeCount' } } }
    ]),
    connection.db.collection('favorites').aggregate([
      { $match: { targetType: 'dish' } }, { $group: { _id: '$targetId', favorites: { $sum: 1 } } }
    ]).toArray(),
    needsUser ? User.findById(userId).select('favoriteCuisines spicinessQuestionnaire').lean() : null
  ]);
  const activity = new Map(recent.map(r => [String(r._id), { dishId: r._id, recentReviews: r.recentReviews, likes: r.likes }]));
  for (const f of favorites) activity.set(String(f._id), { ...activity.get(String(f._id)), dishId: f._id, favorites: f.favorites });
  const effectiveSpiciness = spicinessAnswers !== undefined
    ? spicinessAnswers
    : readSpicinessQuestionnaire(user?.spicinessQuestionnaire)?.answers;
  return rankDishes({
    dishes, restaurants, activity: [...activity.values()],
    favoriteCuisines: favoriteCuisines ?? (user?.favoriteCuisines || []),
    location, mode, spicinessAnswers: effectiveSpiciness
  });
}
module.exports = { readDishRanking };
