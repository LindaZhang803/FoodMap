const express = require('express');
function createReviewRouter({ service, authenticate }) {
  const router = express.Router();
  const handle = handler => async (req, res) => {
    try { await handler(req, res); }
    catch (error) { res.status(error.status || 500).json({ message: error.status ? error.message : 'Review service unavailable' }); }
  };
  router.get('/', handle(async (req, res) => res.json(await service.list(req.query))));
  router.post('/', authenticate, handle(async (req, res) => res.status(201).json(await service.create(req.body, req.user?.id))));
  return router;
}
module.exports = { createReviewRouter };
