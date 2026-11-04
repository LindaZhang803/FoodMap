// Local-only standalone demo. This entry point is never mounted by server.js.
require('dotenv').config({ quiet: true });
const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { seedDemo } = require('./seedDemo');
const { mountReviewModule } = require('../app');
async function main() {
  if (!process.env.MONGO_URI) throw new Error('Set MONGO_URI in backend/.env');
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  const ids = await seedDemo();
  const app = express(); app.use(express.json());
  const models = mountReviewModule(app, { mongoose, Restaurant: require('../../restaurants/models/Restaurant'), authenticate: require('../../accounts/middleware/authMiddleware') });
  await Promise.all(Object.values(models).map(model => model.init()));
  app.get('/api/demo/session', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const user = await require('../../accounts/models/User').findById(ids.users[0]).select('tokenVersion').lean();
      if (!user) return res.status(404).json({ message: 'Synthetic demo user not found' });
      res.json({ restaurantId: ids.restaurant, token: jwt.sign({ id: ids.users[0], tokenVersion: user.tokenVersion ?? 0 }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '2h' }) });
    } catch { res.status(500).json({ message: 'Demo session unavailable' }); }
  });
  const server = app.listen(3001, '127.0.0.1', () => console.log('Synthetic review demo ready at http://127.0.0.1:3001 (MongoDB-backed; local simulator only)'));
  server.on('error', async () => { console.error('Demo port is unavailable'); await mongoose.disconnect(); process.exitCode = 1; });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(async () => { await mongoose.disconnect(); process.exit(0); }));
}
main().catch(async error => { console.error('Demo startup failed:', error.name); await mongoose.disconnect(); process.exitCode = 1; });
