// Variables used by Scriptable: icon-color: yellow; icon-glyph: moon;
// Moon Phase + Myanmar Calendar widget
//
// Supports: Home Screen small / medium, Lock Screen circular / rectangular / inline.
// Widget parameter (optional): golden | classic | ocean | rose | jade | blood
//
// Moon phase = astronomical formula. Myanmar date = traditional (Irwin) algorithm,
// so full/new moon day may differ by one day from the real moon.

const PRESETS = {
  golden:  { lit: '#ffd54a', shadow: '#2b2308', bg: '#0b0b0e' },
  classic: { lit: '#ecebe6', shadow: '#26262c', bg: '#09090b' },
  ocean:   { lit: '#9ad0ff', shadow: '#12284a', bg: '#07101f' },
  rose:    { lit: '#ff9bb5', shadow: '#3a1424', bg: '#12080d' },
  jade:    { lit: '#8ff0c0', shadow: '#0d3326', bg: '#06130e' },
  blood:   { lit: '#ff6a4d', shadow: '#3a100a', bg: '#120706' },
};
const DEFAULT_PRESET = 'golden';
const SOUTHERN_HEMISPHERE = false;

// ---------- Shared core (astronomy + Myanmar calendar) ----------
// Single source of truth: moon-core.js, hosted on GitHub Pages next to calendar.html.
// Cached in the Scriptable folder: the network is only used on first run and then
// at most once a week to pick up updates, so the widget normally works fully offline.
const CORE_URL = 'https://thawhtetkaung.github.io/pages/moon-core.js';
const CALENDAR_URL = CORE_URL.replace('moon-core.js', 'calendar.html');   // opened when the widget is tapped
const CORE_MAX_AGE_MS = 7 * 24 * 3600 * 1000;

async function loadCore() {
  const fm = FileManager.local();
  const path = fm.joinPath(fm.documentsDirectory(), 'moon-core.js');
  const cached = fm.fileExists(path);
  const fresh = cached && Date.now() - fm.modificationDate(path).getTime() < CORE_MAX_AGE_MS;
  let code = cached ? fm.readString(path) : null;
  if (!fresh) {
    try {
      const req = new Request(CORE_URL);
      req.timeoutInterval = 5;
      const net = await req.loadString();
      if (!net.includes('module.exports')) throw new Error('bad core');
      fm.writeString(path, net);
      code = net;
    } catch (e) {
      if (!cached) throw new Error('Cannot load moon-core.js: ' + e);
      fm.writeString(path, code);          // offline: keep cache, retry in a week
    }
  }
  const module = { exports: {} };
  new Function('module', code)(module);
  return module.exports;
}
const { RAD, elongation, findPhases, jdnToMyanmar, gregToJdn, numMy, MM_NAMES, GREG_MONTHS_MY: GREG_MONTHS } = await loadCore();

// ---------- Myanmar text ----------
const monthName = m => (m.late ? 'နှောင်း' : '') + MM_NAMES[m.k];
const dayText = m => m.phase === 'full' ? 'လပြည့်' : m.phase === 'new' ? 'လကွယ်'
  : `${m.phase === 'waxing' ? 'လဆန်း' : 'လဆုတ်'} ${numMy(m.pday)} ရက်`;
const dayTextShort = m => m.phase === 'full' ? 'လပြည့်' : m.phase === 'new' ? 'လကွယ်'
  : `${m.phase === 'waxing' ? 'လဆန်း' : 'လဆုတ်'} ${numMy(m.pday)}`;
const QNAME = ['လကွယ်', 'လဆန်း တစ်ဝက်', 'လပြည့်', 'လဆုတ် တစ်ဝက်'];
const dateMy = jd => { const d = new Date((jd - 2440587.5) * 864e5); return `${numMy(d.getDate())} ${GREG_MONTHS[d.getMonth()]}`; };

// ---------- Moon drawing ----------
// D = elongation in degrees. Draws onto a transparent canvas of `size` points.
function moonImage(D, size, lit, shadow, outline) {
  const dc = new DrawContext();
  dc.size = new Size(size, size);
  dc.opaque = false;
  dc.respectScreenScale = true;
  const pad = size * 0.03, r = size / 2 - pad, c = size / 2;
  // dark disc
  dc.setFillColor(shadow);
  dc.fillEllipse(new Rect(c - r, c - r, 2 * r, 2 * r));
  const cosD = Math.cos(D * RAD);
  const illum = (1 - cosD) / 2;
  if (illum > 0.996) {
    dc.setFillColor(lit);
    dc.fillEllipse(new Rect(c - r, c - r, 2 * r, 2 * r));
  } else if (illum > 0.004) {
    const waxing = Math.sin(D * RAD) > 0;
    const s = (waxing !== SOUTHERN_HEMISPHERE) ? 1 : -1;   // +1 = lit on the right
    const path = new Path();
    const N = 48;
    for (let i = 0; i <= N; i++) {                          // outer limb, top -> bottom
      const t = (-90 + 180 * i / N) * RAD;
      const p = new Point(c + s * r * Math.cos(t), c + r * Math.sin(t));
      i === 0 ? path.move(p) : path.addLine(p);
    }
    for (let i = 0; i <= N; i++) {                          // terminator, bottom -> top
      const t = (90 - 180 * i / N) * RAD;
      path.addLine(new Point(c + s * cosD * r * Math.cos(t), c + r * Math.sin(t)));
    }
    path.closeSubpath();
    dc.addPath(path);
    dc.setFillColor(lit);
    dc.fillPath();
  }
  if (outline) {
    dc.setStrokeColor(outline);
    dc.setLineWidth(Math.max(1, size * 0.02));
    dc.strokeEllipse(new Rect(c - r, c - r, 2 * r, 2 * r));
  }
  return dc.getImage();
}

