const express = require('express');

function createReplyRouter({ service, authenticate }) {
  const router = express.Router();

  const handle = action => async (req, res) => {
    try {
      await action(req, res);
    } catch (error) {
      res.status(error.status || 500).json({
        message: error.status
          ? error.message
          : 'Reply service unavailable'
      });
    }
  };

  const optionalAuth = (req, res, next) => {
    if (req.headers.authorization) {
      return authenticate(req, res, next);
    }

    next();
  };

  // Anyone can read replies.
  router.get(
    '/:id/replies',
    optionalAuth,
    handle(async (req, res) => {
      const result = await service.list(
        req.params.id,
        req.query,
        req.user?.id
      );

      res.json(result);
    })
  );

  // Signed-in users can write replies.
  router.post(
    '/:id/replies',
    authenticate,
    handle(async (req, res) => {
      const result = await service.create(
        req.params.id,
        req.body,
        req.user?.id
      );

      res.status(201).json(result);
    })
  );

  // The service checks that the user owns the reply.
  router.delete(
    '/:id/replies/:replyId',
    authenticate,
    handle(async (req, res) => {
      const result = await service.remove(
        req.params.id,
        req.params.replyId,
        req.user?.id
      );

      res.json(result);
    })
  );

  return router;
}

module.exports = { createReplyRouter };