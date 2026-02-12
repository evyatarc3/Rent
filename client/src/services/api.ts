import { Listing, ListingFilters, Stats } from '../types/listing';

const API_BASE = '/api';

export async function fetchListings(filters?: ListingFilters): Promise<{ listings: Listing[]; count: number }> {
  const params = new URLSearchParams();
  if (filters?.minPrice) params.set('minPrice', String(filters.minPrice));
  if (filters?.maxPrice) params.set('maxPrice', String(filters.maxPrice));
  if (filters?.minRooms) params.set('minRooms', String(filters.minRooms));
  if (filters?.maxRooms) params.set('maxRooms', String(filters.maxRooms));
  if (filters?.neighborhood) params.set('neighborhood', filters.neighborhood);
  if (filters?.source) params.set('source', filters.source);

  const res = await fetch(`${API_BASE}/listings?${params}`);
  if (!res.ok) throw new Error('Failed to fetch listings');
  return res.json();
}

export async function fetchListing(id: string): Promise<Listing> {
  const res = await fetch(`${API_BASE}/listings/${id}`);
  if (!res.ok) throw new Error('Failed to fetch listing');
  return res.json();
}

export async function createListing(data: Partial<Listing>): Promise<Listing> {
  const res = await fetch(`${API_BASE}/listings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create listing');
  }
  return res.json();
}

export async function removeListing(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/listings/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete listing');
}

export async function scrapeYad2(pages: number = 3): Promise<{ message: string; count: number }> {
  const res = await fetch(`${API_BASE}/scrape/yad2/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pages }),
  });
  if (!res.ok) throw new Error('Scraping failed');
  return res.json();
}

export async function fetchStats(): Promise<Stats> {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}
