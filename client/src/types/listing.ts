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

export interface ListingFilters {
  minPrice?: number;
  maxPrice?: number;
  minRooms?: number;
  maxRooms?: number;
  neighborhood?: string;
  source?: string;
}

export interface Stats {
  total: number;
  bySource: { source: string; count: number }[];
  avgPrice: number;
  priceRange: { min: number; max: number };
}
