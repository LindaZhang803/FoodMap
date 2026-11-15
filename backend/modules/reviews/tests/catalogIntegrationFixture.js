// Temporary synthetic records only. Cleanup always targets this run's fresh IDs.
async function createCatalogFixture() {
  require('dotenv').config({ quiet: true });
  const mongoose = require('mongoose');
  const crypto = require('crypto');
  const bcrypt = require('bcrypt');
  const sharp = require('sharp');
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  const app = require('../../../server');
  const { User, Restaurant, Dish, Review, Post, PostPhoto } = mongoose.models;
  const ids = { user: new mongoose.Types.ObjectId(), restaurants: [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()], dishes: [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()], reviews: [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()], posts: [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()], photos: [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()] };
  const email = `catalog-${ids.user}@example.invalid`, password = 'SyntheticDemo2026!';
  let server;
  async function cleanup() {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.readyState === 1) {
      await Promise.all([
        PostPhoto.deleteMany({ _id: { $in: ids.photos } }), Post.deleteMany({ _id: { $in: ids.posts } }),
        Review.deleteMany({ _id: { $in: ids.reviews } }), Dish.deleteMany({ _id: { $in: ids.dishes } }),
        Restaurant.deleteMany({ _id: { $in: ids.restaurants } }), User.deleteOne({ _id: ids.user }),
        mongoose.connection.db.collection('favorites').deleteMany({ userId: ids.user })
      ]);
    }
    await mongoose.disconnect();
    if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret;
  }
  try {
    await User.create({ _id: ids.user, username: 'Synthetic integration user', email, passwordHash: await bcrypt.hash(password, 10), favoriteCuisines: ['Italian'] });
    for (let i = 0; i < 2; i++) {
      await Restaurant.create({ _id: ids.restaurants[i], name: `[SYNTHETIC] ${i ? 'Italian' : 'Japanese'} Integration Cafe`, address: 'Synthetic test address', cuisineType: i ? 'Italian' : 'Japanese', latitude: 33.98 + i / 100, longitude: -117.37, minPrice: 5, maxPrice: 25, rating: 5 - i, reviewCount: 1 });
      const data = await sharp({ create: { width: 320, height: 240, channels: 3, background: i ? '#5b8c5a' : '#e67e22' } }).jpeg().toBuffer();
      await PostPhoto.create({ _id: ids.photos[i], postId: ids.posts[i], data });
      await Dish.create({ _id: ids.dishes[i], restaurantId: ids.restaurants[i], name: i ? 'Synthetic Pasta' : 'Synthetic Ramen', description: 'Generated integration test menu, not a real restaurant dish.', category: 'main', price: i ? 15 : 12.5, averageRating: 5 - i, reviewCount: 1, imageUrl: `/api/posts/photos/${ids.photos[i]}` });
      await Review.create({ _id: ids.reviews[i], userId: ids.user, restaurantId: ids.restaurants[i], dishId: ids.dishes[i], reviewType: 'dish', rating: 5 - i, comment: 'Synthetic integration review.', likeCount: i ? 0 : 10 });
      await Post.create({ _id: ids.posts[i], authorId: ids.user, restaurantId: ids.restaurants[i], reviewId: ids.reviews[i], title: i ? '[SYNTHETIC] Pasta preference test' : '[SYNTHETIC] Ramen trending test', caption: 'Temporary integration verification data.', imageUrls: [`/api/posts/photos/${ids.photos[i]}`] });
    }
    await mongoose.connection.db.collection('favorites').insertOne({ userId: ids.user, targetId: ids.dishes[1], targetType: 'dish', createdAt: new Date() });
    const { mountFavoritesModule } = require('../../feed');
    await mountFavoritesModule(app, { connection: mongoose.connection, Restaurant, Dish, authenticate: require('../../accounts/middleware/authMiddleware') });
    return { app, ids, email, password, cleanup, async listen(port = 0) {
      server = await new Promise((resolve, reject) => { const listener = app.listen(port, '0.0.0.0', () => resolve(listener)); listener.once('error', reject); });
      return `http://127.0.0.1:${server.address().port}`;
    } };
  } catch (error) { await cleanup(); throw error; }
}
module.exports = { createCatalogFixture };
