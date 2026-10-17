// Lädt die ausgewählten Fotos (max. 1000 px) herunter und trägt die Bildnachweise in data.js (BILDER) ein.
// Aufruf: node fotos-uebernehmen.js <kandidatenordner> <auswahl.json> <rohordner>
//   auswahl.json: { "rezept-id": <Nummer 1–6 aus dem Kontaktbogen>, ... }
// Danach: kontaktbogen.ps1 nicht nötig, sondern zuschneiden.ps1 <rohordner> ..\bilder
const fs = require("fs"), path = require("path");
const [kandidaten, auswahlDatei, roh] = process.argv.slice(2);
const DATA = path.join(__dirname, "..", "data.js");
const UA = { "User-Agent": "Essensplaner/1.0 (private recipe app; github Sebastian16-source)" };
const warte = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function hole(url) {
  for (let v = 0; v < 6; v++) {
    await warte(1500 + v * 5000);
    const r = await fetch(url, { headers: UA });
    if (r.ok) return r;
  }
  throw new Error("Abruf fehlgeschlagen: " + url);
}
const api = (titel, breite) => "https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url|size|user&format=json" +
  `&iiurlwidth=${breite}&titles=` + encodeURIComponent(titel);
// "I'd appreciate …"-Bitten und Ähnliches aus dem Urheberfeld entfernen
const sauberAutor = (s) => s.replace(/\s*I'd appreciate.*$/i, "").replace(/^No machine-readable author provided\.\s*/i, "")
  .replace(/\s*assumed \(based on copyright claims\)\.?/i, "").trim();

(async () => {
  fs.mkdirSync(roh, { recursive: true });
  const auswahl = JSON.parse(fs.readFileSync(auswahlDatei, "utf8").replace(/^﻿/, ""));
  const zeilen = [];
  for (const [id, nr] of Object.entries(auswahl)) {
    const m = JSON.parse(fs.readFileSync(path.join(kandidaten, id, "meta.json"), "utf8"))[nr - 1];
    const info = Object.values((await (await hole(api(m.titel, 1000))).json()).query.pages)[0].imageinfo[0];
    // Originale (upload.wikimedia.org) werden stark gedrosselt – immer über den Thumbnail-Server laden
    let url = info.thumburl;
    if (!/\/thumb\//.test(url)) {
      const pfad = info.url.split("?")[0].replace("https://upload.wikimedia.org/wikipedia/commons/", "");
      url = `https://thumb.wikimedia.org/wikipedia/commons/thumb/${pfad}/${Math.min(1000, info.width - 1)}px-${pfad.split("/").pop()}`;
    }
    const datei = path.join(roh, id + ".jpg");
    try {
      fs.writeFileSync(datei, Buffer.from(await (await hole(url)).arrayBuffer()));
    } catch {
      fs.copyFileSync(path.join(kandidaten, id, `${nr}.jpg`), datei); // Notlösung: 400-px-Vorschau
      console.log("  (400-px-Vorschau verwendet)");
    }
    const autor = sauberAutor(m.autor || "") || info.user || "unbekannt";
    zeilen.push(`  ${JSON.stringify(id)}: { autor: ${JSON.stringify(autor)}, lizenz: ${JSON.stringify(m.lizenz)}, ` +
      `lizenzUrl: ${JSON.stringify(m.lizenzUrl)}, seite: ${JSON.stringify(m.seite)} },`);
    console.log(id.padEnd(26), autor, "|", m.lizenz);
  }
  // In den bestehenden BILDER-Block von data.js einfügen (vorhandene Einträge mit gleicher id ersetzen)
  let text = fs.readFileSync(DATA, "utf8");
  const start = text.indexOf("const BILDER = {");
  const ende = text.indexOf("\n};", start);
  let block = text.slice(start, ende);
  for (const id of Object.keys(auswahl)) block = block.replace(new RegExp(`\\n  ${JSON.stringify(id)}: \\{[^\\n]*\\},`), "");
  text = text.slice(0, start) + block + "\n" + zeilen.join("\n") + text.slice(ende);
  fs.writeFileSync(DATA, text, "utf8");
  console.log(zeilen.length + " Bildnachweise in data.js eingetragen");
})();
