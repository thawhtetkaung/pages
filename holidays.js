// Public holidays for the calendar page (Japan + Myanmar). Loaded after moon-core.js.
// Plain script, no dependencies. Mostly computed by rule; only irregular dates live in the tables below.
//
// holidaysFor(year, { japan, myanmar }) -> { 'm-d': [{ c: 'jp'|'mm', en, loc }] }   (m is 0-based)
//   loc = Japanese name for 'jp', Myanmar name for 'mm'.

// ---------- Irregular dates: edit these ----------
// Myanmar holidays with no fixed rule (Islamic / Hindu festivals, extra days announced by the government).
// Verify against the official announcement each year.
const MM_EXTRA = {
  2026: [
    { date: '2026-05-27', en: 'Eid al-Adha', loc: 'ဗကြီးအိုက်ဒ်' },
    { date: '2026-11-08', en: 'Diwali', loc: 'ဒီပါဝလီ' },
  ],
};
// Japan: one-off moves of rule-based holidays. Rules below are valid for 2022-2099.
const JP_FIRST_YEAR = 2022, JP_LAST_YEAR = 2099;

// ---------- Helpers ----------
const keyOf = date => `${date.getMonth()}-${date.getDate()}`;
function nthMonday(y, m, n) {
  const first = new Date(y, m, 1).getDay();
  return 1 + ((8 - first) % 7) + 7 * (n - 1);
}
const springEquinox = y => Math.floor(20.8431 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));
const autumnEquinox = y => Math.floor(23.2488 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));

// ---------- Japan ----------
function japanHolidays(y) {
  if (y < JP_FIRST_YEAR || y > JP_LAST_YEAR) return [];
  const H = (m, d, en, loc) => ({ m, d, en, loc });
  const list = [
    H(0, 1, "New Year's Day", '元日'),
    H(0, nthMonday(y, 0, 2), 'Coming of Age Day', '成人の日'),
    H(1, 11, 'National Foundation Day', '建国記念の日'),
    H(1, 23, "Emperor's Birthday", '天皇誕生日'),
    H(2, springEquinox(y), 'Vernal Equinox Day', '春分の日'),
    H(3, 29, 'Showa Day', '昭和の日'),
    H(4, 3, 'Constitution Memorial Day', '憲法記念日'),
    H(4, 4, 'Greenery Day', 'みどりの日'),
    H(4, 5, "Children's Day", 'こどもの日'),
    H(6, nthMonday(y, 6, 3), 'Marine Day', '海の日'),
    H(7, 11, 'Mountain Day', '山の日'),
    H(8, nthMonday(y, 8, 3), 'Respect for the Aged Day', '敬老の日'),
    H(8, autumnEquinox(y), 'Autumnal Equinox Day', '秋分の日'),
    H(9, nthMonday(y, 9, 2), 'Sports Day', 'スポーツの日'),
    H(10, 3, 'Culture Day', '文化の日'),
    H(10, 23, 'Labor Thanksgiving Day', '勤労感謝の日'),
  ];
  const taken = new Set(list.map(h => `${h.m}-${h.d}`));
  const isHoliday = date => taken.has(keyOf(date));
  // Substitute holiday: a holiday on Sunday moves to the next day that is not already a holiday
  list.slice().forEach(h => {
    if (new Date(y, h.m, h.d).getDay() !== 0) return;
    const d = new Date(y, h.m, h.d + 1);
    while (isHoliday(d)) d.setDate(d.getDate() + 1);
    if (d.getFullYear() !== y) return;
    list.push(H(d.getMonth(), d.getDate(), 'Substitute Holiday', '振替休日'));
    taken.add(keyOf(d));
  });
  // Citizens' holiday: a normal weekday sandwiched between two holidays
  for (let d = new Date(y, 0, 2); d.getFullYear() === y; d.setDate(d.getDate() + 1)) {
    if (isHoliday(d) || d.getDay() === 0) continue;
    const prev = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    if (isHoliday(prev) && isHoliday(next)) list.push(H(d.getMonth(), d.getDate(), "Citizens' Holiday", '国民の休日'));
  }
  return list.map(h => ({ c: 'jp', m: h.m, d: h.d, en: h.en, loc: h.loc }));
}

