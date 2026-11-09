// receive mongoose models on restaurant, dish model
// Inject the owning models, including Reviews' existing Dish model.

function createCatalogReaders({ Restaurant, Dish }) {
  if (!Restaurant || !Dish || typeof Restaurant.find !== 'function' ||
      typeof Dish.find !== 'function') {
    throw new TypeError('Both existing Restaurant and Dish models are required.');
  }
  return {
    restaurant: { findByIds: ids => Restaurant.find({ _id: { $in: ids } }).lean().exec() },
    dish: { findByIds: ids => Dish.find({ _id: { $in: ids } }).lean().exec() },
  };
}

module.exports = { createCatalogReaders };