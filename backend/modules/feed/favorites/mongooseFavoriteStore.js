// receives favorite model, talks to mongoose db
function createMongooseFavoriteStore(Favorite) {
  return {
    list(userId) {
      return Favorite.find({ userId }).sort({ createdAt: -1, _id: -1 }).lean().exec();
    },

    async save(key) {
      try {
        // Only insertion sets the date. Retries must not move an existing save.
        return await Favorite.findOneAndUpdate(key, {
          $setOnInsert: { ...key, createdAt: new Date() },
        }, {
          upsert: true,
          returnDocument: 'after',
          runValidators: true,
          setDefaultsOnInsert: false,
        }).lean().exec();
      } catch (error) {
        // A concurrent upsert may lose the unique-index race. Read its winner.
        if (error.code !== 11000) throw error;
        const saved = await Favorite.findOne(key).lean().exec();
        if (!saved) throw error;
        return saved;
      }
    },

    async remove(key) {
      await Favorite.deleteOne(key).exec();
    },
  };
}

module.exports = { createMongooseFavoriteStore };