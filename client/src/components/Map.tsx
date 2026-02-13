import { useCallback, useState, useRef, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF } from '@react-google-maps/api';
import { Listing } from '../types/listing';

const JERUSALEM_CENTER = { lat: 31.7683, lng: 35.2137 };

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
};

interface MapProps {
  listings: Listing[];
  selectedListing: Listing | null;
  onSelectListing: (listing: Listing | null) => void;
  apiKey: string;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(price);
}

function getMarkerIcon(source: string): string {
  switch (source) {
    case 'yad2':
      return 'https://maps.google.com/mapfiles/ms/icons/red-dot.png';
    case 'facebook':
      return 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png';
    case 'manual':
      return 'https://maps.google.com/mapfiles/ms/icons/green-dot.png';
    default:
      return 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png';
  }
}

export default function Map({ listings, selectedListing, onSelectListing, apiKey }: MapProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    language: 'he',
    region: 'IL',
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const [activeMarker, setActiveMarker] = useState<string | null>(null);

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // Pan to selected listing
  useEffect(() => {
    if (selectedListing?.lat && selectedListing?.lng && mapRef.current) {
      mapRef.current.panTo({ lat: selectedListing.lat, lng: selectedListing.lng });
      mapRef.current.setZoom(16);
      setActiveMarker(selectedListing.id);
    }
  }, [selectedListing]);

  const handleMarkerClick = (listing: Listing) => {
    setActiveMarker(listing.id);
    onSelectListing(listing);
  };

  if (loadError) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#f0f0f0' }}>
        <div style={{ textAlign: 'center', padding: 20 }}>
          <h3>שגיאה בטעינת המפה</h3>
          <p>בדוק שהזנת מפתח Google Maps API תקין</p>
          <p style={{ fontSize: 12, color: '#888' }}>{loadError.message}</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#f0f0f0' }}>
        <p>טוען מפה...</p>
      </div>
    );
  }

  const mappableListings = listings.filter((l) => l.lat && l.lng);

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={JERUSALEM_CENTER}
      zoom={13}
      options={mapOptions}
      onLoad={onLoad}
      onClick={() => {
        setActiveMarker(null);
        onSelectListing(null);
      }}
    >
      {mappableListings.map((listing) => (
        <MarkerF
          key={listing.id}
          position={{ lat: listing.lat!, lng: listing.lng! }}
          icon={getMarkerIcon(listing.source)}
          title={`${formatPrice(listing.price)} - ${listing.rooms} חדרים`}
          onClick={() => handleMarkerClick(listing)}
        >
          {activeMarker === listing.id && (
            <InfoWindowF
              position={{ lat: listing.lat!, lng: listing.lng! }}
              onCloseClick={() => {
                setActiveMarker(null);
                onSelectListing(null);
              }}
            >
              <div style={{ direction: 'rtl', fontFamily: 'Heebo, sans-serif', maxWidth: 280, padding: 4 }}>
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
            </InfoWindowF>
          )}
        </MarkerF>
      ))}
    </GoogleMap>
  );
}
