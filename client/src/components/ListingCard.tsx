import { Listing } from '../types/listing';

interface ListingCardProps {
  listing: Listing;
  isSelected: boolean;
  onSelect: (listing: Listing) => void;
  onDelete: (id: string) => void;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(price);
}

function sourceLabel(source: string): string {
  switch (source) {
    case 'yad2': return 'יד2';
    case 'facebook': return 'פייסבוק';
    case 'manual': return 'ידני';
    default: return source;
  }
}

function sourceColor(source: string): string {
  switch (source) {
    case 'yad2': return '#ff6b35';
    case 'facebook': return '#1877f2';
    case 'manual': return '#4caf50';
    default: return '#888';
  }
}

export default function ListingCard({ listing, isSelected, onSelect, onDelete }: ListingCardProps) {
  return (
    <div
      className={`listing-card ${isSelected ? 'selected' : ''} ${!listing.lat ? 'no-location' : ''}`}
      onClick={() => onSelect(listing)}
    >
      <div className="listing-card-header">
        <span className="listing-price">{formatPrice(listing.price)}</span>
        <span className="listing-rooms">{listing.rooms} חדרים</span>
        <span className="listing-source" style={{ background: sourceColor(listing.source) }}>
          {sourceLabel(listing.source)}
        </span>
      </div>

      <div className="listing-card-body">
        <p className="listing-address">📍 {listing.address}</p>

        <div className="listing-details">
          {listing.floor !== undefined && listing.floor !== null && (
            <span>קומה {listing.floor}</span>
          )}
          {listing.size_sqm && <span>{listing.size_sqm} מ"ר</span>}
          {listing.neighborhood && <span>{listing.neighborhood}</span>}
        </div>

        <p className="listing-contact">📞 {listing.contact_info}</p>

        {!listing.lat && (
          <p className="listing-warning">⚠️ לא נמצא מיקום - לא מוצג במפה</p>
        )}
      </div>

      <div className="listing-card-footer">
        {listing.source_url && (
          <a
            href={listing.source_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            צפה במודעה ←
          </a>
        )}
        <button
          className="delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(listing.id);
          }}
          title="הסר מודעה"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
