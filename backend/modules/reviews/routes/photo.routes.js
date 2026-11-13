const express = require('express');
const multer = require('multer');
const sharp = require('sharp');

const isId = value =>
  typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);

function createReviewPhotoRouter({
  ReviewPhoto,
  Review,
  authenticate
}) {
  const router = express.Router();

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024,
      files: 1
    },
    fileFilter: (req, file, next) => {
      next(
        null,
        ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
      );
    }
  });

  const optionalAuth = (req, res, next) => {
    if (req.headers.authorization) {
      return authenticate(req, res, next);
    }

    next();
  };

  router.post('/', authenticate, (req, res) => {
    upload.single('photo')(req, res, async error => {
      if (error) {
        return res.status(400).json({
          message: error.code === 'LIMIT_FILE_SIZE'
            ? 'Photo must be 5 MB or smaller'
            : 'Invalid photo upload'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          message: 'Select a JPEG, PNG or WebP image'
        });
      }

      let data;

      try {
        const image = sharp(req.file.buffer, {
          limitInputPixels: 25000000
        });

        const metadata = await image.metadata();

        if (!['jpeg', 'png', 'webp'].includes(metadata.format)) {
          return res.status(400).json({
            message: 'Unsupported image format'
          });
        }

        data = await image
          .rotate()
          .resize(1600, 1600, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ quality: 80 })
          .toBuffer();
      } catch {
        return res.status(400).json({
          message: 'Image is corrupt or too large to decode'
        });
      }

      if (data.length > 5 * 1024 * 1024) {
        return res.status(400).json({
          message: 'Processed image is too large'
        });
      }

      try {
        // Users cannot choose their own moderation status.
        const photo = await ReviewPhoto.create({
          userId: req.user.id,
          data,
          status: 'pending'
        });

        return res.status(201).json({
          photoUrl: `/api/review-photos/${photo._id}/image`,
          status: photo.status
        });
      } catch {
        return res.status(500).json({
          message: 'Photo upload failed'
        });
      }
    });
  });

  router.get('/:id/image', optionalAuth, async (req, res) => {
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

      const isOwner = Boolean(req.user?.id) &&
        String(photo.userId) === req.user.id;

      const published = photo.status === 'approved' &&
        photo.reviewId &&
        await Review.exists({
          _id: photo.reviewId,
          photoUrls: `/api/review-photos/${photo._id}/image`
        });

      if (!isOwner && !published) {
        return res.status(404).json({
          message: 'Photo not found'
        });
      }

      res.set('Cache-Control', 'no-store');
      res.type(photo.contentType);

      const data = Buffer.isBuffer(photo.data)
        ? photo.data
        : Buffer.from(photo.data.buffer);

      return res.send(data);
    } catch {
      return res.status(500).json({
        message: 'Photo retrieval failed'
      });
    }
  });

  return router;
}

module.exports = { createReviewPhotoRouter };