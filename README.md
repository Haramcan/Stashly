# TCG Sammlung

Offline-Web-App (PWA) zum Verwalten einer Sammelkarten-Sammlung: **Dragon Ball Super Fusion World**, **One Piece Card Game** und **Pokémon TCG**.

- Kartendatenbanken mit Bildern für alle Sets (`data/*.json`, erzeugt mit `tools/build_data.py`)
- Scanner mit Texterkennung im Browser (Tesseract.js, offline) und optionaler KI-Erkennung (Claude API, eigener Schlüssel)
- Sammlung, Sets mit Fortschritt und Binder-Ansicht, gegradete Karten, Wunsch- und Tauschliste, Statistik, Sicherung, CSV-Export

Keine Build-Schritte, kein Server: Ordner auf einen beliebigen statischen Host (z. B. Netlify Drop) legen.
Anleitung auf Deutsch: [ANLEITUNG.md](ANLEITUNG.md).

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html`, `css/app.css` | Oberfläche |
| `js/app.js` | Ansichten und Navigation |
| `js/catalog.js` | Kartendatenbank, Suche, Bild-URLs |
| `js/recognize.js` | Texterkennung und Abgleich (Kartennummer, Name, Grading-Etikett) |
| `js/scan.js` | Kamera und Trefferauswahl |
| `js/ai.js` | Optionale KI-Erkennung |
| `js/db.js` | IndexedDB (Sammlung, Fotos, Einstellungen, Sicherung) |
| `sw.js` | Service Worker (offline), Dateiliste per `tools/build_sw.py` |
| `tools/build_data.py` | Lädt die Kartendaten neu |
