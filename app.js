"use strict";

// ================= Hilfsfunktionen =================

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clone = (x) => JSON.parse(JSON.stringify(x));

// ================= Datum =================

const TAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const TAGE_LANG = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const MONATE = ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sep.", "Okt.", "Nov.", "Dez."];
const SLOTNAME = { m: "Mittag", a: "Abend" };

function datumKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function keyDatum(k) {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function addTage(k, n) {
  const d = keyDatum(k);
  d.setDate(d.getDate() + n);
  return datumKey(d);
}
const wochentag = (k) => (keyDatum(k).getDay() + 6) % 7; // 0 = Montag
const montag = (k) => addTage(k, -wochentag(k));
const heute = () => datumKey(new Date());
const kurzDatum = (k) => { const d = keyDatum(k); return `${d.getDate()}.${d.getMonth() + 1}.`; };

// ISO-Kalenderwoche
function kw(k) {
  const d = keyDatum(k);
  d.setDate(d.getDate() + 3 - wochentag(k)); // Donnerstag dieser Woche
  const jan4 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - jan4) / 864e5 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
}
function zeitraumText(start, wochen) {
  const a = keyDatum(start), b = keyDatum(addTage(start, 7 * wochen - 1));
  return `${a.getDate()}. ${MONATE[a.getMonth()]} – ${b.getDate()}. ${MONATE[b.getMonth()]}`;
}
function kwText(start, wochen) {
  return wochen > 1 ? `KW ${kw(start)}–${kw(addTage(start, 7 * (wochen - 1)))}` : `KW ${kw(start)}`;
}

// ================= Zutaten parsen & formatieren =================

const BRUECHE = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3 };
const EINHEITEN = {
  g: "g", gramm: "g", kg: "kg", ml: "ml", l: "l", liter: "l",
  stk: "Stk", "stück": "Stk", dose: "Dose", dosen: "Dose", bund: "Bund", el: "EL", tl: "TL",
  prise: "Prise", prisen: "Prise", zehe: "Zehe", zehen: "Zehe", kugel: "Kugel", kugeln: "Kugel",
  packung: "Packung", packungen: "Packung", pck: "Packung", glas: "Glas", "gläser": "Glas",
  becher: "Becher", scheibe: "Scheibe", scheiben: "Scheibe",
};
const PLURAL = { Dose: "Dosen", Zehe: "Zehen", Kugel: "Kugeln", Prise: "Prisen", Packung: "Packungen", Glas: "Gläser", Scheibe: "Scheiben" };
const ZAEHLBAR = new Set(["Stk", "Dose", "Kugel", "Bund", "Packung", "Glas", "Becher", "Scheibe"]);
const SINGULAR = { Zwiebeln: "Zwiebel", Eier: "Ei", Kartoffeln: "Kartoffel", Karotten: "Karotte", "Äpfel": "Apfel", Bananen: "Banane" };
const ALIAS = {
  zwiebel: "Zwiebeln", ei: "Eier", kartoffel: "Kartoffeln", karotte: "Karotten", "möhren": "Karotten",
  "möhre": "Karotten", apfel: "Äpfel", banane: "Bananen", paprikaschote: "Paprika", zitronen: "Zitrone",
  knoblauchzehe: "Knoblauch", knoblauchzehen: "Knoblauch", quark: "Magerquark", joghurt: "Naturjoghurt",
  "kürbis": "Hokkaido-Kürbis", spinat: "TK-Blattspinat", tofu: "Tofu natur",
};
const KATALOG_LOWER = Object.fromEntries(Object.keys(KATALOG).map((n) => [n.toLowerCase(), n]));

