// Prüft die Daten und Logik der App ohne Browser und zeigt Nährwerte und Preise pro Rezept.
// Aufruf: node werkzeuge/pruefen.js
const fs = require("fs"), path = require("path"), vm = require("vm");
const app = path.join(__dirname, "..");
const el = () => ({ innerHTML: "", textContent: "0", hidden: true, value: "", dataset: {},
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  focus() {}, closest: () => el(), querySelector: () => el() });
const ctx = { console, setTimeout, clearTimeout, URL, Math, require,
  document: { querySelector: el, querySelectorAll: () => [], addEventListener() {}, body: el(), createElement: el },
  localStorage: { getItem: () => null, setItem() {} }, navigator: {}, location: { protocol: "file:" },
  window: { scrollTo() {}, location: {} }, APP_ORDNER: app };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(app, "data.js"), "utf8") + "\n" + fs.readFileSync(path.join(app, "app.js"), "utf8") + `
const fehler = [];
for (const r of state.rezepte) for (const z of r.zutaten) {
  const p = parseZutat(z);
  if (!KATALOG[p.name]) fehler.push(r.id + ": Zutat nicht im Katalog: " + p.name);
  if (!NAEHRWERTE[p.name]) fehler.push(r.id + ": keine Nährwerte: " + p.name);
  if (!PREISE[p.name]) fehler.push(r.id + ": kein Preis: " + p.name);
  if (p.menge == null && !p.beilage) fehler.push(r.id + ": ohne Menge: " + z);
}
for (const n of Object.keys(KATALOG)) if (!PREISE[n]) fehler.push("Katalog ohne Preis: " + n);
for (const r of STANDARD_REZEPTE) {
  if (!BILDER[r.id]) fehler.push(r.id + ": kein Foto");
  else if (!require("fs").existsSync(require("path").join(APP_ORDNER, "bilder", r.id + ".jpg"))) fehler.push(r.id + ": Fotodatei fehlt");
}
console.log("Prüfungen:", fehler.length ? "\\n  " + fehler.join("\\n  ") : "ok");

console.log("\\nRezept".padEnd(48) + "Min   kcal  Eiweiß   €/Portion");
for (const r of state.rezepte) {
  const n = naehrwerte(r), pp = portionsPreis(r);
  console.log((r.name.length > 45 ? r.name.slice(0, 44) + "…" : r.name).padEnd(47), String(r.minuten).padStart(3),
    String(Math.round(n.kcal)).padStart(6), (Math.round(n.eiweiss) + " g").padStart(7), euroDe(pp.euro).padStart(11),
    pp.ohne.length ? " ohne Preis: " + pp.ohne.join(", ") : "");
}

// Was kostet eine Woche des 4-Wochen-Plans an der Kasse?
planAbDatum("2026-10-05", false);
for (let w = 0; w < 4; w++) {
  const start = addTage("2026-10-05", 7 * w);
  const mit = einkaufsliste(start, 1, true).kaufen.reduce((s, it) => s + (kassenPreis(it) ?? 0), 0);
  const ohne = einkaufsliste(start, 1, false).kaufen.reduce((s, it) => s + (kassenPreis(it) ?? 0), 0);
  console.log("Woche " + (w + 1) + ": Einkauf ca. " + euroDe(mit) + " (davon Gerichte ohne Frühstück & Basics " + euroDe(ohne) + ")");
}
const grund = Object.keys(state.vorrat).reduce((s, n) => s + (PREISE[n]?.[2] ?? 0), 0);
console.log("Grundvorrat einmalig komplett (je 1 Packung): ca. " + euroDe(grund));

for (const tab of ["plan", "einkauf", "rezepte", "vorrat", "mehr"]) { ui.tab = tab; render(); }
for (const r of state.rezepte) rezeptZeigen(r.id, 2);
console.log("Ansichten ok");
`, ctx);
