const express = require('express');
const requireAdmin = require('../../admin/middleware/requireAdmin');

const isId = value =>
  typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);

function createPhotoModerationRouter({ ReviewPhoto }) {
  const router = express.Router();

  // Reuse the project's existing administrator authentication.
  router.use(requireAdmin);

  router.get('/', async (req, res) => {
    const status = req.query.status ?? 'pending';
    const page = req.query.page === undefined
      ? 1
      : Number(req.query.page);
    const limit = 20;

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        message: 'Invalid photo status'
      });
    }

    if (!Number.isSafeInteger(page) || page < 1 || page > 10000) {
      return res.status(400).json({
        message: 'Invalid page'
      });
    }

    try {
      const filter = { status };

      const [photos, total] = await Promise.all([
        ReviewPhoto.find(filter)
          .select('_id userId reviewId status reviewedAt createdAt')
          .sort({ createdAt: 1, _id: 1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        ReviewPhoto.countDocuments(filter)
      ]);

      return res.json({
        photos,
        pagination: { page, limit, total }
      });
    } catch {
      return res.status(500).json({
        message: 'Photo moderation unavailable'
      });
    }
  });

  // Administrators can preview a photo before approving it.
  router.get('/:id/image', async (req, res) => {
    if (!isId(req.params.id)) {
      return res.status(400).json({
        message: 'Invalid photo ID'
      });
    }

    try {
      const photo = await ReviewPhoto.findById(req.params.id)
        .select('+data')
        .lean();

      if (!photo || (photo.expiresAt && photo.expiresAt <= new Date())) {
        return res.status(404).json({
          message: 'Photo not found'
        });
      }

      res.set('Cache-Control', 'no-store');
      res.type(photo.contentType);

      return res.send(
        Buffer.isBuffer(photo.data)
          ? photo.data
          : Buffer.from(photo.data.buffer)
      );
    } catch {
      return res.status(500).json({
        message: 'Photo moderation unavailable'
      });
    }
  });

  function moderate(status) {
    return async (req, res) => {
      if (!isId(req.params.id)) {
        return res.status(400).json({
          message: 'Invalid photo ID'
        });
      }

      try {
        const photo = await ReviewPhoto.findOneAndUpdate(
          { _id: req.params.id },
          {
            $set: {
              status,
              reviewedAt: new Date()
            }
          },
          { new: true, runValidators: true }
        )
          .select('_id userId reviewId status reviewedAt createdAt')
          .lean();

        if (!photo) {
          return res.status(404).json({
            message: 'Photo not found'
          });
        }

        return res.json({ photo });
      } catch {
        return res.status(500).json({
          message: 'Photo moderation unavailable'
        });
      }
    };
  }

  router.patch('/:id/approve', moderate('approved'));
  router.patch('/:id/reject', moderate('rejected'));

  return router;
}

module.exports = { createPhotoModerationRouter };