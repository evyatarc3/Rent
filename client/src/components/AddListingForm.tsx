import { useState } from 'react';
import { createListing } from '../services/api';

interface AddListingFormProps {
  onListingAdded: () => void;
  onClose: () => void;
}

export default function AddListingForm({ onListingAdded, onClose }: AddListingFormProps) {
  const [formData, setFormData] = useState({
    address: '',
    neighborhood: '',
    price: '',
    rooms: '',
    floor: '',
    size_sqm: '',
    contact_name: '',
    contact_phone: '',
    description: '',
    source_url: '',
    source: 'facebook',
    available_date: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.address || !formData.price || !formData.rooms || !formData.contact_phone) {
      setError('יש למלא: כתובת, מחיר, מספר חדרים, וטלפון ליצירת קשר');
      return;
    }

    setIsSubmitting(true);
    try {
      await createListing({
        ...formData,
        price: Number(formData.price),
        rooms: Number(formData.rooms),
        floor: formData.floor ? Number(formData.floor) : undefined,
        size_sqm: formData.size_sqm ? Number(formData.size_sqm) : undefined,
        contact_info: formData.contact_phone
          ? `${formData.contact_name ? formData.contact_name + ': ' : ''}${formData.contact_phone}`
          : formData.contact_name || '',
      });
      onListingAdded();
      onClose();
    } catch (err: any) {
      setError(err.message || 'שגיאה בהוספת המודעה');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>הוספת מודעה ידנית</h2>
          <p className="modal-subtitle">להוספת מודעות מפייסבוק או מקורות אחרים</p>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="add-listing-form">
          {error && <div className="form-error">{error}</div>}

          <div className="form-section">
            <h4>מיקום</h4>
            <div className="form-row">
              <div className="form-group full">
                <label>כתובת (רחוב ומספר) *</label>
                <input
                  type="text"
                  placeholder="למשל: רחוב יפו 25"
                  value={formData.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>שכונה</label>
                <input
                  type="text"
                  placeholder="למשל: רחביה"
                  value={formData.neighborhood}
                  onChange={(e) => updateField('neighborhood', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h4>פרטי הדירה</h4>
            <div className="form-row">
              <div className="form-group">
                <label>מחיר (₪) *</label>
                <input
                  type="number"
                  placeholder="5000"
                  value={formData.price}
                  onChange={(e) => updateField('price', e.target.value)}
                  required
                  min={0}
                />
              </div>
              <div className="form-group">
                <label>חדרים *</label>
                <input
                  type="number"
                  placeholder="3"
                  value={formData.rooms}
                  onChange={(e) => updateField('rooms', e.target.value)}
                  required
                  min={1}
                  max={10}
                  step={0.5}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>קומה</label>
                <input
                  type="number"
                  placeholder="2"
                  value={formData.floor}
                  onChange={(e) => updateField('floor', e.target.value)}
                  min={-1}
                  max={50}
                />
              </div>
              <div className="form-group">
                <label>שטח (מ"ר)</label>
                <input
                  type="number"
                  placeholder="75"
                  value={formData.size_sqm}
                  onChange={(e) => updateField('size_sqm', e.target.value)}
                  min={10}
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h4>יצירת קשר</h4>
            <div className="form-row">
              <div className="form-group">
                <label>שם איש קשר</label>
                <input
                  type="text"
                  placeholder="ישראל ישראלי"
                  value={formData.contact_name}
                  onChange={(e) => updateField('contact_name', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>טלפון *</label>
                <input
                  type="tel"
                  placeholder="050-1234567"
                  value={formData.contact_phone}
                  onChange={(e) => updateField('contact_phone', e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h4>פרטים נוספים</h4>
            <div className="form-row">
              <div className="form-group">
                <label>מקור</label>
                <select
                  value={formData.source}
                  onChange={(e) => updateField('source', e.target.value)}
                >
                  <option value="facebook">פייסבוק</option>
                  <option value="manual">ידני</option>
                </select>
              </div>
              <div className="form-group">
                <label>תאריך כניסה</label>
                <input
                  type="date"
                  value={formData.available_date}
                  onChange={(e) => updateField('available_date', e.target.value)}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group full">
                <label>קישור למודעה המקורית</label>
                <input
                  type="url"
                  placeholder="https://facebook.com/..."
                  value={formData.source_url}
                  onChange={(e) => updateField('source_url', e.target.value)}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group full">
                <label>תיאור</label>
                <textarea
                  placeholder="פרטים נוספים על הדירה..."
                  value={formData.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="submit-btn" disabled={isSubmitting}>
              {isSubmitting ? 'מוסיף...' : 'הוסף מודעה'}
            </button>
            <button type="button" className="cancel-btn" onClick={onClose}>
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
