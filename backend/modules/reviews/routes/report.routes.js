const express = require('express');
const requireAdmin = require('../../admin/middleware/requireAdmin');

function handle(action) {
  return async (req, res) => {
    try {
      await action(req, res);
    } catch (error) {
      res.status(error.status || 500).json({
        message: error.status
          ? error.message
          : 'Report service unavailable'
      });
    }
  };
}

// Signed-in users can report a review.
function createReportRouter({ service, authenticate }) {
  const router = express.Router();

  router.post(
    '/:id/report',
    authenticate,
    handle(async (req, res) => {
      const result = await service.submit(
        req.params.id,
        req.body,
        req.user?.id
      );

      res.status(201).json(result);
    })
  );

  return router;
}

// Only administrators can read and process reports.
function createReportAdminRouter({ service }) {
  const router = express.Router();

  router.use(requireAdmin);

  router.get(
    '/',
    handle(async (req, res) => {
      const result = await service.list(req.query);
      res.json(result);
    })
  );

  router.patch(
    '/:id',
    handle(async (req, res) => {
      const result = await service.resolve(
        req.params.id,
        req.body
      );

      res.json(result);
    })
  );

  return router;
}

module.exports = {
  createReportRouter,
  createReportAdminRouter
};