import axios from 'axios';
import { Listing } from '../db/database';
import { geocodeAddress } from '../services/geocoding';

const YAD2_BASE_URL = 'https://www.yad2.co.il/realestate/rent';

// ── Yad2 Next.js SSR data interfaces ──

interface Yad2Address {
  region?: { text: string };
  city?: { text: string };
  area?: { text: string };
  neighborhood?: { text: string };
  street?: { text: string };
  house?: { number?: number; floor?: number };
  coords?: { lat: number; lon: number };
}

interface Yad2AdditionalDetails {
  property?: { text: string };
  roomsCount?: number;
  squareMeter?: number;
  propertyCondition?: { id: number };
}

interface Yad2MetaData {
  coverImage?: string;
  images?: string[];
}

interface Yad2Tag {
  name: string;
  id: number;
  priority: number;
}

interface Yad2FeedItem {
  address: Yad2Address;
  subcategoryId?: number;
  categoryId?: number;
  adType?: string;
  price?: number;
  token: string;
  additionalDetails?: Yad2AdditionalDetails;
  metaData?: Yad2MetaData;
  tags?: Yad2Tag[];
  orderId?: number;
  priority?: number;
  [key: string]: any;
}

interface Yad2FeedData {
  private?: Yad2FeedItem[];
  agency?: Yad2FeedItem[];
  yad1?: Yad2FeedItem[];
  platinum?: Yad2FeedItem[];
  kingOfTheHar?: Yad2FeedItem[];
  trio?: Yad2FeedItem[];
  booster?: Yad2FeedItem[];
  leadingBroker?: Yad2FeedItem[];
  pagination?: { total: number; totalPages: number };
  lookalike?: Yad2FeedItem[];
}

// ── Conversion helpers ──

function buildAddress(addr: Yad2Address): string {
  const parts: string[] = [];
  if (addr.street?.text) parts.push(addr.street.text);
  if (addr.house?.number) parts.push(String(addr.house.number));
  if (addr.neighborhood?.text) parts.push(addr.neighborhood.text);
  if (addr.city?.text) parts.push(addr.city.text);
  return parts.join(', ') || '';
}

function feedItemToListing(item: Yad2FeedItem): Listing | null {
  const addr = item.address || {};
  const address = buildAddress(addr);
  const price = item.price;
  const rooms = item.additionalDetails?.roomsCount;

  // Must have at least address, price, and rooms
  if (!address || !price || price <= 0 || !rooms || rooms <= 0) return null;

  const imageUrl =
    item.metaData?.coverImage || (item.metaData?.images && item.metaData.images[0]);

  const propertyType = item.additionalDetails?.property?.text || '';
  const tags = (item.tags || []).map((t) => t.name).join(', ');
  const description = [propertyType, tags].filter(Boolean).join(' | ') || undefined;

  return {
    id: `yad2_${item.token}`,
    source: 'yad2',
    source_id: item.token,
    title: `${propertyType || 'דירה'} - ${addr.street?.text || addr.neighborhood?.text || address}`,
    address,
    street: addr.street?.text || undefined,
    neighborhood: addr.neighborhood?.text || undefined,
    city: addr.city?.text || 'ירושלים',
    price,
    rooms,
    floor: addr.house?.floor ?? undefined,
    size_sqm: item.additionalDetails?.squareMeter ?? undefined,
    contact_info: `yad2.co.il/item/${item.token}`,
    description,
    image_url: imageUrl || undefined,
    source_url: `https://www.yad2.co.il/item/${item.token}`,
    lat: addr.coords?.lat || undefined,
    lng: addr.coords?.lon || undefined,
  };
}

// ── HTML parsing: extract __NEXT_DATA__ ──

function extractNextData(html: string): any | null {
  // Look for the __NEXT_DATA__ script tag
  const marker = '<script id="__NEXT_DATA__" type="application/json">';
  const startIdx = html.indexOf(marker);
  if (startIdx === -1) {
    console.warn('[Yad2] Could not find __NEXT_DATA__ in HTML');
    return null;
  }

  const jsonStart = startIdx + marker.length;
  const jsonEnd = html.indexOf('</script>', jsonStart);
  if (jsonEnd === -1) {
    console.warn('[Yad2] Could not find closing </script> for __NEXT_DATA__');
    return null;
  }

  try {
    return JSON.parse(html.substring(jsonStart, jsonEnd));
  } catch (e: any) {
    console.error('[Yad2] Failed to parse __NEXT_DATA__ JSON:', e.message);
    return null;
  }
}

