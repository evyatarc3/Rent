import { useState, useEffect, useCallback } from 'react';
import Map from './components/Map';
import Sidebar from './components/Sidebar';
import AddListingForm from './components/AddListingForm';
import { fetchListings, removeListing, scrapeYad2 } from './services/api';
import { Listing, ListingFilters } from './types/listing';
import './App.css';

export default function App() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [filters, setFilters] = useState<ListingFilters>({});
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [scrapeMessage, setScrapeMessage] = useState('');

  const loadListings = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await fetchListings(filters);
      setListings(data.listings);
      setError('');
    } catch (err: any) {
      setError('שגיאה בטעינת מודעות');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  const handleScrape = async () => {
    setIsScraping(true);
    setScrapeMessage('');
    try {
      const result = await scrapeYad2(3);
      setScrapeMessage(`נמצאו ${result.count} מודעות חדשות מיד2`);
      await loadListings();
    } catch (err: any) {
      setScrapeMessage('שגיאה בסריקת יד2: ' + (err.message || 'Unknown error'));
    } finally {
      setIsScraping(false);
      setTimeout(() => setScrapeMessage(''), 5000);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await removeListing(id);
      setListings((prev) => prev.filter((l) => l.id !== id));
      if (selectedListing?.id === id) {
        setSelectedListing(null);
      }
    } catch (err) {
      console.error('Error deleting listing:', err);
    }
  };

  return (
    <div className="app">
      <Sidebar
        listings={listings}
        filters={filters}
        onFiltersChange={setFilters}
        selectedListing={selectedListing}
        onSelectListing={setSelectedListing}
        onDeleteListing={handleDelete}
        onAddClick={() => setShowAddForm(true)}
        onScrapeClick={handleScrape}
        isScraping={isScraping}
      />

      <main className="map-container">
        {isLoading && (
          <div className="loading-overlay">
            <div className="spinner" />
            <p>טוען מודעות...</p>
          </div>
        )}

        {scrapeMessage && (
          <div className={`toast ${scrapeMessage.includes('שגיאה') ? 'error' : 'success'}`}>
            {scrapeMessage}
          </div>
        )}

        {error && (
          <div className="toast error">{error}</div>
        )}

        <Map
          listings={listings}
          selectedListing={selectedListing}
          onSelectListing={setSelectedListing}
        />
      </main>

      {showAddForm && (
        <AddListingForm
          onListingAdded={loadListings}
          onClose={() => setShowAddForm(false)}
        />
      )}
    </div>
  );
}
