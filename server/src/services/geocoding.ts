import axios from 'axios';

const GOOGLE_GEOCODING_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

// Nominatim (OpenStreetMap) as a free fallback
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

interface GeocodingResult {
  lat: number;
  lng: number;
}

let googleApiKey: string | undefined;

export function setGoogleApiKey(key: string) {
  googleApiKey = key;
}

/**
 * Geocode an address to lat/lng coordinates.
 * Uses Google Geocoding API if key is available, otherwise falls back to Nominatim.
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  if (googleApiKey) {
    return geocodeWithGoogle(address);
  }
  return geocodeWithNominatim(address);
}

async function geocodeWithGoogle(address: string): Promise<GeocodingResult | null> {
  try {
    const response = await axios.get(GOOGLE_GEOCODING_URL, {
      params: {
        address,
        key: googleApiKey,
        language: 'he',
        region: 'il',
      },
      timeout: 10000,
    });

    if (response.data.status === 'OK' && response.data.results.length > 0) {
      const location = response.data.results[0].geometry.location;
      return { lat: location.lat, lng: location.lng };
    }

    console.warn(`[Geocoding/Google] No results for: ${address} (status: ${response.data.status})`);
    return null;
  } catch (error: any) {
    console.error(`[Geocoding/Google] Error for "${address}":`, error.message);
    return null;
  }
}

async function geocodeWithNominatim(address: string): Promise<GeocodingResult | null> {
  try {
    const response = await axios.get(NOMINATIM_URL, {
      params: {
        q: address,
        format: 'json',
        limit: 1,
        countrycodes: 'il',
        'accept-language': 'he',
      },
      headers: {
        'User-Agent': 'JerusalemRentFinder/1.0',
      },
      timeout: 10000,
    });

    if (response.data.length > 0) {
      return {
        lat: parseFloat(response.data[0].lat),
        lng: parseFloat(response.data[0].lon),
      };
    }

    console.warn(`[Geocoding/Nominatim] No results for: ${address}`);
    return null;
  } catch (error: any) {
    console.error(`[Geocoding/Nominatim] Error for "${address}":`, error.message);
    return null;
  }
}

/**
 * Batch geocode multiple addresses
 */
export async function batchGeocode(
  addresses: { id: string; address: string }[]
): Promise<Map<string, GeocodingResult>> {
  const results = new Map<string, GeocodingResult>();
  const delay = googleApiKey ? 100 : 1100; // Nominatim requires 1 req/sec

  for (const { id, address } of addresses) {
    const result = await geocodeAddress(address);
    if (result) {
      results.set(id, result);
    }
    await new Promise((r) => setTimeout(r, delay));
  }

  return results;
}