function extractFeedFromNextData(nextData: any): Yad2FeedData | null {
  const queries = nextData?.props?.pageProps?.dehydratedState?.queries;
  if (!Array.isArray(queries)) return null;

  for (const q of queries) {
    const key = JSON.stringify(q.queryKey || '');
    if (key.includes('realestate-rent-feed')) {
      return q.state?.data as Yad2FeedData;
    }
  }

  return null;
}

// ── Main scraper ──

export async function scrapeYad2(
  options: { pages?: number; geocode?: boolean } = {}
): Promise<Listing[]> {
  const { pages = 3, geocode = false } = options;
  const allListings: Listing[] = [];
  const seenTokens = new Set<string>();

  console.log(`[Yad2] Starting scrape for Jerusalem rentals (${pages} pages)...`);

  for (let page = 1; page <= pages; page++) {
    try {
      console.log(`[Yad2] Fetching page ${page}/${pages}...`);

      const url = `${YAD2_BASE_URL}?city=3000&page=${page}`;
      const response = await axios.get(url, {
        headers: {
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Cache-Control': 'no-cache',
        },
        timeout: 20000,
        maxRedirects: 5,
      });

      const html: string = response.data;
      const nextData = extractNextData(html);
      if (!nextData) {
        console.warn(`[Yad2] Page ${page}: No __NEXT_DATA__ found, skipping`);
        continue;
      }

      const feed = extractFeedFromNextData(nextData);
      if (!feed) {
        console.warn(`[Yad2] Page ${page}: No feed data found in __NEXT_DATA__`);
        continue;
      }

      if (page === 1 && feed.pagination) {
        console.log(
          `[Yad2] Total listings available: ${feed.pagination.total} across ${feed.pagination.totalPages} pages`
        );
      }

      // Collect items from all feed categories
      const categories: (keyof Yad2FeedData)[] = [
        'private',
        'agency',
        'yad1',
        'platinum',
        'trio',
        'booster',
        'leadingBroker',
        'kingOfTheHar',
      ];

      let pageCount = 0;
      for (const cat of categories) {
        const items = feed[cat];
        if (!Array.isArray(items)) continue;

        for (const item of items as Yad2FeedItem[]) {
          if (!item.token || seenTokens.has(item.token)) continue;
          seenTokens.add(item.token);

          const listing = feedItemToListing(item);
          if (listing) {
            allListings.push(listing);
            pageCount++;
          }
        }
      }

      console.log(
        `[Yad2] Page ${page}: ${pageCount} new listings (${allListings.length} total)`
      );

      // Respect rate limits between pages
      if (page < pages) {
        await new Promise((r) => setTimeout(r, 2500));
      }
    } catch (error: any) {
      if (error.response) {
        console.error(
          `[Yad2] Error page ${page}: HTTP ${error.response.status} - ${error.response.statusText}`
        );
      } else {
        console.error(`[Yad2] Error page ${page}:`, error.message);
      }
      // Continue to next page on error
    }
  }

  // Geocode listings that don't already have coordinates from Yad2
  if (geocode) {
    const needGeocode = allListings.filter((l) => !l.lat || !l.lng);
    if (needGeocode.length > 0) {
      console.log(
        `[Yad2] Geocoding ${needGeocode.length} listings without coordinates...`
      );
      for (const listing of needGeocode) {
        try {
          const coords = await geocodeAddress(
            `${listing.address}, ירושלים, ישראל`
          );
          if (coords) {
            listing.lat = coords.lat;
            listing.lng = coords.lng;
          }
          await new Promise((r) => setTimeout(r, 250));
        } catch (e: any) {
          console.warn(
            `[Yad2] Geocoding failed for: ${listing.address}`,
            e.message
          );
        }
      }
    }
  }

  const withCoords = allListings.filter((l) => l.lat && l.lng).length;
  console.log(
    `[Yad2] Scrape complete. ${allListings.length} listings found (${withCoords} with coordinates).`
  );
  return allListings;
}
