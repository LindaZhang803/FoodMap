const mongoose = require('mongoose');
const { createModels } = require('../models');
const { createReviewService } = require('../services/review.service');

async function main() {
  require('dotenv').config({ quiet: true });
  if (!process.env.MONGO_URI) {
    console.error('Set MONGO_URI before running the dish spiciness backfill.');
    process.exitCode = 1;
    return;
  }

  try {
    await mongoose.connect(process.env.MONGO_URI, {
      autoCreate: false,
      autoIndex: false,
      serverSelectionTimeoutMS: 15000
    });
    const models = createModels(mongoose);
    const service = createReviewService({ mongoose, ...models });
    const dishes = models.Review.aggregate([
      {
        $match: {
          reviewType: 'dish',
          dishId: { $type: 'objectId' },
          spicinessRating: { $in: [1, 2, 3, 4, 5] }
        }
      },
      { $group: { _id: '$dishId' } }
    ]).cursor();

    let updatedDishes = 0;
    let rankedDishes = 0;
    for await (const { _id } of dishes) {
      const summary = await service.backfillSpicinessRanking(String(_id));
      if (summary) {
        updatedDishes += 1;
        if (summary.median !== null) {
          rankedDishes += 1;
        }
      }
    }

    console.log(JSON.stringify({ updatedDishes, rankedDishes }));
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(() => {
  console.error('Dish spiciness backfill failed. Check the database configuration and rerun.');
  process.exitCode = 1;
});