// ---------- Myanmar ----------
const MM_FIXED = [
  [0, 4, 'Independence Day', 'လွတ်လပ်ရေးနေ့'],
  [1, 12, 'Union Day', 'ပြည်ထောင်စုနေ့'],
  [2, 2, "Peasants' Day", 'တောင်သူလယ်သမားနေ့'],
  [2, 27, "Armed Forces Day", 'တပ်မတော်နေ့'],
  [4, 1, 'Labour Day', 'အလုပ်သမားနေ့'],
  [6, 19, "Martyrs' Day", 'အာဇာနည်နေ့'],
  [11, 25, 'Christmas Day', 'ခရစ္စမတ်နေ့'],
];
// Full-moon holidays by Myanmar month
const MM_FULLMOON = {
  tabaung: ['Tabaung Full Moon Day', 'တပေါင်းလပြည့်နေ့'],
  kason: ['Buddha Day (Kason Full Moon)', 'ကဆုန်လပြည့်နေ့'],
  waso: ['Waso Full Moon Day', 'ဝါဆိုလပြည့်နေ့'],
  tazaungmon: ['Tazaungmon Full Moon Day', 'တန်ဆောင်မုန်းလပြည့်နေ့'],
};
const jdnToDate = jdn => { const u = new Date((jdn - 2440588) * 864e5); return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate()); };

function myanmarHolidays(y) {
  const out = [];
  const add = (date, en, loc) => out.push({ c: 'mm', m: date.getMonth(), d: date.getDate(), en, loc });
  MM_FIXED.forEach(([m, d, en, loc]) => add(new Date(y, m, d), en, loc));
  // Thingyan: the 4 days ending on akya (sun enters Aries), then New Year's Day
  const akya = Math.floor(SY * (y - 638) + MO + 0.5);
  for (let i = 3; i >= 0; i--) add(jdnToDate(akya - i), 'Thingyan (Water Festival)', 'သင်္ကြန်');
  add(jdnToDate(akya + 1), "Myanmar New Year's Day", 'မြန်မာနှစ်သစ်ကူး');
  // Lunar holidays
  for (let d = new Date(y, 0, 1); d.getFullYear() === y; d.setDate(d.getDate() + 1)) {
    const mm = jdnToMyanmar(gregToJdn(y, d.getMonth(), d.getDate()));
    if (mm.late) continue;
    if (mm.phase === 'full' && MM_FULLMOON[mm.k]) add(d, ...MM_FULLMOON[mm.k]);
    if (mm.k === 'thadingyut' && mm.md >= 14 && mm.md <= 16) add(d, 'Thadingyut Festival', 'သီတင်းကျွတ်ပွဲတော်');
    if (mm.k === 'tazaungmon' && mm.md === 25) add(d, 'National Day', 'အမျိုးသားနေ့');
    if (mm.k === 'pyatho' && mm.md === 1) add(d, 'Karen New Year', 'ကရင်နှစ်သစ်ကူး');
  }
  (MM_EXTRA[y] || []).forEach(h => { const [yy, mo, dd] = h.date.split('-').map(Number); add(new Date(yy, mo - 1, dd), h.en, h.loc); });
  return out;
}

// ---------- Public API ----------
const holidayCache = {};
function holidaysFor(y, { japan = true, myanmar = false } = {}) {
  const ck = `${y}-${japan}-${myanmar}`;
  if (holidayCache[ck]) return holidayCache[ck];
  const map = {};
  [...(japan ? japanHolidays(y) : []), ...(myanmar ? myanmarHolidays(y) : [])].forEach(h => {
    const k = `${h.m}-${h.d}`;
    const arr = map[k] || (map[k] = []);
    if (!arr.some(x => x.c === h.c && x.en === h.en)) arr.push({ c: h.c, en: h.en, loc: h.loc });
  });
  return (holidayCache[ck] = map);
}

if (typeof module !== 'undefined') module.exports = { holidaysFor, japanHolidays, myanmarHolidays };
