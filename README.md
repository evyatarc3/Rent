# 🏠 מוצא דירה - ירושלים

אפליקציה לאיסוף והצגת דירות להשכרה בירושלים על גבי Google Maps.

## מה האפליקציה עושה?

- **אוספת מודעות** מיד2 (סריקה אוטומטית)
- **מאפשרת הזנה ידנית** של מודעות מפייסבוק ומקורות אחרים
- **מסננת** רק מודעות עם מידע מלא (כתובת, מחיר, חדרים, פרטי קשר)
- **מציגה על המפה** - כל דירה היא נקודה על Google Maps, לחיצה מציגה את הפרטים
- **מאפשרת סינון** לפי מחיר, חדרים, שכונה ומקור

## דרישות מוקדמות

- Node.js 18+
- מפתח Google Maps API (עם Maps JavaScript API + Geocoding API מופעלים)

## התקנה

```bash
# 1. התקנת תלויות
npm run install:all

# 2. הגדרת מפתח Google Maps
# צור קובץ client/.env:
echo "VITE_GOOGLE_MAPS_API_KEY=YOUR_KEY_HERE" > client/.env

# אופציונלי - מפתח לשרת (לshipur geocoding):
echo "GOOGLE_MAPS_API_KEY=YOUR_KEY_HERE" > server/.env

# 3. הפעלה
npm run dev
```

האפליקציה תרוץ על:
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3001

## איך להשיג מפתח Google Maps API

1. היכנס ל-[Google Cloud Console](https://console.cloud.google.com)
2. צור פרויקט חדש (או בחר קיים)
3. לך ל-APIs & Services > Library
4. הפעל את **Maps JavaScript API** ו-**Geocoding API**
5. לך ל-APIs & Services > Credentials
6. צור API Key

## שימוש

### סריקת יד2
לחץ על כפתור "סרוק יד2" בסרגל הצד. האפליקציה תסרוק מודעות דירות להשכרה בירושלים, תסנן מודעות עם מידע חלקי, ותציג את התוצאות על המפה.

### הוספת מודעה ידנית (מפייסבוק/מקורות אחרים)
לחץ על "+ הוסף מודעה" ומלא את הפרטים. שדות חובה:
- כתובת (רחוב ומספר)
- מחיר
- מספר חדרים
- טלפון ליצירת קשר

הכתובת תתורגם אוטומטית לקואורדינטות ותוצג על המפה.

### סינון
השתמש בפאנל הסינון כדי לסנן לפי:
- טווח מחירים
- מספר חדרים
- שכונה
- מקור (יד2 / פייסבוק / ידני)

### צבעי הנקודות על המפה
- 🔴 אדום = יד2
- 🔵 כחול = פייסבוק
- 🟢 ירוק = הזנה ידנית

## ארכיטקטורה

```
├── client/              # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/  # Map, Sidebar, Filters, AddListingForm, ListingCard
│   │   ├── services/    # API client
│   │   └── types/       # TypeScript interfaces
│   └── ...
├── server/              # Express + TypeScript
│   ├── src/
│   │   ├── db/          # SQLite database
│   │   ├── scrapers/    # Yad2 scraper
│   │   ├── services/    # Geocoding service
│   │   ├── routes/      # REST API routes
│   │   └── utils/       # Utilities
│   └── ...
└── package.json         # Root monorepo scripts
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/listings` | קבלת כל המודעות (עם פילטרים) |
| GET | `/api/listings/:id` | מודעה בודדת |
| POST | `/api/listings` | הוספת מודעה ידנית |
| DELETE | `/api/listings/:id` | מחיקת מודעה |
| POST | `/api/scrape/yad2/sync` | סריקת יד2 |
| POST | `/api/geocode` | המרת כתובת לקואורדינטות |
| GET | `/api/stats` | סטטיסטיקות |