function kanonischerName(roh) {
  const t = roh.trim().replace(/\s+/g, " ");
  const l = t.toLowerCase();
  if (KATALOG_LOWER[l]) return KATALOG_LOWER[l];
  if (ALIAS[l]) return ALIAS[l];
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function parseZahl(s) {
  s = s.replace(",", ".").replace(/\s+/g, "");
  if (BRUECHE[s] != null) return BRUECHE[s];
  const gemischt = s.match(/^(\d+)([½¼¾⅓⅔])$/);
  if (gemischt) return +gemischt[1] + BRUECHE[gemischt[2]];
  const bruch = s.match(/^(\d+)\/(\d+)$/);
  if (bruch) return +bruch[1] / +bruch[2];
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// "120 g Rote Linsen" -> { menge: 120, einheit: "g", name: "Rote Linsen" }
function parseZutat(zeile) {
  const t = String(zeile).trim();
  if (!t) return null;
  let menge = null, rest = t;
  const m = t.match(/^(\d+(?:[.,]\d+)?\s?[½¼¾⅓⅔]?|[½¼¾⅓⅔]|\d+\/\d+)\s+(.+)$/);
  if (m) { menge = parseZahl(m[1]); rest = m[2]; }
  let einheit = "Stk";
  const teile = rest.split(/\s+/);
  if (teile.length > 1) {
    const e = EINHEITEN[teile[0].toLowerCase().replace(/\.$/, "")];
    if (e) { einheit = e; rest = teile.slice(1).join(" "); }
  }
  if (einheit === "kg") { einheit = "g"; if (menge != null) menge *= 1000; }
  if (einheit === "l") { einheit = "ml"; if (menge != null) menge *= 1000; }
  return { menge, einheit, name: kanonischerName(rest) };
}

function fmtZahl(x) {
  const ganz = Math.floor(x + 1e-9), rest = x - ganz;
  if (rest < 0.02) return String(ganz);
  const bruch = [[0.25, "¼"], [0.5, "½"], [0.75, "¾"], [1 / 3, "⅓"], [2 / 3, "⅔"]].find(([v]) => Math.abs(rest - v) < 0.02);
  if (bruch) return (ganz || "") + bruch[1];
  return String(Math.round(x * 10) / 10).replace(".", ",");
}

function fmtMenge(menge, einheit) {
  if (menge == null) return "";
  if (einheit === "g" || einheit === "ml") {
    if (menge >= 1000) return `${fmtZahl(Math.round(menge / 100) / 10)} ${einheit === "g" ? "kg" : "l"}`;
    return `${menge < 10 ? fmtZahl(menge) : Math.round(menge)} ${einheit}`;
  }
  if (einheit === "Stk") return fmtZahl(menge);
  return `${fmtZahl(menge)} ${menge > 1 && PLURAL[einheit] ? PLURAL[einheit] : einheit}`;
}

function fmtZutat(p, faktor = 1) {
  if (p.menge == null) return p.name;
  const m = p.menge * faktor;
  const name = p.einheit === "Stk" && m <= 1 ? (SINGULAR[p.name] || p.name) : p.name;
  return `${fmtMenge(m, p.einheit)} ${name}`;
}

const kategorie = (name) => (KATALOG[name] ? KATALOG[name][0] : "Sonstiges");
const einheitLabel = (e) => (e === "Stk" ? "Stück" : e);

// ================= Nährwerte =================

// Grenzwerte wie bei EU-Lebensmittelangaben (VO 1924/2006):
// eiweißreich = mind. 20 % der Energie aus Eiweiß, ballaststoffreich = mind. 3 g je 100 kcal
const istEiweissreich = (nw) => nw.kcal > 0 && (nw.eiweiss * 4) / nw.kcal >= 0.2;
const istBallaststoffreich = (nw) => nw.kcal > 0 && (nw.ballast / nw.kcal) * 100 >= 3;

const zutatGramm = (p) => {
  const nw = NAEHRWERTE[p.name];
  return nw ? p.menge * (nw[p.einheit] ?? EINHEIT_GRAMM[p.einheit] ?? 0) : 0;
};

// Nährwerte pro Portion; Zutaten ohne hinterlegte Werte werden in "fehlend" gesammelt
function naehrwerte(r) {
  const summe = [0, 0, 0, 0, 0];
  const fehlend = [];
  for (const z of r.zutaten) {
    const p = parseZutat(z);
    if (!p || p.menge == null) continue;
    const g = zutatGramm(p);
    if (!g) { fehlend.push(p.name); continue; }
    NAEHRWERTE[p.name].n.forEach((v, i) => { summe[i] += (v * g) / 100; });
  }
  const [kcal, eiweiss, kh, fett, ballast] = summe.map((v) => v / r.portionen);
  return { kcal, eiweiss, kh, fett, ballast, fehlend };
}

const zahlDe = (x) => Math.round(x).toLocaleString("de-DE");
const nwKurz = (nw) => `${zahlDe(nw.kcal)} kcal · ${zahlDe(nw.eiweiss)} g Eiweiß`;

function nwBadges(nw) {
  return [
    istEiweissreich(nw) ? `<span class="badge eiweiss">Eiweißreich</span>` : "",
    istBallaststoffreich(nw) ? `<span class="badge ballast">Ballaststoffreich</span>` : "",
  ].join("");
}

// Summe aller Gerichte eines Tages (je Mahlzeit eine Portion, Reste zählen mit)
function tagesNaehrwerte(datum) {
  const s = { kcal: 0, eiweiss: 0, kh: 0, fett: 0, ballast: 0, mahlzeiten: 0 };
  for (const slot of ["m", "a"]) {
    const e = slotGet(datum, slot);
    const r = (e?.typ === "rezept" || e?.typ === "reste") && rezept(e.id);
    if (!r) continue;
    const nw = naehrwerte(r);
    for (const k of ["kcal", "eiweiss", "kh", "fett", "ballast"]) s[k] += nw[k];
    s.mahlzeiten++;
  }
  return s;
}

// ================= Zustand =================

const SPEICHER_KEY = "essensplaner-v1";

function neuerState() {
  const vorrat = {};
  for (const [name, [, grund]] of Object.entries(KATALOG)) if (grund) vorrat[name] = { menge: null, einheit: null };
  return {
    rezepte: clone(STANDARD_REZEPTE),
    geloeschteStandard: [],
    plan: {},           // "2026-10-06": { m: Eintrag, a: Eintrag }
    vorrat,             // Name -> { menge: Zahl | null (= genug da), einheit }
    einstellungen: clone(STANDARD_EINSTELLUNGEN),
    extras: [],         // zusätzliche Artikel für die Einkaufsliste
    abgehakt: {},       // Zeitraum -> { Artikel-Key: true }
    einkauf: { wochen: 1, basics: true },
    imBlick: [],        // Frisches mit geschätztem MHD: { id, name, text, gekauft, ablauf, quelle, periode, key }
    gekauftAm: {},      // Wochenstart -> Datum, an dem für diese Woche eingekauft wurde
  };
}

function laden(roh) {
  let s = null;
  try { s = JSON.parse(roh ?? localStorage.getItem(SPEICHER_KEY)); } catch { s = null; }
  const basis = neuerState();
  if (!s || typeof s !== "object" || !Array.isArray(s.rezepte)) return basis;
  for (const k of Object.keys(basis)) if (s[k] == null) s[k] = basis[k];
  s.einstellungen = { ...basis.einstellungen, ...s.einstellungen };
  s.einkauf = { ...basis.einkauf, ...s.einkauf };
  // Neu hinzugekommene Standardrezepte ergänzen (gelöschte bleiben weg)
  const vorhanden = new Set(s.rezepte.map((r) => r.id));
  for (const r of STANDARD_REZEPTE) {
    if (!vorhanden.has(r.id) && !s.geloeschteStandard.includes(r.id)) s.rezepte.push(clone(r));
  }
  // Längst Abgelaufenes (> 7 Tage) aus "Im Blick" entfernen
  const grenze = addTage(heute(), -7);
  s.imBlick = s.imBlick.filter((x) => x.ablauf >= grenze);
  return s;
}

let state = laden();

function speichern() {
  try { localStorage.setItem(SPEICHER_KEY, JSON.stringify(state)); }
  catch { toast("Speichern nicht möglich (privater Modus?)"); }
}

const rezept = (id) => state.rezepte.find((r) => r.id === id);

// Alle bekannten Zutaten mit ihrer häufigsten Einheit
function zutatenIndex() {
  const idx = new Map();
  const zaehle = (zeile) => {
    const p = parseZutat(zeile);
    if (!p) return;
    if (!idx.has(p.name)) idx.set(p.name, {});
    const e = idx.get(p.name);
    e[p.einheit] = (e[p.einheit] || 0) + 1;
  };
  state.rezepte.forEach((r) => r.zutaten.forEach(zaehle));
  state.einstellungen.basics.forEach(zaehle);
  for (const n of Object.keys(KATALOG)) if (!idx.has(n)) idx.set(n, {});
  for (const n of Object.keys(state.vorrat)) if (!idx.has(n)) idx.set(n, {});
  return idx;
}
function haupteinheit(name, idx = zutatenIndex()) {
  const e = idx.get(name) || {};
  const best = Object.entries(e).sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : "Stk";
}

// ================= Plan-Logik =================

const slotGet = (datum, slot) => state.plan[datum]?.[slot] || null;
function slotSet(datum, slot, eintrag) {
  if (eintrag) {
    (state.plan[datum] ||= {})[slot] = eintrag;
  } else if (state.plan[datum]) {
    delete state.plan[datum][slot];
    if (!Object.keys(state.plan[datum]).length) delete state.plan[datum];
  }
}
const naechster = (datum, slot) => (slot === "m" ? [datum, "a"] : [addTage(datum, 1), "m"]);
const vorheriger = (datum, slot) => (slot === "a" ? [datum, "m"] : [addTage(datum, -1), "a"]);

// Eine Portion mehr kochen, die beim nächsten Essen als Reste eingetragen wird
function restAn(datum, slot) {
  const e = slotGet(datum, slot);
  if (!e || e.typ !== "rezept" || e.rest) return false;
  const [nd, ns] = naechster(datum, slot);
  const ziel = slotGet(nd, ns);
  if (ziel && ziel.typ !== "reste") {
    toast(`${SLOTNAME[ns]} am ${TAGE[wochentag(nd)]} ist schon belegt`);
    return false;
  }
  if (ziel) loesche(nd, ns);
  e.rest = true;
  e.portionen += 1;
  slotSet(nd, ns, { typ: "reste", id: e.id, von: [datum, slot] });
  return true;
}
function restAus(datum, slot) {
  const e = slotGet(datum, slot);
  if (!e || !e.rest) return;
  e.rest = false;
  e.portionen = Math.max(1, e.portionen - 1);
  const [nd, ns] = naechster(datum, slot);
  const z = slotGet(nd, ns);
  if (z?.typ === "reste" && z.von?.[0] === datum && z.von?.[1] === slot) slotSet(nd, ns, null);
}
function loesche(datum, slot) {
  const e = slotGet(datum, slot);
  if (!e) return;
  if (e.typ === "rezept" && e.rest) restAus(datum, slot);
  if (e.typ === "reste" && e.von) {
    const quelle = slotGet(e.von[0], e.von[1]);
    if (quelle?.typ === "rezept" && quelle.rest) {
      quelle.rest = false;
      quelle.portionen = Math.max(1, quelle.portionen - 1);
    }
  }
  slotSet(datum, slot, null);
}

function vorlageAnwenden(start, index) {
  const v = PLAN_VORLAGEN[index];
  for (let t = 0; t < 7; t++) { loesche(addTage(start, t), "m"); loesche(addTage(start, t), "a"); }
  v.tage.forEach(([mittag, abend], t) => {
    const d = addTage(start, t);
    if (rezept(abend)) slotSet(d, "a", { typ: "rezept", id: abend, portionen: 1, rest: false });
    if (mittag !== "reste" && rezept(mittag)) slotSet(d, "m", { typ: "rezept", id: mittag, portionen: 1, rest: false });
  });
  v.tage.forEach(([mittag], t) => {
    if (mittag === "reste") restAn(...vorheriger(addTage(start, t), "m"));
  });
  // Sonntagabend: Reste für Montag der Folgewoche, falls dort noch nichts geplant ist
  const sonntag = addTage(start, 6);
  if (!slotGet(addTage(start, 7), "m")) restAn(sonntag, "a");
}

function zuletztGeplant() {
  const m = {};
  for (const [d, tag] of Object.entries(state.plan)) {
    for (const e of Object.values(tag)) {
      if (e?.typ === "rezept" && (!m[e.id] || d > m[e.id])) m[e.id] = d;
    }
  }
  return m;
}

// ================= Einkaufsliste =================

function einkaufsliste(start, wochen, mitBasics) {
  const map = new Map();
  const add = (zeile, faktor, quelle, datum = null) => {
    const p = parseZutat(zeile);
    if (!p) return;
    const key = `${p.name}|${p.einheit}`;
    let it = map.get(key);
    if (!it) map.set(key, (it = { key, name: p.name, einheit: p.einheit, menge: 0, ohneMenge: false, quellen: new Set(), tage: [] }));
    if (p.menge == null) it.ohneMenge = true;
    else it.menge += p.menge * faktor;
    it.quellen.add(quelle);
    if (datum) it.tage.push(datum);
  };
  for (let t = 0; t < 7 * wochen; t++) {
    const d = addTage(start, t);
    for (const slot of ["m", "a"]) {
      const e = slotGet(d, slot);
      const r = e?.typ === "rezept" && rezept(e.id);
      if (r) r.zutaten.forEach((z) => add(z, e.portionen / r.portionen, r.name, d));
    }
  }
  if (mitBasics) {
    for (let w = 0; w < wochen; w++) state.einstellungen.basics.forEach((z) => add(z, 1, "Wochen-Basics"));
  }

  const idx = zutatenIndex();
  const kaufen = [], ausVorrat = [];
  for (const it of map.values()) {
    const v = state.vorrat[it.name];
    if (!v) { kaufen.push(it); continue; }
    if (v.menge == null) { it.vorratText = "genug da"; ausVorrat.push(it); continue; }
    const vEinheit = v.einheit || haupteinheit(it.name, idx);
    if (vEinheit !== it.einheit) { it.hinweis = "Vorrat prüfen"; kaufen.push(it); continue; }
    it.vorratText = `${fmtMenge(v.menge, vEinheit) || "0"} da`;
    const fehlt = it.menge - v.menge;
    if (fehlt <= 0.001) ausVorrat.push(it);
    else kaufen.push({ ...it, menge: fehlt, hinweis: `${fmtMenge(v.menge, vEinheit)} im Vorrat` });
  }
  return { kaufen, ausVorrat };
}

// Kaufmenge sinnvoll aufrunden: ganze Packungen, Dosen und Stück, sonst Gramm auf 10er.
// "rest" ist, was danach voraussichtlich übrig bleibt (in der Einheit der Zutat).
function kaufMenge(it) {
  if (!it.menge) return { text: "", notiz: "", rest: 0 };
  const m = it.menge;
  const pack = PACKUNGEN[it.name];
  if (pack && pack[1] === it.einheit) {
    const groesse = pack[0];
    const n = Math.max(1, Math.ceil(m / groesse - 0.05));
    const rest = n * groesse - m >= 0.1 * groesse ? n * groesse - m : 0;
    const text = it.einheit === "Stk"
      ? `${n} ${n > 1 ? "Packungen" : "Packung"} à ${groesse} Stück`
      : `${n > 1 ? `${n} × ` : ""}${fmtMenge(groesse, it.einheit)}`;
    return { text, notiz: rest ? `${fmtMenge(m, it.einheit)} verplant` : "", rest };
  }
  if (it.einheit === "g" || it.einheit === "ml") {
    return { text: fmtMenge(m >= 50 ? Math.ceil(m / 10) * 10 : Math.ceil(m), it.einheit), notiz: "", rest: 0 };
  }
  if (ZAEHLBAR.has(it.einheit)) {
    const c = Math.ceil(m - 1e-9);
    const rest = c - m > 0.01 ? c - m : 0;
    return { text: it.einheit === "Stk" ? `${fmtZahl(c)} Stück` : fmtMenge(c, it.einheit), notiz: rest ? `${fmtZahl(m)} verplant` : "", rest };
  }
  return { text: fmtMenge(m, it.einheit), notiz: "", rest: 0 };
}

// ================= Haltbarkeit & Reste =================

const tageZwischen = (a, b) => Math.round((keyDatum(b) - keyDatum(a)) / 864e5);

// Wann wurde für diese Woche eingekauft? Echtes Datum (beim Abhaken gemerkt) oder der übliche Einkaufstag
function kaufdatum(wochenStart) {
  return state.gekauftAm[wochenStart] || addTage(wochenStart, -((7 - state.einstellungen.einkaufstag) % 7));
}

// Verderbliche Zutaten, die bis zum Kochtag länger liegen, als sie typischerweise halten
function frischeWarnungen(datum, r) {
  const alter = tageZwischen(kaufdatum(montag(datum)), datum);
  const liste = [];
  for (const z of r.zutaten) {
    const p = parseZutat(z);
    const h = p && HALTBARKEIT[p.name];
    if (!h || state.vorrat[p.name] || alter <= h[0] || liste.some((x) => x.name === p.name)) continue;
    liste.push({ name: p.name, tage: h[0] });
  }
  return { alter, liste };
}

function haltbarText(name, angebrochen) {
  const h = HALTBARKEIT[name];
  if (!h) return "lange haltbar";
  return angebrochen && h[1] ? `angebrochen ca. ${h[1]} Tage` : `hält ca. ${h[0]} Tage`;
}

function ablaufInfo(datum) {
  const diff = tageZwischen(heute(), datum);
  if (diff < 0) return { text: `seit ${-diff} ${diff === -1 ? "Tag" : "Tagen"} abgelaufen`, klasse: "abgelaufen" };
  if (diff === 0) return { text: "läuft heute ab", klasse: "bald" };
  if (diff === 1) return { text: "läuft morgen ab", klasse: "bald" };
  return { text: `noch ${diff} Tage`, klasse: diff <= 3 ? "bald" : "" };
}

const zutatNamen = (r) => r.zutaten.map((z) => parseZutat(z)?.name).filter(Boolean);
const geplanteIds = (start) => {
  const ids = new Set();
  for (let t = 0; t < 7; t++) for (const s of ["m", "a"]) { const e = slotGet(addTage(start, t), s); if (e?.id) ids.add(e.id); }
  return ids;
};
const rezepteMit = (name, ohne = new Set()) =>
  state.rezepte.filter((r) => !ohne.has(r.id) && zutatNamen(r).includes(name));

// Was nach den Gerichten einer Woche durch Packungsgrößen übrig bleibt (ohne Wochen-Basics und Vorrat)
function resteDerWoche(start) {
  const basics = new Set(state.einstellungen.basics.map((z) => parseZutat(z)?.name));
  return einkaufsliste(start, 1, false).kaufen
    .filter((it) => !basics.has(it.name))
    .map((it) => ({ name: it.name, einheit: it.einheit, rest: kaufMenge(it).rest }))
    .filter((it) => it.rest > 0)
    .sort(sortiereNachKategorie);
}

// Beim Abhaken in der Einkaufsliste: Kaufdatum merken und Frisches mit geschätztem MHD in "Im Blick" eintragen.
// Gilt für Wochen-Basics (Joghurt, Quark …) und für alles, was nach dem Plan übrig bleibt.
function gekauftMerken(key, gekauft) {
  const pk = periodeKey();
  state.imBlick = state.imBlick.filter((x) => !(x.periode === pk && x.key === key));
  if (!gekauft) return;
  const h0 = heute();
  for (let w = 0; w < state.einkauf.wochen; w++) state.gekauftAm[addTage(ui.einkaufStart, 7 * w)] ||= h0;

  const it = einkaufsliste(ui.einkaufStart, state.einkauf.wochen, state.einkauf.basics).kaufen.find((i) => i.key === key);
  const h = it && HALTBARKEIT[it.name];
  if (!h) return;
  const km = kaufMenge(it);
  const eintrag = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, name: it.name, gekauft: h0, periode: pk, key };
  if (it.quellen.has("Wochen-Basics")) {
    // Nur was innerhalb von 2 Wochen verdirbt – Äpfel oder Eier würden die Liste nur füllen
    if (h[0] <= 14) state.imBlick.push({ ...eintrag, text: `${it.name} (${km.text})`, ablauf: addTage(h0, h[0]), quelle: "basics" });
  } else if (km.rest && (h[1] || h[0] <= 60)) {
    // Der Rest ist ab dem ersten Kochtag angebrochen (z. B. halbe Dose Kichererbsen)
    const erster = it.tage.filter((d) => d >= h0).sort()[0] || h0;
    let ablauf = addTage(h0, h[0]);
    if (h[1] && addTage(erster, h[1]) < ablauf) ablauf = addTage(erster, h[1]);
    state.imBlick.push({ ...eintrag, text: `${fmtZutat({ menge: km.rest, einheit: it.einheit, name: it.name })} übrig`, ablauf, quelle: "rest" });
  }
}

const periodeKey = () => `${ui.einkaufStart}_${state.einkauf.wochen}`;

function exportZeilen() {
  const { kaufen } = einkaufsliste(ui.einkaufStart, state.einkauf.wochen, state.einkauf.basics);
  const ab = state.abgehakt[periodeKey()] || {};
  const zeilen = kaufen
    .filter((it) => !ab[it.key])
    .sort(sortiereNachKategorie)
    .map((it) => { const t = kaufMenge(it).text; return t ? `${it.name} (${t})` : it.name; });
  state.extras.filter((x) => !ab[`extra:${x.id}`]).forEach((x) => zeilen.push(x.text));
  return zeilen;
}

function sortiereNachKategorie(a, b) {
  return KATEGORIEN.indexOf(kategorie(a.name)) - KATEGORIEN.indexOf(kategorie(b.name)) || a.name.localeCompare(b.name, "de");
}

// ================= UI-Zustand & Grundgerüst =================

const ui = {
  tab: "plan",
  woche: montag(heute()),
  einkaufStart: montag(heute()),
  rezeptSuche: "",
  rezeptFilter: null,
  vorratSuche: "",
  picker: null,
  detail: null,
};

const TITEL = { plan: "Wochenplan", einkauf: "Einkaufsliste", rezepte: "Rezepte", vorrat: "Vorrat", mehr: "Einstellungen" };

function render() {
  $("#titel").textContent = TITEL[ui.tab];
  document.querySelectorAll(".tabbar button").forEach((b) => b.classList.toggle("aktiv", b.dataset.tab === ui.tab));
  const ansichten = { plan: renderPlan, einkauf: renderEinkauf, rezepte: renderRezepte, vorrat: renderVorrat, mehr: renderMehr };
  $("#main").innerHTML = ansichten[ui.tab]();
  if (ui.tab === "rezepte") renderRezeptListe();
  if (ui.tab === "vorrat") renderVorratListe();
}

function speichernRender() {
  speichern();
  render();
}

function openModal(html) {
  $("#modal .modal-blatt").innerHTML = html;
  $("#modal").hidden = false;
  document.body.classList.add("modal-offen");
}
function closeModal() {
  $("#modal").hidden = true;
  document.body.classList.remove("modal-offen");
  ui.picker = null;
  ui.detail = null;
}

let toastTimer;
function toast(text) {
  const el = $("#toast");
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2800);
}

