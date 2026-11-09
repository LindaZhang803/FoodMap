const express = require('express');
function createReviewRouter({ service, authenticate }) {
  const router = express.Router();
  const handle = handler => async (req, res) => {
    try { await handler(req, res); }
    catch (error) { res.status(error.status || 500).json({ message: error.status ? error.message : 'Review service unavailable' }); }
  };
  const optionalAuth = (req, res, next) => req.headers.authorization ? authenticate(req, res, next) : next();
  router.get('/mine', authenticate, handle(async (req, res) => res.json(await service.mine(req.query, req.user?.id))));
  router.get('/', optionalAuth, handle(async (req, res) => res.json(await service.list(req.query, req.user?.id))));
  router.post('/', authenticate, handle(async (req, res) => res.status(201).json(await service.create(req.body, req.user?.id))));
  router.put('/:id', authenticate, handle(async (req, res) => res.json(await service.edit(req.params.id, req.body, req.user?.id))));
  router.delete('/:id', authenticate, handle(async (req, res) => res.json(await service.remove(req.params.id, req.user?.id))));
  router.post('/:id/like', authenticate, handle(async (req, res) => res.json(await service.like(req.params.id, req.user?.id, true))));
  router.delete('/:id/like', authenticate, handle(async (req, res) => res.json(await service.like(req.params.id, req.user?.id, false))));
  return router;
}
module.exports = { createReviewRouter };
