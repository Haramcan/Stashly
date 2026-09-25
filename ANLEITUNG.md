# Wo ist was – Anleitung

Dein Haushalts-Inventar als App fürs iPhone. Sie läuft komplett offline, und alle Daten bleiben auf deinem Gerät.

## 1. App online stellen (einmalig, ca. 5 Minuten)

Damit das iPhone die App installieren kann, muss sie einmal unter einer https-Adresse erreichbar sein. Das geht kostenlos, zum Beispiel mit Netlify:

1. Öffne am PC **https://app.netlify.com/drop**.
2. Ziehe den ganzen Ordner **offline-app** in das Feld auf der Seite.
3. Lege den kostenlosen Account an, wenn Netlify danach fragt. Ohne Account wird die Seite nach kurzer Zeit wieder gelöscht.
4. Du bekommst eine Adresse wie `https://irgendwas-123.netlify.app`. Unter *Site configuration › Change site name* kannst du den Namen ändern, z. B. `wo-ist-was-deinname`. **Ändere die Adresse danach nicht mehr**, denn deine Daten gehören auf dem iPhone fest zu dieser Adresse.

GitHub Pages oder Cloudflare Pages funktionieren genauso. Wichtig ist nur, dass es eine https-Adresse ist.

## 2. Auf dem iPhone installieren

1. Öffne die Adresse in **Safari**. Andere Browser können auf dem iPhone keine Apps installieren.
2. Tippe auf **Teilen** (Quadrat mit Pfeil) und dann auf **Zum Home-Bildschirm**.
3. Starte die App ab jetzt immer über das Symbol auf dem Home-Bildschirm.

Einträge in Safari und in der installierten App sind getrennt. Installiere die App deshalb, bevor du Gegenstände erfasst.

Nach dem ersten Start speichert die App alles für den Offline-Betrieb, auch die Bilderkennung (ca. 16 MB). Mach das am besten im WLAN. Danach brauchst du kein Internet mehr.

## 3. Was die App kann

- **Gegenstände mit Foto erfassen.** Die Bilderkennung schlägt einen Namen vor. Sie läuft auf dem iPhone, ohne Internet und ohne KI-Dienst.
- **Viele Fotos auf einmal:** Jedes Foto wird ein eigener Gegenstand. So erfasst du ein Regal in einem Rutsch.
- **Räume › Möbel › Kisten › Fächer**, beliebig verschachtelt, mit Nummern wie K1 oder M2.
- **QR-Etiketten:** Druck sie aus und kleb sie auf die Kisten. Über das Scan-Symbol oben rechts öffnet die App den Inhalt der Kiste.
- **Suche mit Fragen** wie „Wo ist das Ladekabel?“ oder „was liegt im Keller“. Sie versteht Tippfehler und ähnliche Wörter.
- **Fällig:** Ablaufdaten, Wartungen, Garantien, Einkaufsliste und verliehene Sachen.
- **Belege:** Rechnungen und Anleitungen als Foto oder PDF, dazu die Seriennummer.
- **Bericht für die Versicherung** als PDF mit Fotos und Werten.
- **Aussortieren** mit Anzeigentext, **Umzug** mit Kisten und Zielräumen, **Mehrfachauswahl**, **Verlauf** pro Gegenstand.

## 4. Erinnerungen aufs iPhone

Web-Apps dürfen sich auf dem iPhone keine Mitteilungen für später stellen. Das erlaubt Apple nur mit einem eigenen Server. Die App trägt die Termine deshalb in deinen **iPhone-Kalender** ein, und der Kalender erinnert dich, auch offline:

1. Tippe in **Fällig** auf **„Termine übernehmen“**.
2. Wähle im Teilen-Menü **„In Dateien sichern“**.
3. Öffne die Datei in der **Dateien**-App und tippe auf **„Alle hinzufügen“**. Am besten legst du dafür einen eigenen Kalender „Wo ist was“ an.
4. Kommt keine Erinnerung? Stell unter *Einstellungen › Apps › Kalender › Standard-Erinnerungen* bei „Ganztägige Ereignisse“ eine Uhrzeit ein.

Die App merkt sich, welche Termine schon exportiert sind. Beim nächsten Mal kommen nur neue dazu.

Zusätzlich kann die App eine **Zahl am App-Symbol** zeigen (Fällig › „Zahl am App-Symbol aktivieren“). Die Zahl wird aktualisiert, wenn du die App öffnest.

## 5. Sicherung – wichtig!

Die Daten liegen nur auf dem iPhone. Mach regelmäßig unter **Mehr › Sicherung erstellen** eine ZIP-Sicherung und speichere sie in iCloud Drive. Die App erinnert dich, wenn die letzte Sicherung über 30 Tage alt ist. Mit **Sicherung einspielen** holst du alles zurück, auch auf einem neuen iPhone.

## 6. Daten aus der claude.ai-Version übernehmen

In der alten Version unter Übersicht auf **„Als JSON sichern“** tippen. Die Datei dann in dieser App unter **Mehr › Sicherung einspielen › Hinzufügen** auswählen. Fotos kann die alte Version nicht exportieren, die musst du neu aufnehmen.

## 7. Updates

Wenn die App geändert wurde:

1. Am PC in PowerShell im Ordner `offline-app` ausführen:
   `powershell -ExecutionPolicy Bypass -File tools\build-sw.ps1`
2. Den Ordner wieder bei Netlify hochladen (Site › *Deploys* › Ordner hineinziehen).
3. Die App auf dem iPhone zeigt dann „Eine neue Version ist da“. Tippe auf „Neu laden“. Deine Daten bleiben erhalten.

## Zum Testen am PC

`powershell -ExecutionPolicy Bypass -File tools\serve.ps1` starten und `http://localhost:8080` öffnen.
