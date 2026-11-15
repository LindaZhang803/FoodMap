// Read-only: inspect raw collection values without applying Mongoose defaults.
async function main() {
  require('dotenv').config({ quiet: true });
  const mongoose = require('mongoose');
  const { auditCatalog } = require('../services/catalogAudit');
  if (!process.env.MONGO_URI) throw new Error('Set MONGO_URI in backend/.env');
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
    const [restaurants, dishes] = await Promise.all([
      mongoose.connection.db.collection('restaurants').find({}, { projection: { name: 1, address: 1, latitude: 1, longitude: 1, cuisineType: 1, rating: 1, imageUrl: 1 } }).toArray(),
      mongoose.connection.db.collection('dishes').find({}, { projection: { restaurantId: 1, name: 1, description: 1, category: 1, price: 1, averageRating: 1, imageUrl: 1 } }).toArray()
    ]);
    console.log(JSON.stringify(auditCatalog(restaurants, dishes), null, 2));
  } finally { await mongoose.disconnect(); }
}
main().catch(() => { console.error('Catalog audit failed. Check database connectivity and configuration.'); process.exitCode = 1; });