const sheetKopf = (titel) =>
  `<div class="sheet-kopf"><h2>${esc(titel)}</h2><button class="icon-btn" data-action="modal-zu" aria-label="Schließen">×</button></div>`;

// ================= Ansicht: Wochenplan =================

function renderPlan() {
  const s = ui.woche, h = heute();
  const sport = new Set(state.einstellungen.sporttage);
  let html = `
    <div class="periodennav">
      <button class="icon-btn" data-action="woche" data-delta="-7" aria-label="Vorherige Woche">‹</button>
      <div class="periodennav-mitte"><strong>${kwText(s, 1)}</strong><span>${zeitraumText(s, 1)}</span></div>
      <button class="icon-btn" data-action="woche" data-delta="7" aria-label="Nächste Woche">›</button>
    </div>
    ${s !== montag(h) ? `<button class="link-btn zentriert" data-action="woche-heute">Zur aktuellen Woche</button>` : ""}
    ${renderBaldVerbrauchen()}
    <div class="karte fruehstueck"><span class="label">Frühstück · jeden Tag</span><p>${esc(state.einstellungen.fruehstueck)}</p></div>`;

  for (let t = 0; t < 7; t++) {
    const d = addTage(s, t);
    html += `
      <section class="tag${d === h ? " heute" : ""}">
        <div class="tag-kopf">
          <span class="tag-name">${TAGE_LANG[t]}</span><span class="tag-datum">${kurzDatum(d)}</span>
          ${sport.has(t) ? `<span class="badge sport" title="Abends etwas mehr Kohlenhydrate, mehr trinken">Sport</span>` : ""}
        </div>
        ${renderSlot(d, "m")}${renderSlot(d, "a")}
        ${renderTagesSumme(d)}
      </section>`;
  }
  html += renderResteKarte(s);
  html += `
    <div class="aktionen">
      <button class="btn primaer" data-action="woche-einkauf">Einkaufsliste für diese Woche</button>
      <button class="btn" data-action="vorlagen">Woche aus Vorlage füllen</button>
      <button class="btn gefahr" data-action="woche-leeren" data-bestaetigen="Wirklich leeren?">Woche leeren</button>
    </div>`;
  return html;
}

