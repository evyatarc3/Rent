import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { Listing } from '../db/database';
import { geocodeAddress } from '../services/geocoding';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const YAD2_RENT_URL = 'https://www.yad2.co.il/realestate/rent';

// ── Find Chrome on user's system ──

function findChromePath(): string {
  const possiblePaths = [
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
    // Windows (WSL/common)
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];

  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {}
  }

  // Try to find via `which`
  try {
    const found = execSync('which google-chrome || which chromium-browser || which chromium 2>/dev/null', { encoding: 'utf8' }).trim();
    if (found) return found;
  } catch {}

  throw new Error(
    '[Yad2] Chrome/Chromium not found. Install Google Chrome or set CHROME_PATH environment variable.'
  );
}

// ── Yad2 data interfaces (from __NEXT_DATA__) ──

interface Yad2Address {
  region?: { text: string };
  city?: { text: string };
  area?: { text: string };
  neighborhood?: { text: string };
  street?: { text: string };
  house?: { number?: number; floor?: number };
  coords?: { lat: number; lon: number };
}

interface Yad2FeedItem {
  address: Yad2Address;
  adType?: string;
  price?: number;
  token: string;
  additionalDetails?: {
    property?: { text: string };
    roomsCount?: number;
    squareMeter?: number;
  };
  metaData?: {
    coverImage?: string;
    images?: string[];
  };
  tags?: { name: string }[];
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
  const addr = item.address || ({} as Yad2Address);
  const address = buildAddress(addr);
  const price = item.price;
  const rooms = item.additionalDetails?.roomsCount;

  if (!address || !price || price <= 0) return null;

  const imageUrl =
    item.metaData?.coverImage || item.metaData?.images?.[0];

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
    rooms: rooms || 0,
    floor: addr.house?.floor ?? undefined,
    size_sqm: item.additionalDetails?.squareMeter ?? undefined,
    contact_info: `https://www.yad2.co.il/item/${item.token}`,
    description,
    image_url: imageUrl || undefined,
    source_url: `https://www.yad2.co.il/item/${item.token}`,
    lat: addr.coords?.lat || undefined,
    lng: addr.coords?.lon || undefined,
  };
}

// ── Extract feed data from page via Puppeteer ──

async function extractFeedFromPage(page: Page): Promise<Yad2FeedData | null> {
  try {
    const feedData = await page.evaluate(() => {
      const el = document.getElementById('__NEXT_DATA__');
      if (!el) return null;

      try {
        const nextData = JSON.parse(el.textContent || '');
        const queries = nextData?.props?.pageProps?.dehydratedState?.queries;
        if (!Array.isArray(queries)) return null;

        for (const q of queries) {
          const key = JSON.stringify(q.queryKey || '');
          if (key.includes('realestate-rent-feed')) {
            return q.state?.data || null;
          }
        }
      } catch {
        return null;
      }
      return null;
    });

    return feedData as Yad2FeedData | null;
  } catch (e: any) {
    console.error('[Yad2] Error extracting feed from page:', e.message);
    return null;
  }
}

// ── Main scraper ──

export async function scrapeYad2(
  options: { pages?: number; geocode?: boolean } = {}
): Promise<Listing[]> {
  const { pages = 3, geocode = false } = options;
  const allListings: Listing[] = [];
  const seenTokens = new Set<string>();

  const chromePath = process.env.CHROME_PATH || findChromePath();
  console.log(`[Yad2] Using Chrome at: ${chromePath}`);
  console.log(`[Yad2] Starting scrape for Jerusalem rentals (${pages} pages)...`);

  let browser: Browser | null = null;

  try {
    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1920,1080',
      ],
    });

    const page = await browser.newPage();

    // Set a realistic viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );

    // Set Hebrew language
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
    });

    for (let pageNum = 1; pageNum <= pages; pageNum++) {
      try {
        const url = `${YAD2_RENT_URL}?city=3000&page=${pageNum}`;
        console.log(`[Yad2] Fetching page ${pageNum}/${pages}: ${url}`);

        await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: 30000,
        });

        // Wait a moment for any dynamic content
        await new Promise((r) => setTimeout(r, 2000));

        const feed = await extractFeedFromPage(page);
        if (!feed) {
          console.warn(`[Yad2] Page ${pageNum}: No feed data found`);
          // Take a screenshot for debugging
          const screenshotPath = path.join(__dirname, '..', '..', 'data', `debug-page${pageNum}.png`);
          try {
            const dataDir = path.dirname(screenshotPath);
            if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
            await page.screenshot({ path: screenshotPath });
            console.log(`[Yad2] Debug screenshot saved: ${screenshotPath}`);
          } catch {}
          continue;
        }

        if (pageNum === 1 && feed.pagination) {
          console.log(
            `[Yad2] Total: ${feed.pagination.total} listings across ${feed.pagination.totalPages} pages`
          );
        }

        // Collect from all categories
        const categories: (keyof Yad2FeedData)[] = [
          'private', 'agency', 'yad1', 'platinum',
          'trio', 'booster', 'leadingBroker', 'kingOfTheHar',
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
          `[Yad2] Page ${pageNum}: ${pageCount} new listings (${allListings.length} total)`
        );

        // Rate limit between pages
        if (pageNum < pages) {
          await new Promise((r) => setTimeout(r, 3000));
        }
      } catch (error: any) {
        console.error(`[Yad2] Error on page ${pageNum}:`, error.message);
      }
    }
  } catch (error: any) {
    console.error('[Yad2] Browser error:', error.message);
  } finally {
    if (browser) {
      try { await browser.close(); } catch {}
    }
  }

  // Geocode listings without coordinates (most Yad2 listings already have coords)
  if (geocode) {
    const needGeocode = allListings.filter((l) => !l.lat || !l.lng);
    if (needGeocode.length > 0) {
      console.log(`[Yad2] Geocoding ${needGeocode.length} listings without coordinates...`);
      for (const listing of needGeocode) {
        try {
          const coords = await geocodeAddress(`${listing.address}, ירושלים, ישראל`);
          if (coords) {
            listing.lat = coords.lat;
            listing.lng = coords.lng;
          }
          await new Promise((r) => setTimeout(r, 250));
        } catch (e: any) {
          console.warn(`[Yad2] Geocoding failed for: ${listing.address}`, e.message);
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
