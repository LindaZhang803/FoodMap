function bad(message) { const error = new Error(message); error.status = 400; throw error; }
function parseCatalogQuery(query = {}) {
  const text = name => {
    if (query[name] === undefined) return '';
    if (typeof query[name] !== 'string' || query[name].length > 120) bad('Invalid ' + name);
    return query[name].trim().toLowerCase();
  };
  const number = (name, min, max) => {
    const value = query[name];
    if (value === undefined) return null;
    if (typeof value !== 'string' || !/^-?\d+(\.\d+)?$/.test(value) || !Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max) bad('Invalid ' + name);
    return Number(value);
  };
  const q = text('q'), cuisine = text('cuisine');
  const minPrice = number('minPrice', 0, Number.MAX_SAFE_INTEGER);
  const maxPrice = number('maxPrice', 0, Number.MAX_SAFE_INTEGER);
  const minRating = number('minRating', 0, 5);
  const latitude = number('latitude', -90, 90), longitude = number('longitude', -180, 180);
  const maxDistance = number('maxDistance', 0, 40075);
  const sort = query.sort === undefined ? 'default' : query.sort;
  if (typeof sort !== 'string' || !['default', 'name', 'highestRated', 'distance'].includes(sort)) bad('Invalid restaurant sort');
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) bad('Minimum price exceeds maximum price');
  if ((latitude === null) !== (longitude === null)) bad('Provide both latitude and longitude');
  if ((maxDistance !== null || sort === 'distance') && latitude === null) bad('Location required for distance filtering or sorting');
  return { q, cuisine, minPrice, maxPrice, minRating, latitude, longitude, maxDistance, sort };
}
const knownNumber = n => typeof n === 'number' && Number.isFinite(n);
function distanceKm(a, b, c, d) {
  const rad = n => n * Math.PI / 180;
  const h = Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
function filterCatalog(records, options, dishRestaurantIds = new Set()) {
  const { q, cuisine, minPrice, maxPrice, minRating, latitude, longitude, maxDistance, sort } = options;
  const normalized = value => String(value || '').trim().toLowerCase();
  const distanceRequested = maxDistance !== null || sort === 'distance';
  const rows = [];
  for (const record of records) {
    const r = typeof record.toObject === 'function' ? record.toObject() : { ...record };
    if (q && !normalized(r.name).includes(q) && !normalized(r.cuisineType).includes(q) && !dishRestaurantIds.has(String(r._id))) continue;
    if (cuisine && normalized(r.cuisineType) !== cuisine) continue;
    if (minRating !== null && (!knownNumber(r.rating) || r.rating < minRating)) continue;
    // Use overlap semantics for known restaurant price ranges; missing bounds are unknown.
    if ((minPrice !== null || maxPrice !== null) && (!knownNumber(r.minPrice) || !knownNumber(r.maxPrice) || r.minPrice < 0 || r.maxPrice < r.minPrice)) continue;
    if (minPrice !== null && r.maxPrice < minPrice) continue;
    if (maxPrice !== null && r.minPrice > maxPrice) continue;
    if (distanceRequested) {
      if (!knownNumber(r.latitude) || !knownNumber(r.longitude) || Math.abs(r.latitude) > 90 || Math.abs(r.longitude) > 180) continue;
      r.distanceKm = distanceKm(latitude, longitude, r.latitude, r.longitude);
      if (maxDistance !== null && r.distanceKm > maxDistance) continue;
    }
    rows.push(r);
  }
  const tie = (a, b) => String(a._id).localeCompare(String(b._id));
  if (sort === 'name') rows.sort((a, b) => normalized(a.name).localeCompare(normalized(b.name)) || tie(a, b));
  if (sort === 'highestRated') rows.sort((a, b) => (knownNumber(b.rating) ? b.rating : -1) - (knownNumber(a.rating) ? a.rating : -1) || tie(a, b));
  if (sort === 'distance') rows.sort((a, b) => a.distanceKm - b.distanceKm || tie(a, b));
  return rows;
}
module.exports = { parseCatalogQuery, filterCatalog, distanceKm };
