import { useState, useEffect, useCallback } from 'react';
import Map from './components/Map';
import Sidebar from './components/Sidebar';
import AddListingForm from './components/AddListingForm';
import { fetchListings, removeListing, scrapeYad2 } from './services/api';
import { Listing, ListingFilters } from './types/listing';
import './App.css';

// Google Maps API key - set via environment variable
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

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

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="setup-screen">
        <div className="setup-card">
          <h1>🏠 מוצא דירה - ירושלים</h1>
          <h2>הגדרה ראשונית</h2>
          <p>כדי להשתמש באפליקציה, צריך מפתח Google Maps API.</p>
          <div className="setup-steps">
            <h3>שלבים:</h3>
            <ol>
              <li>
                היכנס ל-
                <a href="https://console.cloud.google.com/google/maps-apis" target="_blank" rel="noopener noreferrer">
                  Google Cloud Console
                </a>
              </li>
              <li>צור פרויקט חדש (או השתמש בקיים)</li>
              <li>הפעל את Maps JavaScript API ו-Geocoding API</li>
              <li>צור מפתח API</li>
              <li>
                צור קובץ <code>.env</code> בתיקיית <code>client/</code> עם:
                <pre>VITE_GOOGLE_MAPS_API_KEY=your_key_here</pre>
              </li>
              <li>הפעל מחדש את השרת</li>
            </ol>
          </div>
          <p className="setup-note">
            💡 אפשר גם להגדיר <code>GOOGLE_MAPS_API_KEY</code> בתיקיית <code>server/.env</code> לשיפור ה-geocoding.
          </p>
        </div>
      </div>
    );
  }

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
          apiKey={GOOGLE_MAPS_API_KEY}
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
