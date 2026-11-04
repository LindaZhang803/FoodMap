const express = require('express');
const mongoose = require('mongoose');
const { createModels } = require('../models');
const { createDishController } = require('../controllers/dish.controller');
const controller = createDishController(createModels(mongoose));
const router = express.Router();
router.get('/', controller.list);
router.get('/:id', controller.detail);
module.exports = router;
