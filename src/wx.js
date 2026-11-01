// AWC JSON(METAR/TAF)을 한국어 문장으로 렌더링 — 사전에 없는 코드는 창작하지 않고 원문 유지
import { t, lang } from './i18n.js';
import { fmtDayTime, fmtTime } from './time.js';

export const PROXY_DEFAULT = 'https://skyworker-wx.daudet0127.workers.dev';

export function proxyBase() {
  try { return localStorage.getItem('ft_proxy') || PROXY_DEFAULT; } catch { return PROXY_DEFAULT; }
}

export async function fetchWx(kind, ids, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs); // AWC가 느릴 때 METAR가 TAF에 묶이지 않게
  try {
    const r = await fetch(`${proxyBase()}/wx/${kind}?ids=${ids.join(',')}`, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`${kind} HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(timer); }
}

// ── 코드 사전 ──────────────────────────────────────────
const WX_CODES = {
  RA: '비', SN: '눈', DZ: '이슬비', SG: '싸락눈', PL: '얼음싸라기', GR: '우박', GS: '작은 우박',
  FG: '안개', BR: '박무', HZ: '연무', FU: '연기', DU: '먼지', SA: '모래', VA: '화산재',
  TS: '뇌우', SH: '소나기성', FZ: '어는', MI: '얕은', BC: '산재된', PR: '부분적', DR: '낮게 날리는', BL: '높이 날리는',
  SQ: '스콜', FC: '깔때기구름', PO: '먼지회오리', UP: '미상 강수', NSW: '악기상 없음', VC: '주변',
};
const CLOUD_EN = { FEW: 'few (1–2/8)', SCT: 'scattered (3–4/8)', BKN: 'broken (5–7/8)', OVC: 'overcast (8/8)', CLR: 'clear', SKC: 'sky clear', NSC: 'no significant cloud', CAVOK: 'CAVOK', VV: 'vertical visibility' };
const CLOUD_KO = { FEW: '약간(1~2/8)', SCT: '산재(3~4/8)', BKN: '많음(5~7/8)', OVC: '흐림(8/8)', CLR: '구름 없음', SKC: '구름 없음', NSC: '유의 구름 없음', CAVOK: 'CAVOK', VV: '수직시정' };

// 영어: 강도 + 서술어 + 현상 + (SH면 'showers') — '-SHRA' → 'light rain showers', 'TSRA' → 'thunderstorm with rain'
const WX_EN = { RA: 'rain', SN: 'snow', DZ: 'drizzle', SG: 'snow grains', PL: 'ice pellets', GR: 'hail', GS: 'small hail', FG: 'fog', BR: 'mist', HZ: 'haze', FU: 'smoke', DU: 'dust', SA: 'sand', VA: 'volcanic ash', SQ: 'squalls', FC: 'funnel cloud', PO: 'dust whirls', UP: 'unknown precipitation', NSW: 'no significant weather' };
const WX_DESC_EN = { MI: 'shallow', BC: 'patches of', PR: 'partial', DR: 'low drifting', BL: 'blowing', FZ: 'freezing' };
function decodeWxEn(tok) {
  let core = tok, intensity = '';
  if (core.startsWith('+')) { intensity = 'heavy'; core = core.slice(1); }
  else if (core.startsWith('-')) { intensity = 'light'; core = core.slice(1); }
  if (core === 'NSW') return WX_EN.NSW;
  let recent = false; if (core.startsWith('RE')) { recent = true; core = core.slice(2); } // RERA = 최근 비
  if (core === 'FC' && intensity === 'heavy') return 'tornado or waterspout'; // +FC는 '강한 깔때기구름'이 아니라 토네이도/용오름
  let vc = false; if (core.startsWith('VC')) { vc = true; core = core.slice(2); }
  const parts = core.match(/.{1,2}/g) || [];
  if (!parts.length || !parts.every((p) => WX_EN[p] || WX_DESC_EN[p] || p === 'SH' || p === 'TS')) return tok; // 모르는 코드는 원문 그대로
  const ts = parts.includes('TS'), sh = parts.includes('SH');
  const desc = parts.filter((p) => WX_DESC_EN[p]).map((p) => WX_DESC_EN[p]);
  const phen = parts.filter((p) => WX_EN[p]).map((p) => WX_EN[p]).join(' and ');
  let out;
  if (ts) out = [intensity, 'thunderstorm'].filter(Boolean).join(' ') + (phen ? ` with ${[...desc, phen].join(' ')}${sh ? ' showers' : ''}` : ''); // 강도는 묶음 전체(+TSRA = heavy thunderstorm with rain)
  else if (sh) out = [intensity, ...desc, phen, 'showers'].filter(Boolean).join(' ');
  else out = [intensity, ...desc, phen].filter(Boolean).join(' ');
  if (recent) out = `recent ${out}`;
  return vc ? `${out} in the vicinity` : out;
}
export function decodeWxString(s) {
  if (!s) return '';
  const toks = s.split(/\s+/).filter(Boolean); // 겹친 공백으로 빈 칸이 생기지 않게
  if (lang === 'en') return toks.map(decodeWxEn).join(', ');
  return toks.map((tok) => {
    let out = tok, intensity = '';
    let core = tok;
    if (core.startsWith('+')) { intensity = '강한 '; core = core.slice(1); }
    else if (core.startsWith('-')) { intensity = '약한 '; core = core.slice(1); }
    if (core === 'FC' && intensity === '강한 ') return '토네이도·용오름'; // +FC
    const parts = core.match(/.{1,2}/g) || [];
    if (parts.every((p) => WX_CODES[p])) out = intensity + parts.map((p) => WX_CODES[p]).join(' ');
    return out;
  }).join(', ');
}

export function fmtWind(wdir, wspd, wgst) {
  if (wspd === 0 || wspd === '0') return t('calm');
  const dir = wdir === 'VRB' ? t('variable') : `${String(wdir).padStart(3, '0')}°`;
  let s = `${dir} ${wspd}kt`;
  if (wgst) s += ` (${t('gust')} ${wgst}kt)`;
  return s;
}

export function fmtVis(raw, visib) {
  if (raw && /\bCAVOK\b/.test(raw)) return t('cavok');
  const m = raw && raw.match(/\s(\d{4})(NDV)?(?:\s|$)/);
  if (m) { const v = parseInt(m[1], 10); return v >= 9999 ? '10km+' : v >= 1000 ? `${(v / 1000).toFixed(v % 1000 ? 1 : 0)}km` : `${v}m`; }
  if (visib != null) { const s = String(visib); return s.includes('+') ? '10km+' : `${s}SM`; }
  return '—';
}

export function fmtClouds(clouds, raw) {
  if (raw && /\bCAVOK\b/.test(raw)) return '';
  if (!clouds || !clouds.length) return t('clouds') + ': —';
  return clouds.map((c) => {
    const cover = (lang === 'en' ? CLOUD_EN : CLOUD_KO)[c.cover] || c.cover;
    const base = c.base != null ? ` ${c.base.toLocaleString()}ft` : '';
    const type = c.type ? ` ${c.type}` : '';
    return `${cover}${base}${type}`;
  }).join(' · ');
}

export function fltCatInfo(cat) {
  const map = { VFR: ['fcVFR', '#22b07d'], MVFR: ['fcMVFR', '#4f8ff7'], IFR: ['fcIFR', '#e4564a'], LIFR: ['fcLIFR', '#b14fd8'] };
  const [key, color] = map[cat] || [null, '#888'];
  return { label: key ? `${cat} · ${t(key)}` : (cat || '—'), color };
}

export function renderMetarLines(m) {
  const lines = [];
  lines.push(`${t('wind')}: ${fmtWind(m.wdir, m.wspd, m.wgst)}`);
  lines.push(`${t('vis')}: ${fmtVis(m.rawOb, m.visib)}`);
  if (m.wxString) lines.push(decodeWxString(m.wxString));
  const cl = fmtClouds(m.clouds, m.rawOb);
  if (cl) lines.push(cl);
  lines.push(`${t('temp')} ${m.temp}° / ${t('dew')} ${m.dewp}° · ${t('qnh')} ${m.altim != null ? Math.round(m.altim) : '—'}`);
  if (m.rawOb && /\bNOSIG\b/.test(m.rawOb)) lines.push(t('nosig'));
  return lines;
}

// ── TAF ────────────────────────────────────────────────
export function obsTimeStr(m, offsetMin) {
  if (!m?.reportTime) return null;
  return fmtTime(new Date(m.reportTime + (m.reportTime.endsWith('Z') ? '' : 'Z')), offsetMin);
}

export function renderTafPeriods(taf, offsetMin) {
  if (!taf || !taf.fcsts) return [];
  return taf.fcsts.map((f) => {
    let kind = t('initial');
    if (f.fcstChange === 'BECMG') kind = t('becmg');
    else if (f.fcstChange === 'TEMPO') kind = t('tempo');
    else if (f.fcstChange === 'FM') kind = 'FM';
    if (f.probability) kind = `${t('prob')} ${f.probability}% ${f.fcstChange === 'TEMPO' ? t('tempo') : ''}`.trim();
    const parts = [];
    if (f.wdir != null || f.wspd != null) parts.push(fmtWind(f.wdir, f.wspd, f.wgst));
    const vis = f.visib != null ? (String(f.visib).includes('+') ? '10km+' : `${f.visib}SM`) : null;
    if (vis) parts.push(`${t('vis')} ${vis}`);
    if (f.wxString) parts.push(decodeWxString(f.wxString));
    const cl = fmtClouds(f.clouds, null);
    if (cl && !cl.endsWith('—')) parts.push(cl);
    return { fromSec: f.timeFrom, toSec: f.timeTo, change: f.fcstChange || null, from: fmtDayTime(new Date(f.timeFrom * 1000), offsetMin), to: fmtDayTime(new Date(f.timeTo * 1000), offsetMin), kind, text: parts.join(' · ') || '—' };
  });
}

// 한 줄 요약(조종사 표기): 290° 7kt · 8km · FEW 3,500ft · 14/12°C · Q1017 · NOSIG
export function metarShort(m) {
  if (!m) return '';
  const cavok = m.rawOb && /\bCAVOK\b/.test(m.rawOb);
  const p = [];
  if (m.wspd != null) p.push(fmtWind(m.wdir, m.wspd, m.wgst)); // 바람 결측(/////)이면 생략
  p.push(cavok ? 'CAVOK' : fmtVis(m.rawOb, m.visib));
  if (m.wxString) p.push(decodeWxString(m.wxString));
  if (!cavok) {
    const cl = (m.clouds || []).filter((c) => c.cover).map((c) => c.cover + (c.base != null ? ' ' + c.base.toLocaleString() + 'ft' : '') + (c.type ? ' ' + c.type : ''));
    if (cl.length) p.push(cl.join(' '));
  }
  if (m.temp != null) p.push(`${m.temp}/${m.dewp ?? '—'}°C`);
  // 기압은 원문 표기 그대로 (Q hPa / A inHg) — 미국식 A3005를 Q로 바꾸지 않는다
  const q = m.rawOb?.match(/\bQ(\d{4})\b/), a = m.rawOb?.match(/\bA(\d{4})\b/);
  if (q) p.push('Q' + q[1]); else if (a) p.push(`A${a[1].slice(0, 2)}.${a[1].slice(2)}`); else if (m.altim != null) p.push(`Q${Math.round(m.altim)}`);
  if (m.rawOb && /\bNOSIG\b/.test(m.rawOb)) p.push('NOSIG');
  return p.join(' · ');
}

// 활주로 바람 요약: 같은 값(평행 활주로)을 묶고 정풍이 큰 순서로 n개
export function bestRunways(rows, n = 2) {
  if (!rows?.length) return [];
  const groups = new Map();
  for (const r of rows) { const k = `${r.head}|${r.cross}|${r.side || ''}`; if (!groups.has(k)) groups.set(k, { ...r, rwys: [] }); groups.get(k).rwys.push(r.rwy); }
  return [...groups.values()].sort((a, b) => (b.head - b.cross * 0.5) - (a.head - a.cross * 0.5) || a.cross - b.cross).slice(0, n); // 정풍 우선, 측풍은 절반 감점
}
