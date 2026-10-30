// AWC JSON(METAR/TAF)을 한국어 문장으로 렌더링 — 사전에 없는 코드는 창작하지 않고 원문 유지
import { t } from './i18n.js';

export const PROXY_DEFAULT = 'https://ft-wx-proxy.daudet0127.workers.dev';

export function proxyBase() {
  try { return localStorage.getItem('ft_proxy') || PROXY_DEFAULT; } catch { return PROXY_DEFAULT; }
}

export async function fetchWx(kind, ids) {
  const r = await fetch(`${proxyBase()}/wx/${kind}?ids=${ids.join(',')}`);
  if (!r.ok) throw new Error(`${kind} HTTP ${r.status}`);
  return r.json();
}

// ── 코드 사전 ──────────────────────────────────────────
const WX_CODES = {
  RA: '비', SN: '눈', DZ: '이슬비', SG: '싸락눈', PL: '얼음싸라기', GR: '우박', GS: '작은 우박',
  FG: '안개', BR: '박무', HZ: '연무', FU: '연기', DU: '먼지', SA: '모래', VA: '화산재',
  TS: '뇌우', SH: '소나기성', FZ: '어는', MI: '얕은', BC: '산재된', PR: '부분적', DR: '낮게 날리는', BL: '높이 날리는',
  SQ: '스콜', FC: '깔때기구름', PO: '먼지회오리', UP: '미상 강수', NSW: '악기상 없음', VC: '주변',
};
const CLOUD_KO = { FEW: '약간(1~2/8)', SCT: '산재(3~4/8)', BKN: '많음(5~7/8)', OVC: '흐림(8/8)', CLR: '구름 없음', SKC: '구름 없음', NSC: '유의 구름 없음', CAVOK: 'CAVOK', VV: '수직시정' };

export function decodeWxString(s) {
  if (!s) return '';
  return s.split(' ').map((tok) => {
    let out = tok, intensity = '';
    let core = tok;
    if (core.startsWith('+')) { intensity = '강한 '; core = core.slice(1); }
    else if (core.startsWith('-')) { intensity = '약한 '; core = core.slice(1); }
    const parts = core.match(/.{1,2}/g) || [];
    if (parts.every((p) => WX_CODES[p])) out = intensity + parts.map((p) => WX_CODES[p]).join(' ');
    return out;
  }).join(', ');
}

export function fmtWind(wdir, wspd, wgst) {
  if (wspd === 0 || wspd === '0') return t('calm');
  const dir = (wdir === 'VRB' || wdir === 0 && !wspd) ? t('variable') : `${String(wdir).padStart(3, '0')}°`;
  let s = `${dir} ${wspd}kt`;
  if (wgst) s += ` (${t('gust')} ${wgst}kt)`;
  return s;
}

export function fmtVis(raw, visib) {
  if (raw && /\bCAVOK\b/.test(raw)) return t('cavok');
  const m = raw && raw.match(/\s(\d{4})(NDV)?\s/);
  if (m) { const v = parseInt(m[1], 10); return v >= 9999 ? '10km+' : v >= 1000 ? `${(v / 1000).toFixed(v % 1000 ? 1 : 0)}km` : `${v}m`; }
  if (visib != null) { const s = String(visib); return s.includes('+') ? '10km+' : `${s}SM`; }
  return '—';
}

export function fmtClouds(clouds, raw) {
  if (raw && /\bCAVOK\b/.test(raw)) return '';
  if (!clouds || !clouds.length) return t('clouds') + ': —';
  return clouds.map((c) => {
    const cover = CLOUD_KO[c.cover] || c.cover;
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
const KST = 9 * 3600 * 1000;
export function fmtKst(unixSec) {
  const d = new Date(unixSec * 1000 + KST);
  return `${String(d.getUTCDate()).padStart(2, '0')}일 ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

export function renderTafPeriods(taf) {
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
    return { from: fmtKst(f.timeFrom), to: fmtKst(f.timeTo), kind, text: parts.join(' · ') || '—' };
  });
}
