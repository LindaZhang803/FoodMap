const express = require('express');
const { createModels } = require('./models');
const { createReviewService } = require('./services/review.service');
const { createReviewRouter } = require('./routes/review.routes');
const { createReviewPhotoRouter } = require('./routes/photo.routes');
const { createDishController } = require('./controllers/dish.controller');
function mountReviewModule(app, { mongoose, Restaurant, authenticate }) {
  const models = createModels(mongoose);
  app.use('/api/reviews', createReviewRouter({ service: createReviewService({ mongoose, Restaurant, ...models }), authenticate }));
  app.use('/api/review-photos', createReviewPhotoRouter({ ...models, authenticate }));
  const controller = createDishController(models);
  const dishes = express.Router(); dishes.get('/', controller.list); dishes.get('/:id', controller.detail);
  app.use('/api/dishes', dishes);
  return models;
}
module.exports = { mountReviewModule };