const vorschlagKnoepfe = (rezepte) => rezepte.slice(0, 3).map((r) =>
  `<button class="chip" data-action="rezept-zeigen" data-id="${esc(r.id)}">${esc(r.name)}</button>`).join("");

// Banner oben im Plan: Was aus "Im Blick" in den nächsten 2 Tagen abläuft
function renderBaldVerbrauchen() {
  const grenze = addTage(heute(), 2);
  const bald = state.imBlick.filter((x) => x.ablauf <= grenze).sort((a, b) => a.ablauf.localeCompare(b.ablauf));
  if (!bald.length) return "";
  const geplant = geplanteIds(montag(heute()));
  return `<div class="karte bald-karte">
      <span class="label">Bald verbrauchen</span>
      <ul class="reste-liste">${bald.map((x) => {
        const vorschlaege = rezepteMit(x.name, geplant);
        return `<li><div><strong>${esc(x.text)}</strong> · <span class="${ablaufInfo(x.ablauf).klasse}">${ablaufInfo(x.ablauf).text}</span></div>
          ${vorschlaege.length ? `<div class="chips">${vorschlagKnoepfe(vorschlaege)}</div>` : ""}</li>`;
      }).join("")}</ul>
      <button class="link-btn" data-action="tab" data-tab="vorrat">Alles im Blick ansehen</button>
    </div>`;
}

// Karte unter der Woche: Was durch Packungsgrößen übrig bleibt, mit passenden Rezepten
function renderResteKarte(start) {
  const reste = resteDerWoche(start);
  if (!reste.length) return "";
  const geplant = geplanteIds(start);
  return `<section class="karte reste-karte">
      <h2>Bleibt übrig</h2>
      <p class="hinweis">Durch Packungsgrößen bleibt nach dieser Woche voraussichtlich übrig. Rezepte, die es aufbrauchen:</p>
      <ul class="reste-liste">${reste.map((it) => {
        const vorschlaege = rezepteMit(it.name, geplant);
        return `<li><div><strong>${esc(fmtZutat({ menge: it.rest, einheit: it.einheit, name: it.name }))}</strong>
            <span class="slot-meta"> · ${esc(haltbarText(it.name, true))}</span></div>
          ${vorschlaege.length ? `<div class="chips">${vorschlagKnoepfe(vorschlaege)}</div>`
            : `<div class="slot-meta">Kein weiteres Rezept damit – z. B. als Rohkost, Salat oder Beilage.</div>`}</li>`;
      }).join("")}</ul>
    </section>`;
}

function renderTagesSumme(d) {
  const s = tagesNaehrwerte(d);
  if (!s.mahlzeiten) return "";
  return `<div class="tag-summe">${s.mahlzeiten === 2 ? "Mittag + Abend" : "Geplant"}: ca. ${zahlDe(s.kcal)} kcal ·
    <strong>${zahlDe(s.eiweiss)} g Eiweiß</strong> · ${zahlDe(s.kh)} g KH · ${zahlDe(s.fett)} g Fett</div>`;
}

function renderSlot(d, slot) {
  const e = slotGet(d, slot);
  const attr = `data-datum="${d}" data-slot="${slot}"`;
  const label = `<span class="slot-label">${SLOTNAME[slot]}</span>`;
  const entfernen = `<button class="icon-btn klein" data-action="slot-loeschen" ${attr} aria-label="Entfernen">×</button>`;
  if (!e) return `<div class="slot leer">${label}<button class="slot-add" data-action="waehlen" ${attr}>+ Gericht wählen</button></div>`;
  if (e.typ === "frei") {
    return `<div class="slot">${label}<div class="slot-inhalt"><span class="slot-titel frei">${esc(e.text)}</span></div>${entfernen}</div>`;
  }
  const r = rezept(e.id);
  const name = r ? esc(r.name) : "<em>Rezept gelöscht</em>";
  if (e.typ === "reste") {
    return `<div class="slot reste">${label}<div class="slot-inhalt">
        <button class="slot-titel" data-action="rezept-zeigen" data-id="${esc(e.id)}">${name}</button>
        <span class="slot-meta">↩ Reste vom ${e.von?.[1] === "m" ? "Mittag" : "Vorabend"}</span>
      </div>${entfernen}</div>`;
  }
  return `<div class="slot">${label}<div class="slot-inhalt">
      <button class="slot-titel" data-action="rezept-zeigen" data-id="${esc(e.id)}" data-portionen="${e.portionen}">${name}</button>
      <div class="slot-steuerung">
        <div class="stepper">
          <button data-action="portionen" data-delta="-1" ${attr} aria-label="Weniger Portionen">−</button>
          <span>${e.portionen} Port.</span>
          <button data-action="portionen" data-delta="1" ${attr} aria-label="Mehr Portionen">+</button>
        </div>
        <button class="chip${e.rest ? " an" : ""}" data-action="rest" ${attr}>${e.rest ? "✓ " : ""}Rest für ${slot === "a" ? "morgen Mittag" : "abends"}</button>
        ${r ? `<span class="slot-meta">${r.minuten} Min</span>` : ""}
      </div>
      ${r ? renderFrischeWarnung(d, r) : ""}
    </div>${entfernen}</div>`;
}

function renderFrischeWarnung(d, r) {
  const { alter, liste } = frischeWarnungen(d, r);
  if (!liste.length) return "";
  const namen = liste.map((x) => `${esc(x.name)} (hält ca. ${x.tage} ${x.tage === 1 ? "Tag" : "Tage"})`).join(", ");
  return `<div class="warnung">⚠ ${namen}: Der Einkauf ist dann ${alter} Tage her. Lieber früher in der Woche einplanen.</div>`;
}

function pickerOeffnen(datum, slot) {
  ui.picker = { datum, slot, suche: "", filter: null };
  const vorher = slotGet(...vorheriger(datum, slot));
  const vr = vorher?.typ === "rezept" && !vorher.rest && rezept(vorher.id);
  openModal(`
    ${sheetKopf(`${TAGE_LANG[wochentag(datum)]} ${kurzDatum(datum)}, ${SLOTNAME[slot]}`)}
    ${vr ? `<button class="option" data-action="reste-waehlen" data-datum="${datum}" data-slot="${slot}">
        <strong>↩ Reste: ${esc(vr.name)}</strong><small>Eine Portion wird beim vorherigen Essen mitgekocht</small></button>` : ""}
    <input type="search" class="suche" placeholder="Name oder Zutat suchen…" data-input="picker-suche" autocomplete="off">
    <div class="chips scroll" id="picker-filter">${filterChips(null, "picker")}</div>
    <div id="picker-liste" class="rezept-liste"></div>
    <form class="zeilen-form" data-form="frei">
      <input name="text" placeholder="Oder Freitext, z. B. Mensa, Essen gehen" autocomplete="off">
      <button class="btn">Eintragen</button>
    </form>`);
  renderPickerListe();
}

