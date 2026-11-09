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

const mountedApps = new WeakMap();

/** The host connects first and passes its existing catalog models and auth. */
function mountFavoritesModule(app, { connection, authenticate, Restaurant, Dish }) {
  if (mountedApps.has(app)) return mountedApps.get(app);
  const ready = createFavoritesModule({
    connection, authenticate, readers: createCatalogReaders({ Restaurant, Dish }),
  }).then(favorites => {
    app.use('/api/favorites', favorites.router);
    return favorites;
  }).catch(error => {
    mountedApps.delete(app);
    throw error;
  });
  mountedApps.set(app, ready);
  return ready;
}

module.exports = { createFavoritesModule, createCatalogReaders, mountFavoritesModule };
