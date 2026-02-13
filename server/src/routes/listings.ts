import { Router, Request, Response } from 'express';
import { v4 } from '../utils/uuid';
import {
  getListings,
  getListingById,
  insertListing,
  insertListings,
  deleteListing,
  getStats,
  Listing,
  ListingFilters,
} from '../db/database';
import { scrapeYad2 } from '../scrapers/yad2';
import { geocodeAddress } from '../services/geocoding';

const router = Router();

// GET /api/listings - Get all listings with optional filters
router.get('/listings', (req: Request, res: Response) => {
  try {
    const filters: ListingFilters = {
      minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
      maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
      minRooms: req.query.minRooms ? Number(req.query.minRooms) : undefined,
      maxRooms: req.query.maxRooms ? Number(req.query.maxRooms) : undefined,
      neighborhood: req.query.neighborhood as string | undefined,
      source: req.query.source as string | undefined,
    };

    const listings = getListings(filters);
    res.json({ listings, count: listings.length });
  } catch (error: any) {
    console.error('Error fetching listings:', error);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

// GET /api/listings/:id - Get a single listing
router.get('/listings/:id', (req: Request, res: Response) => {
  try {
    const listing = getListingById(req.params.id);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    res.json(listing);
  } catch (error: any) {
    console.error('Error fetching listing:', error);
    res.status(500).json({ error: 'Failed to fetch listing' });
  }
});

// POST /api/listings - Add a manual listing (for Facebook listings etc.)
router.post('/listings', async (req: Request, res: Response) => {
  try {
    const {
      address,
      street,
      neighborhood,
      price,
      rooms,
      floor,
      size_sqm,
      contact_name,
      contact_phone,
      contact_info,
      description,
      image_url,
      source_url,
      source,
      available_date,
    } = req.body;

    // Validate required fields
    if (!address || !price || !rooms || !contact_info) {
      return res.status(400).json({
        error: 'Missing required fields: address, price, rooms, contact_info',
      });
    }

    // Geocode the address
    let lat: number | undefined;
    let lng: number | undefined;
    try {
      const coords = await geocodeAddress(`${address}, ירושלים, ישראל`);
      if (coords) {
        lat = coords.lat;
        lng = coords.lng;
      }
    } catch (e) {
      console.warn('Geocoding failed for manual listing:', address);
    }

    const listing: Listing = {
      id: `manual_${v4()}`,
      source: source || 'manual',
      title: `${rooms} חדרים - ${address}`,
      address,
      street,
      neighborhood,
      city: 'ירושלים',
      price: Number(price),
      rooms: Number(rooms),
      floor: floor ? Number(floor) : undefined,
      size_sqm: size_sqm ? Number(size_sqm) : undefined,
      contact_name,
      contact_phone,
      contact_info: contact_info || contact_phone || contact_name,
      description,
      image_url,
      source_url,
      lat,
      lng,
      available_date,
    };

    insertListing(listing);
    res.status(201).json(listing);
  } catch (error: any) {
    console.error('Error creating listing:', error);
    res.status(500).json({ error: 'Failed to create listing' });
  }
});

// DELETE /api/listings/:id - Soft delete a listing
router.delete('/listings/:id', (req: Request, res: Response) => {
  try {
    deleteListing(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting listing:', error);
    res.status(500).json({ error: 'Failed to delete listing' });
  }
});

// POST /api/scrape/yad2 - Trigger Yad2 scraping
router.post('/scrape/yad2', async (_req: Request, res: Response) => {
  try {
    res.json({ message: 'Scraping started', status: 'in_progress' });
    // Note: Scraping happens async. In a production app, we'd use a job queue.
  } catch (error: any) {
    console.error('Error starting scrape:', error);
    res.status(500).json({ error: 'Failed to start scraping' });
  }
});

// POST /api/scrape/yad2/sync - Synchronous Yad2 scraping (waits for completion)
router.post('/scrape/yad2/sync', async (req: Request, res: Response) => {
  try {
    const pages = req.body.pages || 3;
    console.log(`[API] Starting Yad2 scrape (${pages} pages)...`);

    const listings = await scrapeYad2({ pages, geocode: true });

    if (listings.length > 0) {
      const count = insertListings(listings);
      res.json({
        message: 'Scraping complete',
        count,
        total: listings.length,
      });
    } else {
      res.json({ message: 'No valid listings found', count: 0 });
    }
  } catch (error: any) {
    console.error('Error during scraping:', error);
    res.status(500).json({ error: 'Scraping failed: ' + error.message });
  }
});

// GET /api/stats - Get statistics
router.get('/stats', (_req: Request, res: Response) => {
  try {
    const stats = getStats();
    res.json(stats);
  } catch (error: any) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// POST /api/geocode - Geocode a single address
router.post('/geocode', async (req: Request, res: Response) => {
  try {
    const { address } = req.body;
    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    const coords = await geocodeAddress(`${address}, ירושלים, ישראל`);
    if (coords) {
      res.json(coords);
    } else {
      res.status(404).json({ error: 'Could not geocode address' });
    }
  } catch (error: any) {
    console.error('Error geocoding:', error);
    res.status(500).json({ error: 'Geocoding failed' });
  }
});

export default router;
