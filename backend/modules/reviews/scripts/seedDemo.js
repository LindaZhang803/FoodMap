const mongoose = require('mongoose');
const Restaurant = require('../../restaurants/models/Restaurant');
const User = require('../../accounts/models/User');
const { createModels } = require('../models');
const IDS = {
  restaurant: '6f1800000000000000000001',
  dishes: ['6f1800000000000000000011', '6f1800000000000000000012'],
  users: ['6f1800000000000000000021', '6f1800000000000000000022']
};
async function insertSynthetic(Model, id, expected, marker) {
  const existing = await Model.findById(id).lean();
  if (existing && existing[marker] !== expected[marker]) throw new Error('Synthetic ID collision; existing data was not modified');
  if (!existing) await Model.create({ _id: id, ...expected });
}
async function seedDemo() {
  const models = createModels(mongoose);
  await insertSynthetic(Restaurant, IDS.restaurant, { name: '[SYNTHETIC DEMO] FoodMap Review Lab', description: 'Synthetic review-module test data. Not a real restaurant.', address: 'Demo data only', latitude: 33.98, longitude: -117.37, cuisineType: 'Demo' }, 'name');
  for (let i = 0; i < IDS.users.length; i++) await insertSynthetic(User, IDS.users[i], {
    username: `Review Demo User ${i + 1}`, email: `foodmap-review-demo-${i + 1}@example.invalid`,
    passwordHash: 'Synthetic test account: no password login is supported', bio: 'Synthetic review-module demo account'
  }, 'email');
  for (let i = 0; i < IDS.dishes.length; i++) await insertSynthetic(models.Dish, IDS.dishes[i], {
    restaurantId: IDS.restaurant, name: ['Demo Ramen', 'Demo Dumplings'][i], description: 'Synthetic menu item for review testing. Not a real restaurant menu.'
  }, 'name');
  return IDS;
}
module.exports = { seedDemo, IDS };
