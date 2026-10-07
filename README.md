# Essensplaner

Web-App für Wochenplan, Rezepte, Vorrat und Einkaufsliste. Läuft im Browser und lässt sich auf dem iPhone als App auf den Home-Bildschirm legen. Ohne Server, ohne Konto: Alle Daten liegen lokal auf dem Gerät.

## Funktionen

- **4-Wochen-Plan ab Datum:** trägt alle 28 Tage der Reihe nach ein, auch mitten in der Woche („heute nur Abendessen“).
- **Zufall:** „Freie Abende würfeln“ füllt die Woche ohne Wiederholungen, Mittag sind die Reste. An Sporttagen werden Gerichte mit Tag „Sport“ bevorzugt, ebenso Gerichte, die Reste verwerten. Einzelne Mahlzeiten lassen sich in der Auswahl auswürfeln.
- **Beilagen und Tagesziel:** Nudeln, Reis, Couscous und Kartoffeln pro Portion sind einstellbar (Rezeptzeile „Beilage: Reis“), an Sporttagen gibt es abends mehr. Die Tagessumme enthält Frühstück, Eiweiß-Snack und die Banane vor dem Training und zeigt ✓/↓/↑ gegenüber dem Tagesziel.
- **Plan:** Mittag und Abend pro Tag frei wählen, Portionen anpassen. „Rest für morgen Mittag“ kocht eine Portion mehr und trägt sie automatisch beim nächsten Essen ein. „Woche aus Vorlage füllen“ lädt eine der 4 Wochen aus dem ursprünglichen Plan.
- **Einkauf:** Berechnet alles, was für den gewählten Zeitraum (1–4 Wochen) fehlt: Rezeptzutaten + Wochen-Basics − Vorrat. Sortiert nach Supermarkt-Bereich, Mengen sinnvoll aufgerundet. Export nach Apple Erinnerungen oder in die Zwischenablage.
- **Rezepte:** 30 Rezepte, Suche nach Name oder Zutat, Filter. Mengen skalieren mit den Portionen. Eigene Rezepte anlegen und bearbeiten.
- **Nährwerte:** kcal, Eiweiß, Kohlenhydrate, Fett und Ballaststoffe pro Portion (Richtwerte), Badges „Eiweißreich“ und „Ballaststoffreich“ nach den EU-Grenzwerten für Lebensmittelangaben, Tagessumme im Plan.
- **Haltbarkeit:** Der Plan warnt, wenn frische Zutaten bis zum Kochtag länger liegen, als sie typischerweise halten. „Bleibt übrig“ zeigt, was durch Packungsgrößen übrig bleibt, und schlägt Rezepte vor, die es aufbrauchen.
- **Vorrat:** „Im Blick“ listet Frisches mit geschätztem MHD. Beim Abhaken in der Einkaufsliste merkt sich die App das Kaufdatum. Darunter der Vorrat: Was angehakt ist, wird nicht gekauft. Mit Menge wird nur der fehlende Rest gekauft.
- **Mehr:** Festes Frühstück, Wochen-Basics, Einkaufstag, Sporttage, Kurzbefehl-Name, Export/Import der Daten.

## Lokal ausprobieren

`index.html` im Browser öffnen (Doppelklick) reicht. Für den Offline-Modus braucht es einen kleinen Server:

```
cd Ernaehrungsplaner
python -m http.server 8000
```

Dann <http://localhost:8000> öffnen.

## Aufs iPhone bringen (GitHub Pages, kostenlos)

1. Auf github.com ein neues **öffentliches** Repository anlegen, z. B. `essensplaner`.
2. „Add file“ → „Upload files“ und alle Dateien aus diesem Ordner hochladen.
3. Im Repository: **Settings** → **Pages** → Source „Deploy from a branch“, Branch `main`, Ordner `/ (root)` → Save.
4. Nach etwa einer Minute ist die App unter `https://<dein-name>.github.io/essensplaner/` erreichbar.
5. Auf dem iPhone in **Safari** öffnen → Teilen-Symbol → **Zum Home-Bildschirm**.

Das Repository ist öffentlich, enthält aber nur den Code und die Rezepte. Deine Pläne und dein Vorrat bleiben auf dem Handy.

Updates: geänderte Dateien wieder hochladen. Die App lädt beim nächsten Öffnen die neue Version.

## Apple Erinnerungen: Kurzbefehl einrichten

Einmalig in der App **Kurzbefehle** auf dem iPhone:

1. **+** → Kurzbefehl `Einkauf importieren` nennen (muss zum Namen unter „Mehr“ in der App passen).
2. Aktion **Text teilen** (engl. *Split Text*): Text = *Kurzbefehleingabe*, Trennzeichen = *Neue Zeilen*.
3. Aktion **Wiederholen mit jedem Objekt** (engl. *Repeat with Each*) mit *Geteilter Text*.
4. In die Schleife: **Erinnerung hinzufügen** (engl. *Add New Reminder*), Text = *Wiederholungsobjekt*, Liste = deine Einkaufsliste.

In der App auf „In Erinnerungen“ tippen, dann werden alle offenen Artikel einzeln eingetragen. Ist die Liste in Erinnerungen als Listentyp **Einkaufsliste** angelegt (ab iOS 17), sortiert iOS sie automatisch nach Kategorien.

Ohne Kurzbefehl: „Kopieren“ in der App, dann in Erinnerungen in einen neuen Eintrag einfügen. Jede Zeile wird ein eigener Eintrag.

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html` | Seitengerüst und Navigation |
| `app.js` | Logik und Ansichten (Plan, Einkauf, Rezepte, Vorrat, Einstellungen) |
| `data.js` | Zutatenkatalog mit Supermarkt-Kategorien, Nährwerten, Haltbarkeit und Packungsgrößen, Standardrezepte, Vorlagen, Voreinstellungen |
| `style.css` | Gestaltung (hell/dunkel) |
| `sw.js`, `manifest.webmanifest`, `icon-*.png` | Home-Bildschirm-App und Offline-Modus |

Zutaten werden als Text geschrieben: `Menge Einheit Zutat`, z. B. `120 g Rote Linsen`, `1 Dose Kichererbsen`, `½ Gurke`. Bekannte Einheiten: g, kg, ml, l, Stk, Dose, Bund, EL, TL, Prise, Zehe, Kugel, Packung, Glas, Becher, Scheibe. Neue Zutaten, die nicht im Katalog in `data.js` stehen, landen in der Einkaufsliste unter „Sonstiges“. Für eine feste Kategorie trägst du sie in `KATALOG` ein.

## Ideen für später

- Rezepte per KI erzeugen (z. B. Claude API) mit strukturierter Zutatenliste, damit sie direkt in die Einkaufsliste passen.
- Vorrat mit Mengen, von denen der geplante Verbrauch automatisch abgezogen wird (Reis, Nudeln, Haferflocken).
- Abgleich zwischen Laptop und Handy über einen kleinen Server.
