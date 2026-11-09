// Use the host's connection and Mongoose instance; never open a second connection.
// schema for favorite

function createFavoriteModel(connection) {
  if (!connection || !connection.base || typeof connection.model !== 'function') {
    throw new TypeError('The shared Mongoose connection is required.');
  }
  if (connection.models.Favorite) return connection.models.Favorite;

  const { Schema } = connection.base;
  const schema = new Schema({
    userId: { type: Schema.Types.ObjectId, required: true, immutable: true },
    targetType: {
      type: String,
      enum: ['restaurant', 'dish'],
      required: true,
      immutable: true,
    },
    targetId: { type: Schema.Types.ObjectId, required: true, immutable: true },
    createdAt: { type: Date, required: true, default: Date.now, immutable: true },
  }, { collection: 'favorites', versionKey: false });

  schema.index({ userId: 1, targetType: 1, targetId: 1 }, {
    unique: true,
    name: 'favorite_owner_target_unique',
  });
  schema.index({ userId: 1, createdAt: -1, _id: -1 });
  return connection.model('Favorite', schema);
}

module.exports = { createFavoriteModel };