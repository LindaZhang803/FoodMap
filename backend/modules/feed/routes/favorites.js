//api entry file

const express = require('express');
const { FavoriteInputError } = require('../services/favoriteService');

function createFavoritesRouter({ authenticate, service }) {
  if (typeof authenticate !== 'function') throw new TypeError('Real authentication middleware is required.');
  if (!service) throw new TypeError('A Favorites service is required.');
  const router = express.Router();
  router.use(authenticate);

  function handle(action) {
    return async (req, res) => {
      try {
        // Ownership comes only from the authenticated session.
        await action(req, res, req.user && req.user.id);
      } catch (error) {
        if (error instanceof FavoriteInputError) {
          res.status(error.status).json({ message: error.message });
        } else {
          res.status(500).json({ message: 'Internal server error' });
        }
      }
    };
  }

  router.get('/', handle(async (req, res, userId) => {
    res.status(200).json({ items: await service.list(userId) });
  }));
  router.put('/:targetType/:targetId', handle(async (req, res, userId) => {
    res.status(200).json(await service.save(userId, req.params.targetType, req.params.targetId));
  }));
  router.delete('/:targetType/:targetId', handle(async (req, res, userId) => {
    await service.remove(userId, req.params.targetType, req.params.targetId);
    res.status(204).end();
  }));
  // Express decodes parameters before entering our route handler.
  router.use((error, req, res, next) => {
    if (error instanceof URIError && error.status === 400) {
      return res.status(400).json({ message: 'Invalid favorite target ID' });
    }
    next(error);
  });
  return router;
}

module.exports = { createFavoritesRouter };