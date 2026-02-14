import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Listing } from '../types/listing';

const JERUSALEM_CENTER: [number, number] = [31.7683, 35.2137];

function formatPrice(price: number): string {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(price);
}

function createColoredIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: 24px;
      height: 24px;
      background: ${color};
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  });
}

function getMarkerIcon(source: string): L.DivIcon {
  switch (source) {
    case 'yad2':
      return createColoredIcon('#e53935');
    case 'facebook':
      return createColoredIcon('#1877f2');
    case 'manual':
      return createColoredIcon('#4caf50');
    default:
      return createColoredIcon('#fbc02d');
  }
}

interface MapProps {
  listings: Listing[];
  selectedListing: Listing | null;
  onSelectListing: (listing: Listing | null) => void;
}

function MapController({ selectedListing }: { selectedListing: Listing | null }) {
  const map = useMap();

  useEffect(() => {
    if (selectedListing?.lat && selectedListing?.lng) {
      map.flyTo([selectedListing.lat, selectedListing.lng], 16, { duration: 0.8 });
    }
  }, [selectedListing, map]);

  return null;
}

export default function Map({ listings, selectedListing, onSelectListing }: MapProps) {
  const markerRefs = useRef<Record<string, L.Marker>>({});

  useEffect(() => {
    if (selectedListing && markerRefs.current[selectedListing.id]) {
      markerRefs.current[selectedListing.id].openPopup();
    }
  }, [selectedListing]);

  const mappableListings = listings.filter((l) => l.lat && l.lng);

  return (
    <MapContainer
      center={JERUSALEM_CENTER}
      zoom={13}
      style={{ width: '100%', height: '100%' }}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapController selectedListing={selectedListing} />

      {mappableListings.map((listing) => (
        <Marker
          key={listing.id}
          position={[listing.lat!, listing.lng!]}
          icon={getMarkerIcon(listing.source)}
          ref={(ref) => {
            if (ref) markerRefs.current[listing.id] = ref;
          }}
          eventHandlers={{
            click: () => onSelectListing(listing),
          }}
        >
          <Popup maxWidth={280} onClose={() => onSelectListing(null)}>
            <div style={{ direction: 'rtl', fontFamily: 'Heebo, sans-serif', padding: 4 }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>
                {formatPrice(listing.price)} | {listing.rooms} חדרים
              </h3>
              <p style={{ margin: '0 0 4px', fontSize: 14, color: '#333' }}>
                📍 {listing.address}
              </p>
              {listing.floor !== undefined && listing.floor !== null && (
                <p style={{ margin: '0 0 4px', fontSize: 13, color: '#555' }}>
                  קומה {listing.floor}
                </p>
              )}
              {listing.size_sqm && (
                <p style={{ margin: '0 0 4px', fontSize: 13, color: '#555' }}>
                  {listing.size_sqm} מ"ר
                </p>
              )}
              <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '8px 0' }} />
              <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 500 }}>
                📞 {listing.contact_info}
              </p>
              {listing.description && (
                <p style={{ margin: '8px 0 4px', fontSize: 12, color: '#666', maxHeight: 60, overflow: 'hidden' }}>
                  {listing.description}
                </p>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 8, fontSize: 12 }}>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: 12,
                  background: listing.source === 'yad2' ? '#ff6b35' : listing.source === 'facebook' ? '#1877f2' : '#4caf50',
                  color: 'white',
                }}>
                  {listing.source === 'yad2' ? 'יד2' : listing.source === 'facebook' ? 'פייסבוק' : 'ידני'}
                </span>
                {listing.source_url && (
                  <a
                    href={listing.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#1a73e8', textDecoration: 'none' }}
                  >
                    צפה במודעה המקורית ←
                  </a>
                )}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
