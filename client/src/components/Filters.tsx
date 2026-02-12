import { useState } from 'react';
import { ListingFilters } from '../types/listing';

interface FiltersProps {
  filters: ListingFilters;
  onFiltersChange: (filters: ListingFilters) => void;
  totalCount: number;
  mapCount: number;
}

export default function Filters({ filters, onFiltersChange, totalCount, mapCount }: FiltersProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const updateFilter = (key: keyof ListingFilters, value: string) => {
    const numValue = value === '' ? undefined : Number(value);
    onFiltersChange({ ...filters, [key]: key === 'neighborhood' || key === 'source' ? (value || undefined) : numValue });
  };

  const clearFilters = () => {
    onFiltersChange({});
  };

  const hasFilters = Object.values(filters).some((v) => v !== undefined);

  return (
    <div className="filters-panel">
      <div className="filters-header" onClick={() => setIsExpanded(!isExpanded)}>
        <h3>
          סינון
          {hasFilters && <span className="filter-badge">פעיל</span>}
        </h3>
        <span className="filters-count">
          {mapCount} על המפה / {totalCount} סה"כ
        </span>
        <button className="toggle-btn">{isExpanded ? '▲' : '▼'}</button>
      </div>

      {isExpanded && (
        <div className="filters-body">
          <div className="filter-row">
            <div className="filter-group">
              <label>מחיר מינימום</label>
              <input
                type="number"
                placeholder="1,000"
                value={filters.minPrice || ''}
                onChange={(e) => updateFilter('minPrice', e.target.value)}
                step={500}
              />
            </div>
            <div className="filter-group">
              <label>מחיר מקסימום</label>
              <input
                type="number"
                placeholder="15,000"
                value={filters.maxPrice || ''}
                onChange={(e) => updateFilter('maxPrice', e.target.value)}
                step={500}
              />
            </div>
          </div>

          <div className="filter-row">
            <div className="filter-group">
              <label>חדרים (מינימום)</label>
              <input
                type="number"
                placeholder="1"
                value={filters.minRooms || ''}
                onChange={(e) => updateFilter('minRooms', e.target.value)}
                min={1}
                max={10}
                step={0.5}
              />
            </div>
            <div className="filter-group">
              <label>חדרים (מקסימום)</label>
              <input
                type="number"
                placeholder="6"
                value={filters.maxRooms || ''}
                onChange={(e) => updateFilter('maxRooms', e.target.value)}
                min={1}
                max={10}
                step={0.5}
              />
            </div>
          </div>

          <div className="filter-row">
            <div className="filter-group">
              <label>שכונה</label>
              <input
                type="text"
                placeholder="למשל: רחביה, בית הכרם..."
                value={filters.neighborhood || ''}
                onChange={(e) => updateFilter('neighborhood', e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label>מקור</label>
              <select
                value={filters.source || ''}
                onChange={(e) => updateFilter('source', e.target.value)}
              >
                <option value="">הכל</option>
                <option value="yad2">יד2</option>
                <option value="facebook">פייסבוק</option>
                <option value="manual">ידני</option>
              </select>
            </div>
          </div>

          {hasFilters && (
            <button className="clear-filters-btn" onClick={clearFilters}>
              נקה סינונים
            </button>
          )}
        </div>
      )}
    </div>
  );
}
