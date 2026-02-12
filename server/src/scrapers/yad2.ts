import axios from 'axios';
import { Listing } from '../db/database';
import { geocodeAddress } from '../services/geocoding';

const YAD2_API_BASE = 'https://gw.yad2.co.il/feed-search-legacy/realestate/rent';

interface Yad2Response {
  data: {
    feed: {
      feed_items: Yad2Item[];
      current_page: number;
      total_pages: number;
    };
  };
}

interface Yad2Item {
  id: string;
  title_1?: string;
  title_2?: string;
  address?: string; // sometimes present directly
  street?: string;
  neighborhood?: string;
  city?: string;
  price?: string;
  rooms?: number;
  floor?: number;
  square_meters?: number;
  contact_name?: string;
  contact_phone?: string;
  line_1?: string;
  line_2?: string;
  line_3?: string;
  row_1?: string;
  row_2?: string;
  row_3?: string;
  row_4?: string;
  images_urls?: string[];
  img_url?: string;
  link_token?: string;
  date?: string;
  date_added?: string;
  type?: string;
  feed_source?: string;
  // Additional fields from different API versions
  [key: string]: any;
}

function parsePrice(priceStr?: string): number | null {
  if (!priceStr) return null;
  const cleaned = priceStr.replace(/[^\d]/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

function extractAddress(item: Yad2Item): string {
  // Try multiple fields to get the best address
  if (item.address) return item.address;

  const parts: string[] = [];
  if (item.street) parts.push(item.street);
  if (item.neighborhood) parts.push(item.neighborhood);
  if (item.city) parts.push(item.city);

  if (parts.length > 0) return parts.join(', ');

  // Fallback to row/line/title fields
  if (item.row_1) return item.row_1;
  if (item.line_1) return item.line_1;
  if (item.title_1) return item.title_1;

  return '';
}

function extractContactInfo(item: Yad2Item): { name?: string; phone?: string; info: string } {
  const name = item.contact_name;
  const phone = item.contact_phone;

  if (name && phone) return { name, phone, info: `${name}: ${phone}` };
  if (phone) return { phone, info: phone };
  if (name) return { name, info: name };

  return { info: `yad2.co.il/item/${item.id}` };
}

function extractRooms(item: Yad2Item): number | null {
  if (item.rooms) return item.rooms;

  // Try to extract from row fields
  for (const key of ['row_2', 'row_3', 'line_2', 'line_3']) {
    const val = item[key];
    if (typeof val === 'string') {
      const match = val.match(/(\d+\.?\d*)\s*חדר/);
      if (match) return parseFloat(match[1]);
    }
  }
  return null;
}

function isValidListing(item: Yad2Item): boolean {
  // Filter: must have address (at least street), price, rooms, and contact info
  const address = extractAddress(item);
  const price = parsePrice(item.price);
  const rooms = extractRooms(item);
  const contact = extractContactInfo(item);

  const hasAddress = address.length > 0 && (!!item.street || address.length > 5);
  const hasPrice = price !== null && price > 0;
  const hasRooms = rooms !== null && rooms > 0;
  const hasContact = contact.info.length > 0;

  return hasAddress && hasPrice && hasRooms && hasContact;
}

function yad2ItemToListing(item: Yad2Item): Listing | null {
  if (!isValidListing(item)) return null;

  const address = extractAddress(item);
  const price = parsePrice(item.price);
  const rooms = extractRooms(item);
  const contact = extractContactInfo(item);

  if (!price || !rooms) return null;

  const imageUrl = item.img_url || (item.images_urls && item.images_urls[0]);

  return {
    id: `yad2_${item.id}`,
    source: 'yad2',
    source_id: item.id,
    title: item.title_1 || item.title_2 || address,
    address,
    street: item.street || undefined,
    neighborhood: item.neighborhood || undefined,
    city: item.city || 'ירושלים',
    price,
    rooms,
    floor: item.floor,
    size_sqm: item.square_meters,
    contact_name: contact.name,
    contact_phone: contact.phone,
    contact_info: contact.info,
    description: item.title_2 || item.row_4 || undefined,
    image_url: imageUrl,
    source_url: item.link_token
      ? `https://www.yad2.co.il/item/${item.link_token}`
      : `https://www.yad2.co.il/item/${item.id}`,
    entry_date: item.date_added || item.date,
  };
}

export async function scrapeYad2(
  options: { pages?: number; geocode?: boolean } = {}
): Promise<Listing[]> {
  const { pages = 3, geocode = true } = options;
  const allListings: Listing[] = [];

  console.log(`[Yad2] Starting scrape for Jerusalem rentals (${pages} pages)...`);

  for (let page = 1; page <= pages; page++) {
    try {
      console.log(`[Yad2] Fetching page ${page}/${pages}...`);

      const response = await axios.get<Yad2Response>(YAD2_API_BASE, {
        params: {
          city: 3000,       // Jerusalem city code in Yad2
          property: 1,      // Apartments
          page,
        },
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        timeout: 15000,
      });

      const feedItems = response.data?.data?.feed?.feed_items || [];
      console.log(`[Yad2] Page ${page}: Got ${feedItems.length} raw items`);

      // Filter out ad items and non-listing items
      const realItems = feedItems.filter(
        (item) => item.id && item.type !== 'ad' && item.feed_source !== 'commercial'
      );

      for (const item of realItems) {
        const listing = yad2ItemToListing(item);
        if (listing) {
          allListings.push(listing);
        }
      }

      console.log(`[Yad2] Page ${page}: ${allListings.length} valid listings so far`);

      // Respect rate limits
      if (page < pages) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch (error: any) {
      console.error(`[Yad2] Error fetching page ${page}:`, error.message);
      // Continue to next page on error
    }
  }

  // Geocode addresses that don't have coordinates
  if (geocode) {
    console.log(`[Yad2] Geocoding ${allListings.length} listings...`);
    for (const listing of allListings) {
      if (!listing.lat || !listing.lng) {
        try {
          const coords = await geocodeAddress(`${listing.address}, ירושלים, ישראל`);
          if (coords) {
            listing.lat = coords.lat;
            listing.lng = coords.lng;
          }
          // Rate limit geocoding requests
          await new Promise((r) => setTimeout(r, 200));
        } catch (e: any) {
          console.warn(`[Yad2] Geocoding failed for: ${listing.address}`, e.message);
        }
      }
    }
  }

  console.log(`[Yad2] Scrape complete. ${allListings.length} valid listings found.`);
  return allListings;
}
