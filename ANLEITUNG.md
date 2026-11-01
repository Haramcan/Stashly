# TCG Sammlung – Anleitung

Deine Sammel-App für **Dragon Ball Super Fusion World**, **One Piece Card Game** und **Pokémon TCG**.
Sie ist eine eigene App und hat nichts mit Stashly zu tun – eigene Adresse, eigenes Symbol, eigene Daten.
Alles läuft offline auf deinem Handy, deine Sammlung bleibt auf deinem Gerät.

## Was drin ist

- **Komplette Kartendatenbanken** (Stand 01.11.2026)
  - Dragon Ball Fusion World: 31 Sets, 4.365 Karten – FB01 bis FB11, Manga Booster SB01/SB02, Story Booster ST01, alle Starter Decks FS01–FS12, Promos und Release-Event-Packs, inkl. aller Parallel-Versionen
  - One Piece: 61 Sets, 4.945 Karten – OP-01 bis OP-17, EB-01 bis EB-05, PRB-01/02, alle Starter Decks ST-01 bis ST-36, Promos, inkl. Parallels und Reprints
  - Pokémon: 205 Sets, 21.256 Karten – von Base Set bis Mega-Entwicklung, mit deutschen Namen
  - Zu jeder Karte das offizielle Kartenbild, Nummer, Seltenheit, Typ und Farbe
- **Scanner**: Karte fotografieren → die App liest die Kartennummer (z. B. `FB01-139`, `OP05-119`, `025/165`) und den Namen und schlägt die Karte vor. Komplett offline, ohne KI-Dienst.
- **Serien-Scan**: Karte für Karte auslösen, „+1“ legt sie ab, die Kamera ist sofort wieder bereit – ideal nach dem Booster-Öffnen.
- **Sets mit Fortschritt**: Jedes Set als Kartenraster oder **Binder-Ansicht** (9er-Seiten), fehlende Karten grau. Filter: habe ich / fehlen / Parallel / Seltenheit.
- **Abhak-Modus**: Im Set einfach Karten antippen = +1. So ist ein ganzes Set in Minuten eingetragen.
- **Gegradete Karten**: PSA, BGS, CGC, TAG, SGC, ACE … mit Note, Zertifikatsnummer und eigenem Foto vom Slab. Der Scanner erkennt Grading-Etiketten oft automatisch.
- **Pro Exemplar**: Anzahl, Version (Holo, Reverse, Foil …), Zustand (MT bis PO), Sprache, Kaufpreis, Kaufdatum, Wert, Lagerort (Binder, Box …), Notizen, eigene Fotos.
- **Preise**: One Piece mit TCGplayer-Marktpreisen, Pokémon-Preise von Cardmarket per Knopfdruck (online), dazu Links zu Cardmarket und „eBay verkauft“ für jede Karte.
- **Wunschliste**, **Tauschliste** (doppelte Karten), **Statistik** (Gesamtwert, Gewinn/Verlust, wertvollste Karten, Set-Fortschritt), **Suche** über alle 30.000 Karten.
- **Sicherung** als Datei (mit Fotos) und **CSV-Export** für Excel.
- **Optional KI-Erkennung** mit eigenem Claude-API-Schlüssel: erkennt auch mehrere Karten auf einem Foto (z. B. eine ganze Binder-Seite) und Slabs.

## 1. App online stellen (einmalig, ca. 5 Minuten)

Damit das Handy die App installieren kann, muss sie einmal unter einer https-Adresse erreichbar sein. Am einfachsten mit Netlify – genau wie bei Stashly, aber als **neue, eigene Seite**:

1. Lade die App von GitHub herunter: Im Repository oben den Branch **`claude/tcg-sammlung`** auswählen, dann **Code › Download ZIP** und die ZIP-Datei entpacken.
2. Öffne am PC **https://app.netlify.com/drop** (eingeloggt mit deinem Netlify-Konto).
3. Ziehe den entpackten Ordner (der Ordner, in dem `index.html` liegt) in das Feld.
   Wichtig: Das legt eine **neue Seite** an. Deine Stashly-Seite bleibt unverändert.
4. Unter *Site configuration › Change site name* einen Namen vergeben, z. B. `tcg-sammlung-deinname`.
   **Ändere die Adresse danach nicht mehr**, denn deine Daten gehören fest zu dieser Adresse.

## 2. Aufs Handy installieren

- **iPhone**: Adresse in **Safari** öffnen → **Teilen** → **Zum Home-Bildschirm**. Danach immer über das neue Symbol starten.
- **Android**: Adresse in **Chrome** öffnen → Menü (⋮) → **App installieren** bzw. **Zum Startbildschirm hinzufügen**.

Beim ersten Start einmal im WLAN unter **Mehr › Sicherung & Export › Scanner offline vorbereiten** tippen (lädt die Texterkennung, ca. 11 MB). Danach brauchst du für den Scanner kein Internet mehr.

Kartenbilder werden beim Anschauen automatisch gespeichert. Ein ganzes Set holst du über **Set öffnen › Regler-Symbol › Bilder für offline speichern**.

## 3. Tipps zum Scannen

- Karte gerade und formatfüllend in den Rahmen, gutes Licht, keine Spiegelung (Hülle/Toploader möglichst schräg zum Licht halten).
- Oben das Spiel auswählen (Dragon Ball / One Piece / Pokémon) – das macht die Erkennung schneller und genauer.
- Bei Parallel-Versionen zeigt die App alle Versionen mit derselben Nummer nebeneinander – tippe die richtige an.
- Nicht erkannt? Im Ergebnis einfach Name oder Nummer eintippen.

## 4. Sicherung – wichtig!

Die Daten liegen nur auf dem Handy. Mach regelmäßig unter **Mehr › Sicherung & Export › Sicherung erstellen** eine Sicherung und speichere sie in iCloud Drive oder Google Drive. Die App erinnert dich, wenn die letzte Sicherung über 30 Tage alt ist.

## 5. Updates und neue Sets

- **Pokémon**: Neue Sets holt die App selbst: **Mehr › Sicherung & Export › Neue Pokémon-Sets online suchen**.
- **Dragon Ball / One Piece** (und alles andere): Die Datenbank wird mit einem Skript neu von den offiziellen Kartenlisten geladen:
  ```
  python3 tools/build_data.py
  python3 tools/build_sw.py
  ```
  Danach den Ordner wieder bei Netlify hochladen (Site › *Deploys* › Ordner hineinziehen). Die App zeigt dann „Neue Version verfügbar“ → **Neu laden**. Deine Sammlung bleibt erhalten.

## Zum Testen am PC

Im Ordner `python3 -m http.server 8080` starten und `http://localhost:8080` öffnen.

## Datenquellen

- Dragon Ball Super Card Game Fusion World: offizielle Kartenliste dbs-cardgame.com/fw
- One Piece Card Game: offizielle Kartenliste en.onepiece-cardgame.com, Preise von optcgapi.com (TCGplayer)
- Pokémon TCG: TCGdex (tcgdex.dev), Preise von Cardmarket über TCGdex

Kartenbilder und Namen gehören den jeweiligen Rechteinhabern (Bandai, Toei, Shueisha, Bird Studio, The Pokémon Company, Nintendo). Diese App ist ein privates Sammlerwerkzeug und keine offizielle App.
