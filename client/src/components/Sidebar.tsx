import { useState } from 'react';
import { Listing, ListingFilters } from '../types/listing';
import ListingCard from './ListingCard';
import Filters from './Filters';

interface SidebarProps {
  listings: Listing[];
  filters: ListingFilters;
  onFiltersChange: (filters: ListingFilters) => void;
  selectedListing: Listing | null;
  onSelectListing: (listing: Listing | null) => void;
  onDeleteListing: (id: string) => void;
  onAddClick: () => void;
  onScrapeClick: () => void;
  isScraping: boolean;
}

export default function Sidebar({
  listings,
  filters,
  onFiltersChange,
  selectedListing,
  onSelectListing,
  onDeleteListing,
  onAddClick,
  onScrapeClick,
  isScraping,
}: SidebarProps) {
  const [sortBy, setSortBy] = useState<'price-asc' | 'price-desc' | 'date' | 'rooms'>('date');

  const sortedListings = [...listings].sort((a, b) => {
    switch (sortBy) {
      case 'price-asc': return a.price - b.price;
      case 'price-desc': return b.price - a.price;
      case 'rooms': return b.rooms - a.rooms;
      case 'date':
      default: return (b.updated_at || '').localeCompare(a.updated_at || '');
    }
  });

  const mapCount = listings.filter((l) => l.lat && l.lng).length;

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1>🏠 מוצא דירה</h1>
        <p className="subtitle">דירות להשכרה בירושלים</p>
      </div>

      <div className="sidebar-actions">
        <button className="action-btn primary" onClick={onAddClick}>
          + הוסף מודעה
        </button>
        <button
          className="action-btn secondary"
          onClick={onScrapeClick}
          disabled={isScraping}
        >
          {isScraping ? '⏳ סורק...' : '🔍 סרוק יד2'}
        </button>
      </div>

      <Filters
        filters={filters}
        onFiltersChange={onFiltersChange}
        totalCount={listings.length}
        mapCount={mapCount}
      />

      <div className="sort-bar">
        <label>מיון:</label>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
          <option value="date">חדש ביותר</option>
          <option value="price-asc">מחיר: נמוך לגבוה</option>
          <option value="price-desc">מחיר: גבוה לנמוך</option>
          <option value="rooms">מספר חדרים</option>
        </select>
      </div>

      <div className="listings-list">
        {sortedListings.length === 0 ? (
          <div className="empty-state">
            <p>אין מודעות להצגה</p>
            <p className="hint">סרוק את יד2 או הוסף מודעות ידנית</p>
          </div>
        ) : (
          sortedListings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              isSelected={selectedListing?.id === listing.id}
              onSelect={onSelectListing}
              onDelete={onDeleteListing}
            />
          ))
        )}
      </div>

      <div className="sidebar-footer">
        <div className="legend">
          <span className="legend-item"><span className="dot red" /> יד2</span>
          <span className="legend-item"><span className="dot blue" /> פייסבוק</span>
          <span className="legend-item"><span className="dot green" /> ידני</span>
        </div>
      </div>
    </div>
  );
}
