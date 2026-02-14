import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { Listing } from '../db/database';
import { geocodeAddress } from '../services/geocoding';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const YAD2_RENT_URL = 'https://www.yad2.co.il/realestate/rent';

// Persistent Chrome profile directory — cookies survive between runs
// so the user only needs to solve captcha ONCE
const CHROME_PROFILE_DIR = path.join(__dirname, '..', '..', 'data', 'chrome-profile');

// ── Find Chrome on user's system ──

function findChromePath(): string {
  const possiblePaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];

  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {}
  }

  try {
    const found = execSync('which google-chrome || which chromium-browser || which chromium 2>/dev/null', { encoding: 'utf8' }).trim();
    if (found) return found;
  } catch {}

  throw new Error('[Yad2] Chrome not found. Install Google Chrome or set CHROME_PATH env var.');
}

// ── Yad2 data interfaces ──

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

  const imageUrl = item.metaData?.coverImage || item.metaData?.images?.[0];
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
    contact_name: undefined,
    contact_phone: undefined,
    contact_info: `https://www.yad2.co.il/item/${item.token}`,
    description,
    image_url: imageUrl || undefined,
    source_url: `https://www.yad2.co.il/item/${item.token}`,
    lat: addr.coords?.lat || undefined,
    lng: addr.coords?.lon || undefined,
    entry_date: undefined,
    available_date: undefined,
  };
}

// ── Anti-detection stealth ──

async function applyStealthToPage(page: Page): Promise<void> {
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    (window as any).chrome = { runtime: {}, loadTimes: () => {}, csi: () => {}, app: {} };
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['he-IL', 'he', 'en-US', 'en'] });
  });
}

// ── Check if page has captcha ──

async function hasCaptcha(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const text = document.body?.innerText || '';
    return text.includes('Are you for real') || text.includes('captcha') ||
      !!document.querySelector('iframe[src*="hcaptcha"]') ||
      !!document.querySelector('.captcha');
  });
}

// ── Wait for user to solve captcha ──

async function waitForCaptchaSolved(page: Page): Promise<void> {
  console.log('[Yad2] ⚠️  CAPTCHA detected! A Chrome window should be open.');
  console.log('[Yad2] ⚠️  Please solve the captcha in the browser window, then the scraping will continue automatically.');
  console.log('[Yad2] ⏳ Waiting for captcha to be solved (up to 2 minutes)...');

  const startTime = Date.now();
  const timeout = 120000; // 2 minutes

  while (Date.now() - startTime < timeout) {
    await new Promise((r) => setTimeout(r, 2000));

    const stillCaptcha = await hasCaptcha(page);
    if (!stillCaptcha) {
      console.log('[Yad2] ✅ Captcha solved! Continuing scraping...');
      // Wait a bit more for the page to fully load after captcha
      await new Promise((r) => setTimeout(r, 3000));
      return;
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    if (elapsed % 10 === 0) {
      console.log(`[Yad2] ⏳ Still waiting for captcha... (${elapsed}s)`);
    }
  }

  throw new Error('Captcha was not solved within 2 minutes');
}

// ── Extract feed data from page ──

async function extractFeedFromPage(page: Page): Promise<Yad2FeedData | null> {
  try {
    const result = await page.evaluate(() => {
      const el = document.getElementById('__NEXT_DATA__');
      if (!el) {
        return { error: 'no_next_data', title: document.title, url: window.location.href };
      }
      try {
        const nextData = JSON.parse(el.textContent || '');
        const queries = nextData?.props?.pageProps?.dehydratedState?.queries;
        if (!Array.isArray(queries)) return { error: 'no_queries' };

        for (const q of queries) {
          const key = JSON.stringify(q.queryKey || '');
          if (key.includes('realestate-rent-feed')) {
            return { feed: q.state?.data || null };
          }
        }
        return { error: 'no_feed_query' };
      } catch (e: any) {
        return { error: 'parse_error', message: e.message };
      }
    });

    if (result && 'feed' in result && result.feed) {
      return result.feed as Yad2FeedData;
    }
    if (result && 'error' in result) {
      console.warn(`[Yad2] Page debug:`, JSON.stringify(result));
    }
    return null;
  } catch (e: any) {
    console.error('[Yad2] Error extracting feed:', e.message);
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

  // Ensure Chrome profile directory exists
  if (!fs.existsSync(CHROME_PROFILE_DIR)) {
    fs.mkdirSync(CHROME_PROFILE_DIR, { recursive: true });
  }

  let browser: Browser | null = null;

  try {
    // Launch Chrome in VISIBLE mode (not headless) so user can solve captcha if needed
    // Uses a persistent profile so captcha cookies are saved between runs
    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: false, // VISIBLE — user needs to solve captcha
      userDataDir: CHROME_PROFILE_DIR, // persistent cookies
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--window-size=1280,900',
        '--lang=he-IL',
      ],
      defaultViewport: { width: 1280, height: 900 },
    });

    const page = await browser.newPage();
    await applyStealthToPage(page);

    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
    });

    let captchaSolvedOnce = false;

    for (let pageNum = 1; pageNum <= pages; pageNum++) {
      try {
        const url = `${YAD2_RENT_URL}?city=3000&page=${pageNum}`;
        console.log(`[Yad2] Fetching page ${pageNum}/${pages}: ${url}`);

        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });

        // Wait for page to load
        await new Promise((r) => setTimeout(r, 3000));

        // Check for captcha
        const captchaDetected = await hasCaptcha(page);
        if (captchaDetected) {
          await waitForCaptchaSolved(page);
          captchaSolvedOnce = true;

          // After captcha solved, the page should have reloaded
          // Check if we're on the actual listings page now
          const stillNeedNavigate = await hasCaptcha(page);
          if (stillNeedNavigate) {
            // Navigate again after captcha
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await new Promise((r) => setTimeout(r, 3000));
          }
        }

        // Wait for __NEXT_DATA__
        try {
          await page.waitForSelector('#__NEXT_DATA__', { timeout: 10000 });
        } catch {
          console.warn(`[Yad2] Page ${pageNum}: __NEXT_DATA__ not found after 10s`);
        }

        await new Promise((r) => setTimeout(r, 1000));

        const feed = await extractFeedFromPage(page);
        if (!feed) {
          console.warn(`[Yad2] Page ${pageNum}: No feed data found`);
          continue;
        }

        if (pageNum === 1 && feed.pagination) {
          console.log(
            `[Yad2] Total: ${feed.pagination.total} listings across ${feed.pagination.totalPages} pages`
          );
        }

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

        // Rate limit
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

  // Geocode listings without coordinates
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
