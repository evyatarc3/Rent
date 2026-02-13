import express from 'express';
import cors from 'cors';
import listingsRouter from './routes/listings';
import { setGoogleApiKey } from './services/geocoding';
import { getDb } from './db/database';

const app = express();
const PORT = process.env.PORT || 3001;

// Set Google API key if available
if (process.env.GOOGLE_MAPS_API_KEY) {
  setGoogleApiKey(process.env.GOOGLE_MAPS_API_KEY);
  console.log('[Server] Google Maps API key configured');
} else {
  console.log('[Server] No Google Maps API key found - using Nominatim (OSM) for geocoding');
}

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', listingsRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize database and start server
getDb();
console.log('[Server] Database initialized');

app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
  console.log(`[Server] API docs:`);
  console.log(`  GET  /api/listings          - Get all listings (with filters)`);
  console.log(`  GET  /api/listings/:id       - Get single listing`);
  console.log(`  POST /api/listings           - Add manual listing`);
  console.log(`  DELETE /api/listings/:id      - Remove listing`);
  console.log(`  POST /api/scrape/yad2/sync   - Scrape Yad2 listings`);
  console.log(`  POST /api/geocode            - Geocode an address`);
  console.log(`  GET  /api/stats              - Get statistics`);
});
