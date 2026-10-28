const isId = value => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
function createDishController({ Dish, Review }) {
  const serialize = doc => {
    const { _id, __v, ...fields } = doc;
    return { ...fields, id: String(_id) };
  };
  return {
    async list(req, res) {
      const { restaurantId } = req.query;
      if (restaurantId !== undefined && !isId(restaurantId)) return res.status(400).json({ message: 'Invalid restaurantId' });
      try {
        const dishes = await Dish.find(restaurantId ? { restaurantId } : {}).sort({ name: 1, _id: 1 }).lean();
        return res.json(dishes.map(serialize));
      } catch {
        return res.status(500).json({ message: 'Failed to load dishes' });
      }
    },
    async detail(req, res) {
      if (!isId(req.params.id)) return res.status(400).json({ message: 'Invalid dish ID' });
      try {
        const dish = await Dish.findById(req.params.id).lean();
        if (!dish) return res.status(404).json({ message: 'Dish not found' });
        // Public review fields only; author/profile enrichment follows Accounts integration.
        const reviews = await Review.find({ dishId: req.params.id, reviewType: 'dish' })
          .select('_id restaurantId dishId reviewType rating comment photoUrls createdAt updatedAt')
          .sort({ createdAt: -1, _id: -1 }).limit(50).lean();
        return res.json({ ...serialize(dish), reviews: reviews.map(serialize) });
      } catch {
        return res.status(500).json({ message: 'Failed to load dish' });
      }
    }
  };
}
module.exports = { createDishController };
