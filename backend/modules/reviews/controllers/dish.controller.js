const { parseDishQuery } = require('../services/dishQuery');
const { readSpicinessQuestionnaire } = require('../../accounts/validators/spicinessQuestionnaire');
const {
  getSpicinessCompatibility,
  resolveDishHeatSummary,
  SPICINESS_COMPATIBILITY_NOTE
} = require('../../accounts/services/spicinessCompatibility');

const isId = value =>
  typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);

function createDishController({
  Dish,
  Review,
  ReviewPhoto,
  Restaurant,
  User
}) {
  const serialize = doc => {
    const { _id, __v, spicinessRanking, statisticsRevision, ...fields } = doc;

    return {
      ...fields,
      id: String(_id)
    };
  };

  const serializeDish = (dish, answers) => {
    const { median, sampleCount } = resolveDishHeatSummary(dish);
    return {
      ...serialize(dish),
      spicinessCompatibility: getSpicinessCompatibility(answers, median, sampleCount),
      spicinessCompatibilityNote: SPICINESS_COMPATIBILITY_NOTE
    };
  };

  const readAnswers = async userId => {
    if (!userId || !User) return undefined;
    const user = await User.findById(userId).select('spicinessQuestionnaire').lean();
    return readSpicinessQuestionnaire(user?.spicinessQuestionnaire)?.answers;
  };

  return {
    async list(req, res) {
      let parsed;

      try {
        parsed = parseDishQuery(req.query);
      } catch (error) {
        return res.status(400).json({
          message: error.message
        });
      }

      try {
        const dishes = await Dish.find(parsed.filter)
          .sort(parsed.order)
          .lean();

        const answers = await readAnswers(req.user?.id);
        return res.json(dishes.map(dish => serializeDish(dish, answers)));
      } catch {
        return res.status(500).json({
          message: 'Failed to load dishes'
        });
      }
    },

    async detail(req, res) {
      if (!isId(req.params.id)) {
        return res.status(400).json({
          message: 'Invalid dish ID'
        });
      }

      try {
        const dish = await Dish.findById(req.params.id).lean();

        if (!dish) {
          return res.status(404).json({
            message: 'Dish not found'
          });
        }

        const reviews = await Review.find({
          dishId: req.params.id,
          reviewType: 'dish'
        })
          .select(
            '_id restaurantId dishId reviewType rating ' +
            'spicinessRating comment photoUrls createdAt updatedAt'
          )
          .sort({ createdAt: -1, _id: -1 })
          .limit(50)
          .lean();

        const photoIds = reviews.flatMap(review =>
          (review.photoUrls || []).map(url => url.split('/')[3])
        );

        const photos = ReviewPhoto && photoIds.length
          ? await ReviewPhoto.find({
              _id: { $in: photoIds },
              status: 'approved'
            }).select('_id status').lean()
          : [];

        const approvedIds = new Set(
          photos
            .filter(photo => photo.status === 'approved')
            .map(photo => String(photo._id))
        );

        const publicReviews = reviews.map(review => ({
          ...serialize(review),
          photoUrls: (review.photoUrls || []).filter(url =>
            approvedIds.has(url.split('/')[3])
          )
        }));

        const restaurant = Restaurant
          ? await Restaurant.findById(dish.restaurantId)
              .select('name')
              .lean()
          : null;

        const answers = await readAnswers(req.user?.id);
        return res.json({
          ...serializeDish(dish, answers),
          ...(Restaurant
            ? { restaurantName: restaurant?.name || null }
            : {}),
          reviews: publicReviews
        });
      } catch {
        return res.status(500).json({
          message: 'Failed to load dish'
        });
      }
    }
  };
}

module.exports = { createDishController };
