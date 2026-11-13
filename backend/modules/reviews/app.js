const express = require('express');

const { createModels } = require('./models');
const { createReplyModel } = require('./models/reply');
const { createReportModel } = require('./models/report');

const {
  createReviewService
} = require('./services/review.service');

const {
  createReplyService
} = require('./services/reply.service');

const {
  createReportService
} = require('./services/report.service');

const {
  createReviewRouter
} = require('./routes/review.routes');

const {
  createReplyRouter
} = require('./routes/reply.routes');

const {
  createReportRouter,
  createReportAdminRouter
} = require('./routes/report.routes');

const {
  createReviewPhotoRouter
} = require('./routes/photo.routes');

const {
  createPhotoModerationRouter
} = require('./routes/photo-moderation.routes');

const {
  createDishController
} = require('./controllers/dish.controller');

function mountReviewModule(app, {
  mongoose,
  Restaurant,
  authenticate
}) {
  const models = {
    ...createModels(mongoose),
    ReviewReply: createReplyModel(mongoose),
    ReviewReport: createReportModel(mongoose)
  };

  const reviewService = createReviewService({
    mongoose,
    Restaurant,
    ...models
  });

  const replyService = createReplyService({
    mongoose,
    Review: models.Review,
    ReviewReply: models.ReviewReply
  });

  const reportService = createReportService({
    mongoose,
    Review: models.Review,
    ReviewReport: models.ReviewReport
  });

  app.use(
    '/api/reviews',
    createReviewRouter({
      service: reviewService,
      authenticate
    })
  );

  app.use(
    '/api/reviews',
    createReplyRouter({
      service: replyService,
      authenticate
    })
  );

  app.use(
    '/api/reviews',
    createReportRouter({
      service: reportService,
      authenticate
    })
  );

  app.use(
    '/api/review-reports',
    createReportAdminRouter({
      service: reportService
    })
  );

  app.use(
    '/api/review-photos',
    createReviewPhotoRouter({
      ...models,
      authenticate
    })
  );

  app.use(
    '/api/review-photo-moderation',
    createPhotoModerationRouter({
      ReviewPhoto: models.ReviewPhoto
    })
  );

  const controller = createDishController(models);
  const dishes = express.Router();

  dishes.get('/', controller.list);
  dishes.get('/:id', controller.detail);

  app.use('/api/dishes', dishes);

  return models;
}

module.exports = { mountReviewModule };