// Zutaten, die gerade weg müssen: Reste dieser Woche und "Im Blick"-Einträge der nächsten 5 Tage
function resteNamen(datum) {
  const namen = new Set(resteDerWoche(montag(datum)).map((it) => it.name));
  const grenze = addTage(heute(), 5);
  state.imBlick.filter((x) => x.ablauf <= grenze).forEach((x) => namen.add(x.name));
  return namen;
}

function renderPickerListe() {
  const zuletzt = zuletztGeplant();
  const liste = rezepteGefiltert(ui.picker.suche, ui.picker.filter);
  const zeile = (r, extra = "") =>
    rezeptZeile(r, "waehle-rezept", (zuletzt[r.id] ? ` · eingeplant ${kurzDatum(zuletzt[r.id])}` : "") + extra);
  if (!liste.length) { $("#picker-liste").innerHTML = `<p class="leer-hinweis">Nichts gefunden.</p>`; return; }

  // Ohne Suche/Filter: Rezepte, die Reste verwerten, zuerst
  const reste = !ui.picker.suche && !ui.picker.filter ? resteNamen(ui.picker.datum) : new Set();
  const geplant = geplanteIds(montag(ui.picker.datum));
  const verwerter = liste
    .filter((r) => !geplant.has(r.id))
    .map((r) => ({ r, treffer: [...new Set(zutatNamen(r).filter((n) => reste.has(n)))] }))
    .filter((x) => x.treffer.length)
    .sort((a, b) => b.treffer.length - a.treffer.length)
    .slice(0, 5);
  if (!verwerter.length) { $("#picker-liste").innerHTML = liste.map((r) => zeile(r)).join(""); return; }
  $("#picker-liste").innerHTML = `
    <h3 class="kat-titel">♻ Verwertet Reste</h3>
    ${verwerter.map(({ r, treffer }) => zeile(r, ` · ♻ ${esc(treffer.join(", "))}`)).join("")}
    <h3 class="kat-titel">Alle Rezepte</h3>
    ${liste.map((r) => zeile(r)).join("")}`;
}

function vorlagenOeffnen() {
  openModal(`
    ${sheetKopf("Woche aus Vorlage füllen")}
    <p class="hinweis">Lädt eine Woche aus deinem 4-Wochen-Plan in ${kwText(ui.woche, 1)}. Bereits geplante Gerichte dieser Woche werden ersetzt.</p>
    ${PLAN_VORLAGEN.map((v, i) => `
      <button class="option" data-action="vorlage-anwenden" data-index="${i}">
        <strong>${esc(v.name)}</strong>
        <small>${v.tage.map(([, a]) => esc(rezept(a)?.name || "–")).join(" · ")}</small>
      </button>`).join("")}`);
}

// ================= Ansicht: Rezepte =================

function alleTags() {
  const s = new Set();
  state.rezepte.forEach((r) => r.tags.forEach((t) => { if (t !== "Schnell") s.add(t); }));
  return [...s].sort((a, b) => a.localeCompare(b, "de"));
}

function filterChips(aktiv, ziel) {
  return ["≤ 20 Min", "Eiweißreich", ...alleTags()].map((t) =>
    `<button class="chip${aktiv === t ? " an" : ""}" data-action="filter" data-ziel="${ziel}" data-wert="${esc(t)}">${esc(t)}</button>`).join("");
}

function rezepteGefiltert(suche, filter) {
  const q = suche.trim().toLowerCase();
  return state.rezepte
    .filter((r) => !q || r.name.toLowerCase().includes(q) || r.zutaten.some((z) => z.toLowerCase().includes(q)))
    .filter((r) => !filter
      || (filter === "≤ 20 Min" ? r.minuten <= 20
        : filter === "Eiweißreich" ? istEiweissreich(naehrwerte(r))
          : r.tags.includes(filter)))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}

function rezeptZeile(r, aktion, extra = "") {
  const tags = r.tags.filter((t) => t !== "Schnell");
  return `<button class="rezept-zeile" data-action="${aktion}" data-id="${esc(r.id)}">
      <span class="rz-name">${esc(r.name)}</span>
      <span class="rz-meta">${r.minuten} Min · ${nwKurz(naehrwerte(r))}${tags.length ? " · " + esc(tags.join(", ")) : ""}${extra}</span>
    </button>`;
}

function renderRezepte() {
  return `
    <div class="leiste">
      <input type="search" class="suche" placeholder="Name oder Zutat suchen…" data-input="rezept-suche" value="${esc(ui.rezeptSuche)}" autocomplete="off">
      <button class="btn primaer" data-action="rezept-neu">+ Neu</button>
    </div>
    <div class="chips" id="rezept-filter"></div>
    <div id="rezept-liste" class="rezept-liste"></div>`;
}

function renderRezeptListe() {
  $("#rezept-filter").innerHTML = filterChips(ui.rezeptFilter, "rezepte");
  const liste = rezepteGefiltert(ui.rezeptSuche, ui.rezeptFilter);
  $("#rezept-liste").innerHTML = liste.length
    ? liste.map((r) => rezeptZeile(r, "rezept-zeigen")).join("")
    : `<p class="leer-hinweis">Keine Rezepte gefunden.</p>`;
}

function rezeptZeigen(id, portionen) {
  const r = rezept(id);
  if (!r) { toast("Rezept nicht gefunden"); return; }
  ui.detail = { id, portionen: portionen || r.portionen };
  renderDetail();
}

function renderDetail() {
  const r = rezept(ui.detail.id), p = ui.detail.portionen, f = p / r.portionen;
  const tags = r.tags.filter((t) => t !== "Schnell");
  openModal(`
    ${sheetKopf(r.name)}
    <p class="rz-meta">${r.minuten} Min${tags.length ? " · " + esc(tags.join(", ")) : ""}</p>
    ${renderNaehrwerte(naehrwerte(r))}
    <div class="detail-portionen">
      <span>Zutaten für</span>
      <div class="stepper">
        <button data-action="detail-portionen" data-delta="-1" aria-label="Weniger">−</button>
        <span>${p} ${p === 1 ? "Portion" : "Portionen"}</span>
        <button data-action="detail-portionen" data-delta="1" aria-label="Mehr">+</button>
      </div>
    </div>
    <ul class="zutaten">${r.zutaten.map((z) => { const pz = parseZutat(z); return pz ? `<li>${esc(fmtZutat(pz, f))}</li>` : ""; }).join("")}</ul>
    <h3>Zubereitung</h3>
    ${p !== r.portionen ? `<p class="hinweis">Mengen im Text gelten für ${r.portionen} Portionen.</p>` : ""}
    <ol class="schritte">${r.schritte.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
    <div class="aktionen">
      <button class="btn" data-action="rezept-bearbeiten" data-id="${esc(r.id)}">Bearbeiten</button>
      <button class="btn gefahr" data-action="rezept-loeschen" data-id="${esc(r.id)}" data-bestaetigen="Wirklich löschen?">Löschen</button>
    </div>`);
}

function renderNaehrwerte(nw) {
  // Energieanteile: Eiweiß und Kohlenhydrate 4 kcal/g, Fett 9 kcal/g
  const e = nw.eiweiss * 4, k = nw.kh * 4, f = nw.fett * 9, ges = e + k + f || 1;
  const pz = (x) => Math.round((x / ges) * 100);
  const kachel = (wert, einheit, label) => `<div><strong>${zahlDe(wert)}${einheit}</strong><span>${label}</span></div>`;
  return `
    <div class="naehrwerte karte">
      <div class="nw-kopf"><span class="label">Pro Portion · ca.</span>${nwBadges(nw)}</div>
      <div class="nw-kacheln">
        ${kachel(nw.kcal, "", "kcal")}${kachel(nw.eiweiss, " g", "Eiweiß")}${kachel(nw.kh, " g", "Kohlenhydr.")}
        ${kachel(nw.fett, " g", "Fett")}${kachel(nw.ballast, " g", "Ballastst.")}
      </div>
      <div class="nw-balken" role="img" aria-label="Energieanteile">
        <span class="e" style="width:${pz(e)}%"></span><span class="k" style="width:${pz(k)}%"></span><span class="f" style="width:${pz(f)}%"></span>
      </div>
      <div class="nw-legende"><span class="e">Eiweiß ${pz(e)} %</span><span class="k">Kohlenhydrate ${pz(k)} %</span><span class="f">Fett ${pz(f)} %</span></div>
      ${nw.fehlend.length ? `<p class="hinweis">Ohne Nährwerte: ${esc([...new Set(nw.fehlend)].join(", "))}</p>` : ""}
    </div>`;
}

