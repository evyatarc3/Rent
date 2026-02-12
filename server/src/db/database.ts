import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'listings.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initDb();
  }
  return db;
}

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      source_id TEXT,
      title TEXT,
      address TEXT NOT NULL,
      street TEXT,
      neighborhood TEXT,
      city TEXT DEFAULT 'ירושלים',
      price INTEGER NOT NULL,
      rooms REAL NOT NULL,
      floor INTEGER,
      size_sqm INTEGER,
      contact_name TEXT,
      contact_phone TEXT,
      contact_info TEXT NOT NULL,
      description TEXT,
      image_url TEXT,
      source_url TEXT,
      lat REAL,
      lng REAL,
      entry_date TEXT,
      available_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      is_active INTEGER DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_listings_source ON listings(source);
    CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(price);
    CREATE INDEX IF NOT EXISTS idx_listings_rooms ON listings(rooms);
    CREATE INDEX IF NOT EXISTS idx_listings_active ON listings(is_active);
    CREATE INDEX IF NOT EXISTS idx_listings_location ON listings(lat, lng);
  `);
}

export interface Listing {
  id: string;
  source: string;
  source_id?: string;
  title?: string;
  address: string;
  street?: string;
  neighborhood?: string;
  city?: string;
  price: number;
  rooms: number;
  floor?: number;
  size_sqm?: number;
  contact_name?: string;
  contact_phone?: string;
  contact_info: string;
  description?: string;
  image_url?: string;
  source_url?: string;
  lat?: number;
  lng?: number;
  entry_date?: string;
  available_date?: string;
  created_at?: string;
  updated_at?: string;
  is_active?: number;
}

export function insertListing(listing: Listing): void {
  const stmt = getDb().prepare(`
    INSERT OR REPLACE INTO listings
    (id, source, source_id, title, address, street, neighborhood, city,
     price, rooms, floor, size_sqm, contact_name, contact_phone, contact_info,
     description, image_url, source_url, lat, lng, entry_date, available_date, updated_at)
    VALUES
    (@id, @source, @source_id, @title, @address, @street, @neighborhood, @city,
     @price, @rooms, @floor, @size_sqm, @contact_name, @contact_phone, @contact_info,
     @description, @image_url, @source_url, @lat, @lng, @entry_date, @available_date, datetime('now'))
  `);
  stmt.run(listing);
}

export function insertListings(listings: Listing[]): number {
  const insert = getDb().transaction((items: Listing[]) => {
    let count = 0;
    for (const listing of items) {
      insertListing(listing);
      count++;
    }
    return count;
  });
  return insert(listings);
}

export interface ListingFilters {
  minPrice?: number;
  maxPrice?: number;
  minRooms?: number;
  maxRooms?: number;
  neighborhood?: string;
  source?: string;
}

export function getListings(filters: ListingFilters = {}): Listing[] {
  let query = 'SELECT * FROM listings WHERE is_active = 1';
  const params: Record<string, any> = {};

  if (filters.minPrice) {
    query += ' AND price >= @minPrice';
    params.minPrice = filters.minPrice;
  }
  if (filters.maxPrice) {
    query += ' AND price <= @maxPrice';
    params.maxPrice = filters.maxPrice;
  }
  if (filters.minRooms) {
    query += ' AND rooms >= @minRooms';
    params.minRooms = filters.minRooms;
  }
  if (filters.maxRooms) {
    query += ' AND rooms <= @maxRooms';
    params.maxRooms = filters.maxRooms;
  }
  if (filters.neighborhood) {
    query += ' AND neighborhood LIKE @neighborhood';
    params.neighborhood = `%${filters.neighborhood}%`;
  }
  if (filters.source) {
    query += ' AND source = @source';
    params.source = filters.source;
  }

  query += ' ORDER BY updated_at DESC';

  return getDb().prepare(query).all(params) as Listing[];
}

export function getListingById(id: string): Listing | undefined {
  return getDb().prepare('SELECT * FROM listings WHERE id = ?').get(id) as Listing | undefined;
}

export function deleteListing(id: string): void {
  getDb().prepare('UPDATE listings SET is_active = 0 WHERE id = ?').run(id);
}

export function getStats() {
  const db = getDb();
  return {
    total: (db.prepare('SELECT COUNT(*) as count FROM listings WHERE is_active = 1').get() as any).count,
    bySource: db.prepare('SELECT source, COUNT(*) as count FROM listings WHERE is_active = 1 GROUP BY source').all(),
    avgPrice: (db.prepare('SELECT AVG(price) as avg FROM listings WHERE is_active = 1').get() as any).avg,
    priceRange: db.prepare('SELECT MIN(price) as min, MAX(price) as max FROM listings WHERE is_active = 1').get(),
  };
}