// ---------- Data ----------
const now = new Date();
const nowJd = now.getTime() / 864e5 + 2440587.5;
const D = elongation(nowJd);
const my = jdnToMyanmar(gregToJdn(now.getFullYear(), now.getMonth(), now.getDate()));
const illumPct = Math.round((1 - Math.cos(D * RAD)) / 2 * 100);
const phaseEmoji = ['🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘'][Math.round(D / 45) % 8];

function nextPhases() {
  const list = findPhases(nowJd, nowJd + 35);
  return { full: list.find(p => p.q === 2), nw: list.find(p => p.q === 0) };
}

// ---------- Widgets ----------
const theme = PRESETS[(args.widgetParameter || DEFAULT_PRESET).toString().trim().toLowerCase()] || PRESETS[DEFAULT_PRESET];
const LIT = new Color(theme.lit), SHADOW = new Color(theme.shadow), BG = new Color(theme.bg);
const WHITE = Color.white(), DIM = new Color('#ffffff', 0.28), SOFT = new Color('#ffffff', 0.65);

function addText(stack, text, size, color, weight) {
  const t = stack.addText(text);
  t.font = weight === 'bold' ? Font.boldSystemFont(size) : Font.systemFont(size);
  t.textColor = color;
  t.minimumScaleFactor = 0.6;
  t.lineLimit = 1;
  return t;
}

function lockCircular() {
  const w = new ListWidget();
  w.addAccessoryWidgetBackground = true;
  const img = w.addImage(moonImage(D, 120, WHITE, DIM, null));
  img.imageSize = new Size(42, 42);
  img.centerAlignImage();
  return w;
}

function lockRectangular() {
  const w = new ListWidget();
  const row = w.addStack();
  row.centerAlignContent();
  const img = row.addImage(moonImage(D, 120, WHITE, DIM, SOFT));
  img.imageSize = new Size(40, 40);
  row.addSpacer(8);
  const col = row.addStack();
  col.layoutVertically();
  addText(col, monthName(my), 15, WHITE, 'bold');
  addText(col, dayText(my), 14, WHITE);
  return w;
}

function lockInline() {
  const w = new ListWidget();
  addText(w, `${phaseEmoji} ${monthName(my)} ${dayTextShort(my)}`, 14, WHITE);
  return w;
}

function homeSmall() {
  const w = new ListWidget();
  w.backgroundColor = BG;
  w.setPadding(12, 12, 12, 12);
  const img = w.addImage(moonImage(D, 220, LIT, SHADOW, new Color(theme.lit, 0.3)));
  img.imageSize = new Size(86, 86);
  img.centerAlignImage();
  w.addSpacer(8);
  const a = addText(w, monthName(my), 16, LIT, 'bold'); a.centerAlignText();
  const b = addText(w, dayText(my), 14, WHITE); b.centerAlignText();
  return w;
}

function homeMedium() {
  const w = new ListWidget();
  w.backgroundColor = BG;
  w.setPadding(14, 16, 14, 16);
  const row = w.addStack();
  row.centerAlignContent();
  const img = row.addImage(moonImage(D, 260, LIT, SHADOW, new Color(theme.lit, 0.3)));
  img.imageSize = new Size(104, 104);
  row.addSpacer(18);
  const col = row.addStack();
  col.layoutVertically();
  addText(col, `${monthName(my)} · မြန်မာ့ခုနှစ် ${numMy(my.my)}`, 15, LIT, 'bold');
  col.addSpacer(2);
  addText(col, dayText(my), 20, WHITE, 'bold');
  col.addSpacer(2);
  addText(col, `${numMy(now.getDate())} ${GREG_MONTHS[now.getMonth()]} ${numMy(now.getFullYear())} · ${numMy(illumPct)}%`, 12, SOFT);
  col.addSpacer(8);
  const { full, nw } = nextPhases();
  [[full, 2], [nw, 0]].sort((p, q) => (p[0] ? p[0].jd : 9e9) - (q[0] ? q[0].jd : 9e9)).forEach(([p, q]) => {
    if (p) addText(col, `${QNAME[q]} · ${dateMy(p.jd)}`, 12, WHITE);
  });
  return w;
}

const family = config.widgetFamily;
let widget;
switch (family) {
  case 'accessoryCircular': widget = lockCircular(); break;
  case 'accessoryRectangular': widget = lockRectangular(); break;
  case 'accessoryInline': widget = lockInline(); break;
  case 'small': widget = homeSmall(); break;
  default: widget = homeMedium();
}
widget.url = CALENDAR_URL;
widget.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);

if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  // Preview inside the Scriptable app
  const menu = new Alert();
  menu.title = 'Preview';
  ['Small', 'Medium', 'Lock: Rectangular', 'Lock: Circular', 'Lock: Inline'].forEach(t => menu.addAction(t));
  const i = await menu.presentAlert();
  if (i === 0) await homeSmall().presentSmall();
  else if (i === 1) await homeMedium().presentMedium();
  else if (i === 2) await lockRectangular().presentAccessoryRectangular();
  else if (i === 3) await lockCircular().presentAccessoryCircular();
  else await lockInline().presentAccessoryInline();
}
Script.complete();