function editorOeffnen(id) {
  const r = id ? rezept(id) : { name: "", minuten: 20, portionen: 2, tags: [], zutaten: [], schritte: [] };
  openModal(`
    ${sheetKopf(id ? "Rezept bearbeiten" : "Neues Rezept")}
    <form class="formular" data-form="rezept" data-id="${esc(id || "")}">
      <label>Name<input name="name" required value="${esc(r.name)}"></label>
      <div class="zwei-spalten">
        <label>Zeit (Min)<input name="minuten" type="number" inputmode="numeric" min="1" value="${r.minuten}"></label>
        <label>Portionen<input name="portionen" type="number" inputmode="numeric" min="1" value="${r.portionen}"></label>
      </div>
      <label>Tags <small>(mit Komma getrennt, z. B. Pasta, Ofen, Sport)</small>
        <input name="tags" value="${esc(r.tags.join(", "))}"></label>
      <label>Zutaten <small>(eine pro Zeile: Menge, Einheit, Zutat – z. B. „120 g Rote Linsen“, „1 Dose Kichererbsen“)</small>
        <textarea name="zutaten" rows="8" data-input="zutaten-vorschau">${esc(r.zutaten.join("\n"))}</textarea></label>
      <ul class="vorschau" id="zutaten-vorschau"></ul>
      <label>Zubereitung <small>(ein Schritt pro Zeile)</small>
        <textarea name="schritte" rows="6">${esc(r.schritte.join("\n"))}</textarea></label>
      <div class="aktionen">
        <button class="btn primaer" type="submit">Speichern</button>
        <button class="btn" type="button" data-action="modal-zu">Abbrechen</button>
      </div>
    </form>`);
  zutatenVorschau($("#modal textarea[name=zutaten]"));
}

function zutatenVorschau(textarea) {
  const zeilen = textarea.value.split("\n").map(parseZutat).filter(Boolean);
  $("#zutaten-vorschau").innerHTML = zeilen.map((p) => {
    const neu = !KATALOG[p.name];
    const ohneNw = p.menge != null && !zutatGramm(p);
    const info = neu ? "neu · Sonstiges · ohne Nährwerte" : esc(kategorie(p.name)) + (ohneNw ? " · ohne Nährwerte" : "");
    return `<li><span>${esc(fmtZutat(p))}</span><span class="kat${neu || ohneNw ? " neu" : ""}">${info}</span></li>`;
  }).join("");
}

// ================= Ansicht: Einkaufsliste =================

function renderEinkauf() {
  const { wochen, basics } = state.einkauf;
  const s = ui.einkaufStart;
  const { kaufen, ausVorrat } = einkaufsliste(s, wochen, basics);
  const ab = state.abgehakt[periodeKey()] || {};
  const offen = kaufen.filter((it) => !ab[it.key]).length + state.extras.filter((x) => !ab[`extra:${x.id}`]).length;

  let html = `
    <div class="periodennav">
      <button class="icon-btn" data-action="einkauf-woche" data-delta="-7" aria-label="Früher">‹</button>
      <div class="periodennav-mitte"><strong>${kwText(s, wochen)}</strong><span>${zeitraumText(s, wochen)}</span></div>
      <button class="icon-btn" data-action="einkauf-woche" data-delta="7" aria-label="Später">›</button>
    </div>
    <div class="einkauf-optionen">
      <label>Zeitraum
        <select data-change="einkauf-wochen">
          ${[1, 2, 3, 4].map((n) => `<option value="${n}"${n === wochen ? " selected" : ""}>${n} ${n === 1 ? "Woche" : "Wochen"}</option>`).join("")}
        </select>
      </label>
      <label class="schalter"><input type="checkbox" data-change="einkauf-basics"${basics ? " checked" : ""}> Wochen-Basics</label>
    </div>
    <div class="export karte">
      <span><strong id="offen-zahl">${offen}</strong> Artikel offen</span>
      <div class="export-knoepfe">
        <button class="btn primaer" data-action="erinnerungen">In Erinnerungen</button>
        <button class="btn" data-action="kopieren">Kopieren</button>
      </div>
    </div>`;

  if (!kaufen.length && !state.extras.length) {
    html += `<p class="leer-hinweis">Für diesen Zeitraum ist noch nichts zu kaufen.<br>
      <button class="link-btn" data-action="tab" data-tab="plan">Zum Wochenplan</button></p>`;
  }

  for (const kat of KATEGORIEN) {
    const items = kaufen.filter((it) => kategorie(it.name) === kat).sort(sortiereNachKategorie);
    if (!items.length) continue;
    html += `<h3 class="kat-titel">${esc(kat)}</h3><ul class="einkauf">${items.map((it) => {
      const km = kaufMenge(it);
      const quellen = [...it.quellen].join(", ");
      const notizen = [km.notiz, it.hinweis].filter(Boolean).join(" · ");
      return `<li class="${ab[it.key] ? "erledigt" : ""}">
          <label class="check-zeile">
            <input type="checkbox" data-change="abhaken" data-key="${esc(it.key)}"${ab[it.key] ? " checked" : ""}>
            <span class="ez-text"><span class="ez-name">${esc(it.name)}</span>
              <span class="ez-quelle">${esc(quellen)}${notizen ? ` · <em>${esc(notizen)}</em>` : ""}</span></span>
            <span class="ez-menge">${esc(km.text)}</span>
          </label></li>`;
    }).join("")}</ul>`;
  }

  html += `<h3 class="kat-titel">Zusätzlich</h3>
    <ul class="einkauf">${state.extras.map((x) => {
      const k = `extra:${x.id}`;
      return `<li class="${ab[k] ? "erledigt" : ""}"><label class="check-zeile">
          <input type="checkbox" data-change="abhaken" data-key="${esc(k)}"${ab[k] ? " checked" : ""}>
          <span class="ez-text"><span class="ez-name">${esc(x.text)}</span></span>
          <button class="icon-btn klein" data-action="extra-loeschen" data-id="${esc(x.id)}" aria-label="Entfernen">×</button>
        </label></li>`;
    }).join("")}</ul>
    <form class="zeilen-form" data-form="extra">
      <input name="text" placeholder="z. B. Spülmittel, Kaffee" autocomplete="off">
      <button class="btn">Hinzufügen</button>
    </form>`;

  if (ausVorrat.length) {
    html += `<details class="karte vorrat-check">
      <summary>Aus dem Vorrat (${ausVorrat.length}) – kurz prüfen</summary>
      <ul>${ausVorrat.sort(sortiereNachKategorie).map((it) =>
        `<li><span>${esc(it.name)}</span><span class="ez-menge">${esc(fmtMenge(it.menge, it.einheit) || "etwas")} · ${esc(it.vorratText)}</span></li>`).join("")}</ul>
      <p class="hinweis">Falls etwas fehlt: im Tab „Vorrat“ abhaken, dann landet es hier auf der Liste.</p>
    </details>`;
  }

  html += `<div class="aktionen">
      <button class="btn" data-action="alles-gekauft">Alles als gekauft markieren</button>
      <button class="btn" data-action="abgehakt-reset">Haken zurücksetzen</button>
    </div>`;
  return html;
}

