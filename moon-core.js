// Shared core for the Moon + Myanmar calendar: used by calendar.html (browser) and MoonMyanmar.scriptable.js (Scriptable).
// Plain script, no dependencies. Edit here only.

// ---------- Astronomy ----------
const RAD = Math.PI / 180;
const norm = x => ((x % 360) + 360) % 360;

// Moon–Sun elongation in degrees (0 = new, 90 = first quarter, 180 = full, 270 = last quarter)
function elongation(jd) {
  const T = (jd - 2451545) / 36525;
  const Lp = 218.3164477 + 481267.88123421 * T;
  const D  = 297.8501921 + 445267.1114034 * T;
  const M  = 357.5291092 + 35999.0502909 * T;
  const Mp = 134.9633964 + 477198.8675055 * T;
  const F  = 93.2720950 + 483202.0175233 * T;
  const s = x => Math.sin(x * RAD);
  const moon = Lp + 6.288774 * s(Mp) + 1.274027 * s(2*D - Mp) + 0.658314 * s(2*D) + 0.213618 * s(2*Mp)
    - 0.185116 * s(M) - 0.114332 * s(2*F) + 0.058793 * s(2*D - 2*Mp) + 0.057066 * s(2*D - M - Mp)
    + 0.053322 * s(2*D + Mp) + 0.045758 * s(2*D - M) - 0.040923 * s(M - Mp) - 0.034720 * s(D)
    - 0.030383 * s(M + Mp);
  const L0 = 280.46646 + 36000.76983 * T;
  const sun = L0 + (1.914602 - 0.004817 * T) * s(M) + 0.019993 * s(2*M);
  return norm(moon - sun);
}

// Exact time of a principal phase (target in 0/90/180/270) between jd0 and jd1, or null
function findPhases(jd0, jd1) {
  const out = [];
  const step = 1 / 24;
  const f = (jd, t) => ((elongation(jd) - t + 540) % 360) - 180;
  for (const t of [0, 90, 180, 270]) {
    let a = jd0, fa = f(a, t);
    for (let x = jd0 + step; x <= jd1; x += step) {
      const fb = f(x, t);
      if (fa < 0 && fb >= 0 && fb - fa < 90) {
        let lo = a, hi = x;
        for (let i = 0; i < 40; i++) {
          const mid = (lo + hi) / 2;
          if (f(mid, t) < 0) lo = mid; else hi = mid;
        }
        out.push({ jd: (lo + hi) / 2, q: t / 90 });
      }
      a = x; fa = fb;
    }
  }
  return out.sort((p, q) => p.jd - q.jd);
}

// ---------- Myanmar calendar (Irwin / Yan Naing Aye algorithm, modern era) ----------
const SY = 1577917828 / 4320000;      // solar year
const LM = 1577917828 / 53433336;     // lunar month
const MO = 1954168.050623;            // 0 ME epoch
const WO = -0.5, NM = 8;              // third-era constants (ME >= 1312)
const watatCache = {};
function watatYear(my) {
  if (watatCache[my]) return watatCache[my];
  const TA = (SY / 12 - LM) * (12 - NM);
  let ed = (SY * (my + 3739)) % LM;
  if (ed < TA) ed += LM;
  let fm = Math.round(SY * my + MO - ed + 4.5 * LM + WO);
  if (my === 1377) fm += 1;           // known exception
  const TW = LM - (SY / 12 - LM) * NM;
  return (watatCache[my] = { watat: ed >= TW, fm });
}
function myanmarYear(my) {
  const y1 = watatYear(my);
  let yd = 0, y2;
  do { yd++; y2 = watatYear(my - yd); } while (!y2.watat && yd < 3);
  let myt = 0;                         // 0 common, 1 little watat, 2 big watat
  if (y1.watat) myt = Math.floor(((y1.fm - y2.fm) % 354) / 31) + 1;
  return { my, myt, tg1: y2.fm + 354 * yd - 102, len: 354 + (myt ? 29 + myt : 0) };
}
// keys into MM_NAMES; month 0 = First Waso
const MONTHS = [
  { k: 'tagu', n: 29 }, { k: 'kason', n: 30 }, { k: 'nayon', n: 29 },
  { k: 'waso1', n: 30 }, { k: 'waso', n: 30 }, { k: 'wagaung', n: 29 }, { k: 'tawthalin', n: 30 },
  { k: 'thadingyut', n: 29 }, { k: 'tazaungmon', n: 30 }, { k: 'nadaw', n: 29 },
  { k: 'pyatho', n: 30 }, { k: 'tabodwe', n: 29 }, { k: 'tabaung', n: 30 },
];
function jdnToMyanmar(jdn) {
  let my = Math.floor((jdn - 0.5 - MO) / SY);
  let y = myanmarYear(my);
  let dd = jdn - y.tg1 + 1;
  let late = false;
  if (dd < 1) { my--; y = myanmarYear(my); dd = jdn - y.tg1 + 1; }
  if (dd > y.len) {                    // Tagu/Kason that fall before the new year
    dd -= y.len; late = true;
    const ny = myanmarYear(my + 1);
    y = { ...ny, myt: ny.myt };
  }
  const list = [];
  for (const m of MONTHS) {
    if (m.k === 'waso1' && !(late ? false : y.myt)) continue;
    let n = m.n;
    if (m.k === 'nayon' && y.myt === 2 && !late) n = 30;
    list.push({ k: m.k, n });
  }
  let i = 0;
  while (i < list.length - 1 && dd > list[i].n) { dd -= list[i].n; i++; }
  const mo = list[i];
  const phase = dd === mo.n ? 'new' : dd === 15 ? 'full' : dd < 15 ? 'waxing' : 'waning';
  return {
    my, k: mo.k, late: late && (mo.k === 'tagu' || mo.k === 'kason'),
    md: dd, len: mo.n, phase, pday: dd > 15 ? dd - 15 : dd, watat: y.myt > 0,
  };
}
function gregToJdn(y, m, d) { return Math.round(Date.UTC(y, m, d) / 864e5) + 2440588; }

// ---------- Myanmar text ----------
const MY_DIGITS = '၀၁၂၃၄၅၆၇၈၉';
const numMy = n => String(n).replace(/\d/g, d => MY_DIGITS[d]);
const MM_NAMES = { tagu:'တန်ခူး', kason:'ကဆုန်', nayon:'နယုန်', waso1:'ပထမဝါဆို', waso:'ဝါဆို', wagaung:'ဝါခေါင်',
  tawthalin:'တော်သလင်း', thadingyut:'သီတင်းကျွတ်', tazaungmon:'တန်ဆောင်မုန်း', nadaw:'နတ်တော်',
  pyatho:'ပြာသို', tabodwe:'တပို့တွဲ', tabaung:'တပေါင်း' };
const GREG_MONTHS_MY = ['ဇန်နဝါရီ','ဖေဖော်ဝါရီ','မတ်','ဧပြီ','မေ','ဇွန်','ဇူလိုင်','ဩဂုတ်','စက်တင်ဘာ','အောက်တိုဘာ','နိုဝင်ဘာ','ဒီဇင်ဘာ'];

// Scriptable loads this file via new Function('module', code); browsers just see globals.
if (typeof module !== 'undefined') {
  module.exports = { RAD, norm, elongation, findPhases, jdnToMyanmar, gregToJdn, numMy, MM_NAMES, GREG_MONTHS_MY };
}
