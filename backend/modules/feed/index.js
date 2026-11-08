const { createFavoriteModel } = require('./models/Favorite');
const { createMongooseFavoriteStore } = require('./favorites/mongooseFavoriteStore');
const { createFavoriteService } = require('./services/favoriteService');
const { createCatalogReaders } = require('./services/catalogReaders');
const { createFavoritesRouter } = require('./routes/favorites');

async function createFavoritesModule({ connection, authenticate, readers }) {
  if (typeof authenticate !== 'function') throw new TypeError('Real authentication middleware is required.');
  const Favorite = createFavoriteModel(connection);
  const service = createFavoriteService({ store: createMongooseFavoriteStore(Favorite), readers });
  // Explicitly create indexes even when the host disables autoIndex. Fail startup
  // if uniqueness cannot be established; do not serve best-effort persistence.
  await Favorite.createIndexes();
  return { router: createFavoritesRouter({ authenticate, service }), Favorite };
}

module.exports = { createFavoritesModule, createCatalogReaders };