// Sucht auf Wikimedia Commons frei lizenzierte Fotos je Gericht und lädt Vorschauen zur Auswahl herunter.
// Aufruf: node fotos-suchen.js <suchbegriffe.json> <zielordner>
//   suchbegriffe.json: { "rezept-id": ["Begriff 1", "Begriff 2"], ... }
// Ergebnis: <zielordner>/<id>/1.jpg … 6.jpg und meta.json (Titel, Urheber, Lizenz, Link)
const fs = require("fs"), path = require("path");
const [suchDatei, ziel] = process.argv.slice(2);
const UA = { "User-Agent": "Essensplaner/1.0 (private recipe app; github Sebastian16-source)" };
const ERLAUBT = /^(CC0|Public domain|CC BY(-SA)? [0-9.]+)/i;
const ohneHtml = (s) => String(s || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
const warte = (ms) => new Promise((ok) => setTimeout(ok, ms));
// JSON lesen, auch wenn der Editor/PowerShell ein BOM an den Anfang geschrieben hat
const leseJson = (datei) => JSON.parse(fs.readFileSync(datei, "utf8").replace(/^﻿/, ""));

// Wikimedia drosselt schnelle Anfragen – daher Pause vor jeder Anfrage und Wiederholung mit längerer Wartezeit
async function hole(url) {
  for (let versuch = 0; versuch < 6; versuch++) {
    await warte(1500 + versuch * 5000);
    const r = await fetch(url, { headers: UA });
    if (r.ok) return r;
  }
  throw new Error("Abruf fehlgeschlagen: " + url);
}

async function suche(begriff) {
  const u = "https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrlimit=12" +
    "&prop=imageinfo&iiprop=url|extmetadata|mime&iiurlwidth=400&format=json&gsrsearch=" + encodeURIComponent(begriff);
  const j = JSON.parse(await (await hole(u)).text());
  return Object.values(j.query?.pages || {}).sort((a, b) => a.index - b.index);
}

(async () => {
  for (const [id, begriffe] of Object.entries(leseJson(suchDatei))) {
    const ordner = path.join(ziel, id);
    fs.mkdirSync(ordner, { recursive: true });
    const gesehen = new Set(), liste = [];
    for (const b of begriffe) {
      for (const p of await suche(b)) {
        const ii = p.imageinfo?.[0];
        const lizenz = ii?.extmetadata?.LicenseShortName?.value || "";
        if (!ii || gesehen.has(p.title) || !/jpeg|png/.test(ii.mime) || !ERLAUBT.test(lizenz)) continue;
        gesehen.add(p.title);
        liste.push({ titel: p.title, lizenz, autor: ohneHtml(ii.extmetadata.Artist?.value), seite: ii.descriptionurl,
          lizenzUrl: ii.extmetadata.LicenseUrl?.value || "", vorschau: ii.thumburl });
        if (liste.length >= 6) break;
      }
      if (liste.length >= 6) break;
    }
    for (let i = 0; i < liste.length; i++) {
      fs.writeFileSync(path.join(ordner, `${i + 1}.jpg`), Buffer.from(await (await hole(liste[i].vorschau)).arrayBuffer()));
    }
    fs.writeFileSync(path.join(ordner, "meta.json"), JSON.stringify(liste, null, 2));
    console.log(id.padEnd(26), liste.length, "Kandidaten");
  }
})();