async function kopieren(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

// ================= Ansicht: Vorrat =================

function renderImBlick() {
  const liste = [...state.imBlick].sort((a, b) => a.ablauf.localeCompare(b.ablauf));
  return `
    <section class="karte">
      <h2>Im Blick · Haltbarkeit</h2>
      <p class="hinweis">Wenn du in der Einkaufsliste etwas abhakst, merkt sich die App das Kaufdatum und schätzt das MHD. Das gilt für Wochen-Basics wie Joghurt oder Quark und für alles, was nach dem Plan übrig bleibt. Das Datum kannst du hier korrigieren.</p>
      ${liste.length ? `<ul class="blick">${liste.map((x) => {
        const info = ablaufInfo(x.ablauf);
        return `<li class="${info.klasse}">
            <div class="blick-text"><span class="ez-name">${esc(x.text)}</span><span class="blick-status">${info.text}</span></div>
            <input type="date" value="${x.ablauf}" data-change="blick-datum" data-id="${esc(x.id)}" aria-label="Haltbar bis">
            <button class="btn klein" data-action="blick-weg" data-id="${esc(x.id)}">Verbraucht</button>
          </li>`;
      }).join("")}</ul>` : `<p class="leer-hinweis">Gerade nichts im Blick.</p>`}
      <form class="zeilen-form blick-form" data-form="blick-neu">
        <input name="text" placeholder="z. B. Joghurt, offener Feta" autocomplete="off">
        <input name="datum" type="date" aria-label="Haltbar bis (leer = schätzen)">
        <button class="btn">Hinzufügen</button>
      </form>
      <p class="hinweis">Ohne Datum schätzt die App das MHD aus der typischen Haltbarkeit.</p>
    </section>`;
}

function renderVorrat() {
  return `
    ${renderImBlick()}
    <h2 class="abschnitt">Vorrat</h2>
    <p class="hinweis">Was hier angehakt ist, kommt nicht auf die Einkaufsliste. Ohne Menge heißt „genug da“. Mit Menge wird nur der fehlende Rest eingekauft.</p>
    <input type="search" class="suche" placeholder="Zutat suchen…" data-input="vorrat-suche" value="${esc(ui.vorratSuche)}" autocomplete="off">
    <div id="vorrat-liste"></div>
    <form class="zeilen-form" data-form="vorrat-neu">
      <input name="text" placeholder="Weitere Zutat, z. B. Tahini" autocomplete="off">
      <button class="btn">Hinzufügen</button>
    </form>
    <div class="aktionen">
      <button class="btn gefahr" data-action="vorrat-reset" data-bestaetigen="Wirklich zurücksetzen?">Auf Grundvorrat zurücksetzen</button>
    </div>`;
}

function renderVorratListe() {
  const idx = zutatenIndex();
  const q = ui.vorratSuche.trim().toLowerCase();
  const namen = [...idx.keys()].filter((n) => !q || n.toLowerCase().includes(q));
  let html = "";
  for (const kat of KATEGORIEN) {
    const liste = namen.filter((n) => kategorie(n) === kat).sort((a, b) => a.localeCompare(b, "de"));
    if (!liste.length) continue;
    html += `<h3 class="kat-titel">${esc(kat)}</h3><ul class="vorrat">${liste.map((n) => {
      const v = state.vorrat[n];
      return `<li>
          <label class="check-zeile">
            <input type="checkbox" data-change="vorrat-da" data-name="${esc(n)}"${v ? " checked" : ""}>
            <span class="ez-name">${esc(n)}</span>
          </label>
          <input type="number" inputmode="decimal" min="0" step="any" class="menge-input" placeholder="genug"
            data-change="vorrat-menge" data-name="${esc(n)}" value="${v?.menge ?? ""}"${v ? "" : " disabled"}>
          <span class="einheit">${esc(einheitLabel(v?.einheit || haupteinheit(n, idx)))}</span>
        </li>`;
    }).join("")}</ul>`;
  }
  $("#vorrat-liste").innerHTML = html || `<p class="leer-hinweis">Nichts gefunden.</p>`;
}

// ================= Ansicht: Einstellungen =================

function renderMehr() {
  const e = state.einstellungen;
  return `
    <section class="karte">
      <h2>Frühstück</h2>
      <p class="hinweis">Steht jeden Tag gleich im Plan. Die Zutaten dafür gehören in die Wochen-Basics.</p>
      <textarea rows="3" data-change="fruehstueck">${esc(e.fruehstueck)}</textarea>
    </section>

    <section class="karte">
      <h2>Wochen-Basics</h2>
      <p class="hinweis">Kommen jede Woche auf die Einkaufsliste (Frühstück, Snacks). Eine Zeile pro Artikel, z. B. „500 g Skyr“.</p>
      <textarea rows="9" data-change="basics">${esc(e.basics.join("\n"))}</textarea>
    </section>

    <section class="karte">
      <h2>Einkauf & Haltbarkeit</h2>
      <label class="feld">Großeinkauf für die Woche meistens am
        <select data-change="einkaufstag">${TAGE_LANG.map((t, i) =>
          `<option value="${i}"${state.einstellungen.einkaufstag === i ? " selected" : ""}>${t}${i ? " (vor der Woche)" : ""}</option>`).join("")}
        </select>
      </label>
      <p class="hinweis">Daraus berechnet der Plan, wie lange frische Zutaten bis zum Kochtag liegen. Sobald du in der Einkaufsliste etwas abhakst, nimmt die App das echte Kaufdatum.</p>
    </section>

    <section class="karte">
      <h2>Sporttage</h2>
      <div class="chips">${TAGE.map((t, i) => `
        <label class="chip-check"><input type="checkbox" data-change="sporttag" data-tag="${i}"${e.sporttage.includes(i) ? " checked" : ""}><span>${t}</span></label>`).join("")}
      </div>
      <details><summary>Tipps für Sporttage</summary><ul class="liste">${SPORT_TIPPS.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></details>
    </section>

    <section class="karte">
      <h2>Apple Erinnerungen</h2>
      <p class="hinweis">„In Erinnerungen“ startet einen Kurzbefehl, der jede offene Zeile der Einkaufsliste als eigenen Eintrag anlegt. Ohne Kurzbefehl geht auch „Kopieren“ und in Erinnerungen einfügen – jede Zeile wird ein Eintrag.</p>
      <label>Name des Kurzbefehls<input data-change="kurzbefehl" value="${esc(e.kurzbefehl)}"></label>
      <details><summary>Kurzbefehl einrichten (einmalig, ca. 2 Min)</summary>
        <ol class="liste">
          <li>App <strong>Kurzbefehle</strong> öffnen, oben rechts auf <strong>+</strong> tippen und den Kurzbefehl genau so nennen wie oben eingetragen.</li>
          <li>Aktion <strong>„Text teilen“</strong> (engl. „Split Text“) hinzufügen. Als Text die <strong>Kurzbefehleingabe</strong> wählen, Trennzeichen: <strong>Neue Zeilen</strong>.</li>
          <li>Aktion <strong>„Wiederholen mit jedem Objekt“</strong> (engl. „Repeat with Each“) hinzufügen, Eingabe: <strong>Geteilter Text</strong>.</li>
          <li>In die Schleife die Aktion <strong>„Erinnerung hinzufügen“</strong> (engl. „Add New Reminder“) ziehen. Text: <strong>Wiederholungsobjekt</strong>, Liste: deine Einkaufsliste.</li>
          <li>Fertig. Beim ersten Start fragt iOS einmal nach der Erlaubnis.</li>
        </ol>
        <p class="hinweis">Tipp: Wenn die Liste in Erinnerungen als Listentyp <strong>Einkaufsliste</strong> angelegt ist (ab iOS 17), sortiert iOS die Artikel automatisch nach Kategorien.</p>
      </details>
    </section>

    <section class="karte">
      <h2>Daten</h2>
      <p class="hinweis">Alles wird nur auf diesem Gerät gespeichert. Mit Export und Import kannst du deine Daten sichern oder auf ein anderes Gerät übertragen.</p>
      <div class="aktionen">
        <button class="btn" data-action="export">Exportieren</button>
        <label class="btn">Importieren<input type="file" accept="application/json,.json" data-change="import" hidden></label>
        <button class="btn gefahr" data-action="alles-reset" data-bestaetigen="Wirklich alles löschen?">Alles zurücksetzen</button>
      </div>
    </section>`;
}

// ================= Aktionen (Klicks) =================

const AKTIONEN = {
  "modal-zu": () => closeModal(),
  tab: (d) => { closeModal(); ui.tab = d.tab; render(); window.scrollTo(0, 0); },

  // Wochenplan
  woche: (d) => { ui.woche = addTage(ui.woche, +d.delta); render(); },
  "woche-heute": () => { ui.woche = montag(heute()); render(); },
  waehlen: (d) => pickerOeffnen(d.datum, d.slot),
  "waehle-rezept": (d) => {
    const { datum, slot } = ui.picker;
    loesche(datum, slot);
    slotSet(datum, slot, { typ: "rezept", id: d.id, portionen: 1, rest: false });
    closeModal();
    speichernRender();
  },
  "reste-waehlen": (d) => {
    restAn(...vorheriger(d.datum, d.slot));
    closeModal();
    speichernRender();
  },
  "slot-loeschen": (d) => { loesche(d.datum, d.slot); speichernRender(); },
  portionen: (d) => {
    const e = slotGet(d.datum, d.slot);
    if (!e) return;
    e.portionen = Math.max(e.rest ? 2 : 1, e.portionen + +d.delta);
    speichernRender();
  },
  rest: (d) => {
    const e = slotGet(d.datum, d.slot);
    if (!e) return;
    if (e.rest) restAus(d.datum, d.slot); else restAn(d.datum, d.slot);
    speichernRender();
  },
  vorlagen: () => vorlagenOeffnen(),
  "vorlage-anwenden": (d) => {
    vorlageAnwenden(ui.woche, +d.index);
    closeModal();
    speichernRender();
    toast(`${PLAN_VORLAGEN[+d.index].name} geladen`);
  },
  "woche-leeren": () => {
    for (let t = 0; t < 7; t++) { loesche(addTage(ui.woche, t), "m"); loesche(addTage(ui.woche, t), "a"); }
    speichernRender();
  },
  "woche-einkauf": () => {
    ui.einkaufStart = ui.woche;
    state.einkauf.wochen = 1;
    ui.tab = "einkauf";
    speichernRender();
    window.scrollTo(0, 0);
  },

  // Rezepte
  filter: (d) => {
    if (d.ziel === "rezepte") {
      ui.rezeptFilter = ui.rezeptFilter === d.wert ? null : d.wert;
      renderRezeptListe();
    } else if (ui.picker) {
      ui.picker.filter = ui.picker.filter === d.wert ? null : d.wert;
      $("#picker-filter").innerHTML = filterChips(ui.picker.filter, "picker");
      renderPickerListe();
    }
  },
  "rezept-zeigen": (d) => rezeptZeigen(d.id, d.portionen ? +d.portionen : null),
  "detail-portionen": (d) => { ui.detail.portionen = Math.max(1, ui.detail.portionen + +d.delta); renderDetail(); },
  "rezept-neu": () => editorOeffnen(null),
  "rezept-bearbeiten": (d) => editorOeffnen(d.id),
  "rezept-loeschen": (d) => {
    state.rezepte = state.rezepte.filter((r) => r.id !== d.id);
    if (STANDARD_REZEPTE.some((r) => r.id === d.id)) state.geloeschteStandard.push(d.id);
    closeModal();
    speichernRender();
    toast("Rezept gelöscht");
  },

  // Einkauf
  "einkauf-woche": (d) => { ui.einkaufStart = addTage(ui.einkaufStart, +d.delta); render(); },
  erinnerungen: () => {
    const zeilen = exportZeilen();
    if (!zeilen.length) { toast("Keine offenen Artikel"); return; }
    const name = state.einstellungen.kurzbefehl || STANDARD_EINSTELLUNGEN.kurzbefehl;
    window.location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(name)}&input=text&text=${encodeURIComponent(zeilen.join("\n"))}`;
  },
  kopieren: async () => {
    const zeilen = exportZeilen();
    if (!zeilen.length) { toast("Keine offenen Artikel"); return; }
    toast((await kopieren(zeilen.join("\n"))) ? `${zeilen.length} Artikel kopiert` : "Kopieren nicht möglich");
  },
  "extra-loeschen": (d) => { state.extras = state.extras.filter((x) => x.id !== d.id); speichernRender(); },
  "abgehakt-reset": () => {
    const ab = state.abgehakt[periodeKey()] || {};
    Object.keys(ab).forEach((key) => gekauftMerken(key, false));
    delete state.abgehakt[periodeKey()];
    speichernRender();
  },
  "alles-gekauft": () => {
    const ab = (state.abgehakt[periodeKey()] ||= {});
    const { kaufen } = einkaufsliste(ui.einkaufStart, state.einkauf.wochen, state.einkauf.basics);
    for (const it of kaufen) if (!ab[it.key]) { ab[it.key] = true; gekauftMerken(it.key, true); }
    state.extras.forEach((x) => { ab[`extra:${x.id}`] = true; });
    speichernRender();
    toast("Als gekauft markiert");
  },
  "blick-weg": (d) => { state.imBlick = state.imBlick.filter((x) => x.id !== d.id); speichernRender(); },

  // Vorrat & Daten
  "vorrat-reset": () => { state.vorrat = neuerState().vorrat; speichernRender(); },
  export: () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `essensplaner-${heute()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  "alles-reset": () => { state = neuerState(); speichernRender(); toast("Zurückgesetzt"); },
};

document.addEventListener("click", (ev) => {
  const el = ev.target.closest("[data-action]");
  if (!el) return;
  // Gefährliche Aktionen brauchen einen zweiten Tipp
  if (el.dataset.bestaetigen && !el.classList.contains("scharf")) {
    ev.preventDefault();
    const original = el.textContent;
    el.classList.add("scharf");
    el.textContent = el.dataset.bestaetigen;
    setTimeout(() => { if (el.isConnected) { el.classList.remove("scharf"); el.textContent = original; } }, 3000);
    return;
  }
  const fn = AKTIONEN[el.dataset.action];
  if (fn) { ev.preventDefault(); fn(el.dataset, el); }
});

// ================= Eingaben (change / input / submit) =================

const AENDERUNGEN = {
  "einkauf-wochen": (el) => { state.einkauf.wochen = +el.value; speichernRender(); },
  "einkauf-basics": (el) => { state.einkauf.basics = el.checked; speichernRender(); },
  abhaken: (el) => {
    const pk = periodeKey();
    const ab = (state.abgehakt[pk] ||= {});
    if (el.checked) ab[el.dataset.key] = true; else delete ab[el.dataset.key];
    if (!el.dataset.key.startsWith("extra:")) gekauftMerken(el.dataset.key, el.checked);
    speichern();
    el.closest("li").classList.toggle("erledigt", el.checked);
    $("#offen-zahl").textContent = +$("#offen-zahl").textContent + (el.checked ? -1 : 1);
  },
  "vorrat-da": (el) => {
    const n = el.dataset.name;
    const input = el.closest("li").querySelector(".menge-input");
    if (el.checked) state.vorrat[n] = { menge: null, einheit: haupteinheit(n) };
    else { delete state.vorrat[n]; input.value = ""; }
    input.disabled = !el.checked;
    speichern();
  },
  "vorrat-menge": (el) => {
    const v = state.vorrat[el.dataset.name];
    if (!v) return;
    const zahl = parseZahl(el.value || "");
    v.menge = el.value.trim() === "" || zahl == null ? null : zahl;
    v.einheit ||= haupteinheit(el.dataset.name);
    speichern();
  },
  fruehstueck: (el) => { state.einstellungen.fruehstueck = el.value.trim(); speichern(); toast("Gespeichert"); },
  basics: (el) => {
    state.einstellungen.basics = el.value.split("\n").map((z) => z.trim()).filter(Boolean);
    speichern();
    toast("Gespeichert");
  },
  sporttag: (el) => {
    const t = +el.dataset.tag;
    const s = new Set(state.einstellungen.sporttage);
    if (el.checked) s.add(t); else s.delete(t);
    state.einstellungen.sporttage = [...s].sort();
    speichern();
  },
  einkaufstag: (el) => { state.einstellungen.einkaufstag = +el.value; speichern(); toast("Gespeichert"); },
  "blick-datum": (el) => {
    const x = state.imBlick.find((i) => i.id === el.dataset.id);
    if (!x || !el.value) return;
    x.ablauf = el.value;
    speichernRender();
  },
  kurzbefehl: (el) => { state.einstellungen.kurzbefehl = el.value.trim(); speichern(); toast("Gespeichert"); },
  import: (el) => {
    const datei = el.files?.[0];
    if (!datei) return;
    const reader = new FileReader();
    reader.onload = () => {
      const neu = laden(reader.result);
      if (!Array.isArray(neu.rezepte) || !neu.rezepte.length) { toast("Datei nicht erkannt"); return; }
      state = neu;
      speichernRender();
      toast("Daten importiert");
    };
    reader.readAsText(datei);
  },
};

const EINGABEN = {
  "picker-suche": (el) => { ui.picker.suche = el.value; renderPickerListe(); },
  "rezept-suche": (el) => { ui.rezeptSuche = el.value; renderRezeptListe(); },
  "vorrat-suche": (el) => { ui.vorratSuche = el.value; renderVorratListe(); },
  "zutaten-vorschau": (el) => zutatenVorschau(el),
};

const feld = (form, name) => form.elements.namedItem(name)?.value ?? "";

const FORMULARE = {
  frei: (f) => {
    const text = feld(f, "text").trim();
    if (!text) return;
    const { datum, slot } = ui.picker;
    loesche(datum, slot);
    slotSet(datum, slot, { typ: "frei", text });
    closeModal();
    speichernRender();
  },
  extra: (f) => {
    const text = feld(f, "text").trim();
    if (!text) return;
    state.extras.push({ id: Date.now().toString(36), text });
    speichernRender();
    $("form[data-form=extra] input")?.focus();
  },
  "vorrat-neu": (f) => {
    if (!feld(f, "text").trim()) return;
    const name = kanonischerName(feld(f, "text"));
    state.vorrat[name] = { menge: null, einheit: haupteinheit(name) };
    speichernRender();
    toast(`${name} im Vorrat`);
  },
  "blick-neu": (f) => {
    const text = feld(f, "text").trim();
    if (!text) return;
    const name = kanonischerName(text);
    let ablauf = feld(f, "datum");
    if (!ablauf) {
      const h = HALTBARKEIT[name];
      ablauf = addTage(heute(), h ? h[0] : 7);
      toast(h ? `MHD geschätzt: ${kurzDatum(ablauf)}` : "Unbekannt – 7 Tage angenommen, bitte prüfen");
    }
    state.imBlick.push({ id: Date.now().toString(36), name, text, gekauft: heute(), ablauf, quelle: "manuell" });
    speichernRender();
  },
  rezept: (f) => {
    const zeilen = (name) => feld(f, name).split("\n").map((z) => z.trim()).filter(Boolean);
    const daten = {
      name: feld(f, "name").trim(),
      minuten: Math.max(1, +feld(f, "minuten") || 20),
      portionen: Math.max(1, +feld(f, "portionen") || 1),
      tags: feld(f, "tags").split(",").map((t) => t.trim()).filter(Boolean),
      zutaten: zeilen("zutaten"),
      schritte: zeilen("schritte"),
    };
    if (!daten.name) return;
    let id = f.dataset.id;
    if (id) {
      Object.assign(rezept(id), daten);
    } else {
      const slug = daten.name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      id = `${slug || "rezept"}-${Date.now().toString(36)}`;
      state.rezepte.push({ id, ...daten });
    }
    speichern();
    if (ui.tab === "rezepte") renderRezeptListe();
    rezeptZeigen(id);
    toast("Rezept gespeichert");
  },
};

document.addEventListener("change", (ev) => {
  const k = ev.target.dataset?.change;
  if (k && AENDERUNGEN[k]) AENDERUNGEN[k](ev.target);
});
document.addEventListener("input", (ev) => {
  const k = ev.target.dataset?.input;
  if (k && EINGABEN[k]) EINGABEN[k](ev.target);
});
document.addEventListener("submit", (ev) => {
  const k = ev.target.dataset?.form;
  if (!k) return;
  ev.preventDefault();
  FORMULARE[k]?.(ev.target);
});
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && !$("#modal").hidden) closeModal();
});

// ================= Start =================

render();

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
