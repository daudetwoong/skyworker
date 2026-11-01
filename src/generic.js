// 범용 OFP 해석 — 회사 전용 파서가 없는 양식에서 ICAO FPL 경로 + 본문 좌표 + 흔한 연료 라벨로 최소 브리핑을 만든다(시각은 거리 비례 추정)
const AWY_RX = /^(?:[A-Z]{1,2}\d{1,4}[A-Z]?|U[A-Z]\d{1,4})$/;
const R_NM = 3440.065;
const rad = (d) => (d * Math.PI) / 180;
function distNm(a, b) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_NM * Math.asin(Math.min(1, Math.sqrt(h)));
}
const sgn = (h) => (h === 'S' || h === 'W' ? -1 : 1);
const ok = (p) => p && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180 ? p : null;
const mOk = (...mins) => mins.every((v) => v == null || +v < 60); // 분·초는 60 미만

// ── 좌표 표기 여러 가지 → {lat, lon, at(줄 안 위치)} ──
// N37 29.2 E127 22.8 · N3729.2E12722.8 · N372912E1272248 · 3729.2N 12722.8E · 372912N1272248E · 3729N12723E · N37°29.2' E127°22.8'
const COORD_RXS = [
  [/(?<![A-Z0-9])([NS])\s?(\d{2})(\d{2})(\d{2})\s?([EW])\s?(\d{3})(\d{2})(\d{2})(?![\d.])/g, (m) => mOk(m[3], m[4], m[7], m[8]) && ({ lat: sgn(m[1]) * (+m[2] + m[3] / 60 + m[4] / 3600), lon: sgn(m[5]) * (+m[6] + m[7] / 60 + m[8] / 3600) })],
  [/(?<![A-Z0-9])([NS])\s?(\d{2})[°\s]?\s?(\d{2}(?:\.\d+)?)'?\s*([EW])\s?(\d{3})[°\s]?\s?(\d{2}(?:\.\d+)?)'?(?![\d])/g, (m) => mOk(m[3], m[6]) && !/\d{2}\s\d{2}(?![.\d])/.test(m[0]) && ({ lat: sgn(m[1]) * (+m[2] + m[3] / 60), lon: sgn(m[4]) * (+m[5] + m[6] / 60) })], // 도·분 사이에 공백이면 분은 소수여야(N37 29.2) — 'S 12 34' 같은 우연 방지
  [/(?<![\d.])(\d{2})(\d{2})(\d{2})([NS])\s?(\d{3})(\d{2})(\d{2})([EW])(?![A-Z0-9])/g, (m) => mOk(m[2], m[3], m[6], m[7]) && ({ lat: sgn(m[4]) * (+m[1] + m[2] / 60 + m[3] / 3600), lon: sgn(m[8]) * (+m[5] + m[6] / 60 + m[7] / 3600) })],
  [/(?<![\d.])(\d{2})(\d{2}(?:\.\d+)?)([NS])\s?(\d{3})(\d{2}(?:\.\d+)?)([EW])(?![A-Z0-9])/g, (m) => mOk(m[2], m[5]) && ({ lat: sgn(m[3]) * (+m[1] + m[2] / 60), lon: sgn(m[6]) * (+m[4] + m[5] / 60) })],
];
export function coordsInLine(line) {
  const out = [], used = [];
  for (const [rx, fn] of COORD_RXS) {
    for (const m of line.matchAll(rx)) {
      const s = m.index, e = s + m[0].length;
      if (used.some(([a, b]) => s < b && e > a)) continue; // 앞 규칙이 이미 잡은 자리
      const r = fn(m); const p = r ? ok(r) : null; if (!p) continue;
      used.push([s, e]); out.push({ ...p, at: s });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}
// 위도만 / 경도만 있는 줄 (2줄 항법로그: 1줄=위도, 2줄=경도)
const LAT_ONLY = /(?<![A-Z0-9])([NS])\s?(\d{2})\s?(\d{2}(?:\.\d+)?)(?![\d])(?!\s*[EW]\s?\d)/;
const LON_ONLY = /^\s*([EW])\s?(\d{3})\s?(\d{2}(?:\.\d+)?)(?![\d])/; // 경도 줄은 줄 첫머리(2줄 항법로그 꼴)

// FPL 경로 문자열 → 지점 후보 (항로·DCT·처음/끝 SID/STAR 제외, 좌표 토큰은 바로 좌표로)
export function routeTokens(route) {
  const toks = String(route || '').split(/\s+/).filter(Boolean);
  const out = [];
  toks.forEach((tk, i) => {
    const name = tk.split('/')[0];
    if (!name || name === 'DCT') return;
    const cc = name.match(/^(\d{2})(\d{2})?([NS])(\d{3})(\d{2})?([EW])$/);
    if (cc) { out.push({ name, coord: { lat: sgn(cc[3]) * (+cc[1] + (+cc[2] || 0) / 60), lon: sgn(cc[6]) * (+cc[4] + (+cc[5] || 0) / 60) } }); return; }
    if ((i === 0 || i === toks.length - 1) && /^[A-Z]{3,6}\d{1,2}[A-Z]?$/.test(name)) return; // 경로 처음/끝의 SID/STAR(NOPIK2Y·SSTIK4)
    if (AWY_RX.test(name) && i > 0 && i < toks.length - 1) return; // 가운데 항로
    if (/^[A-Z]{2,5}$/.test(name) || /^[A-Z]{2,4}\d{1,3}$/.test(name)) out.push({ name });
  });
  return out;
}

// 본문에서 이름별 좌표 찾기 — 표 줄(이름이 그 줄의 첫 글자 토큰: NOTAM 'E) ... RKSI ... N37..' 같은 문장은 제외)에서,
// 각 좌표를 '바로 앞에 있는 이름 하나'에만 준다(한 줄에 이름이 둘이면 앞 이름은 좌표 없음)
export function scanCoords(text, names) {
  const map = new Map();
  const want = new Set(names);
  const lines = String(text || '').split('\n');
  const tokRx = /\b([A-Z][A-Z0-9]{1,6})\b/g;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const firstAlpha = line.match(/[A-Z][A-Z0-9]*\)?/);
    if (!firstAlpha || !want.has(firstAlpha[0])) continue; // 표 줄이 아님
    const found = [...line.matchAll(tokRx)].filter((m) => want.has(m[1]));
    const cs = coordsInLine(line);
    if (cs.length) {
      for (const c of cs) {
        const before = found.filter((f) => f.index < c.at);
        const f = before[before.length - 1];
        if (f && !map.has(f[1])) map.set(f[1], { lat: c.lat, lon: c.lon });
      }
      continue;
    }
    // 2줄 꼴: 이 줄에 위도만, 다음 줄 첫머리에 경도만
    const la = line.match(LAT_ONLY), lo = (lines[i + 1] || '').match(LON_ONLY);
    if (la && lo && found.length === 1 && !map.has(found[0][1]) && mOk(la[3], lo[3])) {
      const p = ok({ lat: sgn(la[1]) * (+la[2] + la[3] / 60), lon: sgn(lo[1]) * (+lo[2] + lo[3] / 60) });
      if (p) map.set(found[0][1], p);
    }
  }
  return map;
}

// FPL + 본문 좌표(+공항 좌표 조회)로 항법로그를 만든다. 시각은 총 EET를 거리 비례로 나눈 추정(est:true)
// 반환: { navlog, resolved, total, straight } — 좌표를 못 찾은 지점은 건너뛴다
export function buildGenericNavlog(model, text, airportCoord = () => null) {
  const fpl = model.fpl;
  if (!fpl?.dep || !fpl?.dest) return null;
  const pre = routeTokens(fpl.route);
  const names = [fpl.dep, fpl.dest, ...pre.map((p) => p.name)];
  const coords = scanCoords(text, names);
  const resolve = (n) => airportCoord(n) || coords.get(n) || null; // 공항은 DB·METAR 좌표가 먼저(본문 좌표는 오인 위험)
  const pts = [];
  const dep = resolve(fpl.dep), dest = resolve(fpl.dest);
  if (!dep || !dest) return { navlog: [], resolved: 0, total: pre.length, missing: [!dep && fpl.dep, !dest && fpl.dest].filter(Boolean) };
  pts.push({ point: fpl.dep, ...dep, fl: 'CL' });
  let resolved = 0;
  for (const p of pre) {
    const c = p.coord || coords.get(p.name);
    if (!c) continue;
    resolved++;
    pts.push({ point: p.name, ...c, fl: model.plannedFL || null });
  }
  pts.push({ point: fpl.dest, ...dest, fl: 'DSC' });
  // 이상치 제거: 앞뒤 지점을 잇는 것보다 크게 돌아가는 지점(좌표 오독 의심)은 뺀다
  const gc = distNm(dep, dest);
  let rejected = 0;
  for (let changed = true; changed;) {
    changed = false;
    for (let i = 1; i < pts.length - 1; i++) {
      const detour = distNm(pts[i - 1], pts[i]) + distNm(pts[i], pts[i + 1]) - distNm(pts[i - 1], pts[i + 1]);
      if (detour > Math.max(300, gc * 0.5)) { pts.splice(i, 1); resolved--; rejected++; changed = true; break; }
    }
  }
  let acc = 0; const cum = [0];
  for (let i = 1; i < pts.length; i++) { acc += distNm(pts[i - 1], pts[i]); cum.push(acc); }
  const totalMin = model.eetTotal || null;
  const navlog = pts.map((p, i) => ({
    lat: p.lat, lon: p.lon, sr: null, dist: i ? Math.round(cum[i] - cum[i - 1]) : 0, point: p.point, fl: p.fl,
    mc: null, tc: null, gs: null, wind: null, comp: null, tas: null,
    accMin: totalMin && acc ? Math.round((totalMin * cum[i]) / acc) : null, accFuel: null, fir: null, est: true,
  }));
  return { navlog, resolved, total: pre.length, straight: resolved === 0, distNm: Math.round(acc), rejected };
}

// ── 범용 연료표: 흔한 라벨 + 단위(KG/LB/100LB) ──
const FUEL_LABELS = [
  ['trip', /^\s*(?:TRIP(?:\s+FUEL)?|BURN(?:\s*OFF)?|TRIP\/BURN)\b/],
  ['cont', /^\s*(?:CONT(?:INGENCY)?(?:\s+FUEL)?|CONT\/[A-Z]{4})\b/],
  ['altn', /^\s*(?:ALTN|ALTERNATE)(?:\s+FUEL)?(?:\s*\/\s*[A-Z]{4})?\b/],
  ['frsv', /^\s*(?:FINAL\s+(?:RES(?:ERVE)?|RSV)(?:\s+FUEL)?|F-?RSV|FRES|RESERVE(?:\s+FUEL)?)\b/],
  ['rqrd', /^\s*(?:MIN(?:IMUM)?\s+(?:T\/?O|TAKE-?OFF)(?:\s+FUEL)?|REQ(?:UIRED)?\s+FUEL|RQRD)\b/],
  ['extra', /^\s*(?:EXTRA|DISC(?:RETIONARY)?)(?:\s+FUEL)?\b/],
  ['tkof', /^\s*(?:T\/O\s+FUEL|TAKE-?OFF\s+FUEL|TKOF|TOF)\b/],
  ['taxi', /^\s*TAXI(?:\s+FUEL)?\b/],
  ['ramp', /^\s*(?:BLOCK(?:\s+FUEL)?|RAMP(?:\s+FUEL)?|TOTAL\s+FUEL)\b/],
];
const UNIT_TOK = /^(KGS?|LBS?)$/;
// 라벨 뒤가 '연료 표 줄' 모양인가: 숫자·시각·공항코드·단위·%·RSN/만 허용 (NM·FL340·01005KT·METERS·REQUESTED 같은 말이 섞이면 표 줄 아님)
function fuelRow(rest) {
  const toks = rest.replace(/(\d),(?=\d{3}(?!\d))/g, '$1').trim().split(/\s+/).filter(Boolean);
  const nums = [], times = []; let unit = null;
  for (const tk of toks) {
    if (/^\d{1,2}[.:]\d{2}$/.test(tk)) times.push(tk.replace(':', '.'));
    else if (/^\d{3,6}$/.test(tk)) nums.push(tk);
    else if (UNIT_TOK.test(tk)) unit = tk.startsWith('K') ? 'kg' : 'lb';
    else if (/^[A-Z]{4}$/.test(tk) || /^\d{1,2}(%|PCT)$/.test(tk) || tk === 'PCT' || tk === '%' || /^RSN\/\S+$/.test(tk) || /^[-/:.]+$/.test(tk)) continue;
    else return null;
  }
  if (!nums.length) return null;
  // 4자리 HHMM(분<60, 0으로 시작하거나 더 큰 수와 함께)은 시각으로 — 'TRIP 0152 4520'
  let fuel = nums[0];
  if (!times.length && nums.length >= 2) {
    const hhmm = (x) => x.length === 4 && +x.slice(2) < 60 && +x.slice(0, 2) < 24;
    const ti = nums.findIndex((x) => hhmm(x) && (x[0] === '0' || nums.some((y) => y !== x && +y > +x)));
    if (ti >= 0) { times.push(`${nums[ti].slice(0, 2)}.${nums[ti].slice(2)}`); fuel = nums.find((_, i) => i !== ti); }
  }
  return { v: +fuel, time: times[0] || null, unit };
}
export function parseGenericFuel(text) {
  const lines = String(text || '').split('\n');
  const cands = []; // {k, i, row}
  lines.forEach((line, i) => {
    for (const [k, rx] of FUEL_LABELS) {
      if (!rx.test(line)) continue;
      const row = fuelRow(line.replace(rx, ''));
      if (row) cands.push({ k, i, row });
      break;
    }
  });
  if (!cands.length) return null;
  // 연료 라벨이 가장 많이 몰린 블록(±12줄)을 연료표로 보고, 키마다 그 블록 안 후보를 쓴다
  const density = (i) => new Set(cands.filter((c) => Math.abs(c.i - i) <= 12).map((c) => c.k)).size;
  const center = cands.reduce((best, c) => (density(c.i) > density(best.i) ? c : best), cands[0]).i;
  const fuel = {}; const units = [];
  for (const c of cands.filter((x) => Math.abs(x.i - center) <= 12)) {
    if (fuel[c.k]) continue;
    fuel[c.k] = { v: c.row.v, time: c.row.time, extra: null, line: c.i };
    if (c.row.unit) units.push(c.row.unit);
  }
  const n = ['trip', 'tkof', 'ramp', 'frsv', 'altn'].filter((k) => fuel[k]).length;
  const sane = fuel.trip && (!fuel.ramp || fuel.ramp.v > fuel.trip.v) && (!fuel.tkof || fuel.tkof.v > fuel.trip.v);
  if (n < 3 || !sane) return null;
  Object.defineProperty(fuel, '_units', { value: units, enumerable: false });
  Object.defineProperty(fuel, '_lines', { value: [Math.min(...Object.values(fuel).map((f) => f.line)), Math.max(...Object.values(fuel).map((f) => f.line))], enumerable: false });
  Object.values(fuel).forEach((f) => delete f.line);
  return fuel;
}
// 연료 단위: 연료에 붙은 근거만 본다(화물·무게 줄의 KG에 속지 않게). 근거가 없으면 null(숫자만 표시)
export function detectFuelUnit(text, fuel = null) {
  const u = String(text || '').toUpperCase();
  if (/UNIT\s*:?\s*100\s?LBS?/.test(u)) return '100lb';
  const m = u.match(/\bFUEL[ \t]*(?:IN[ \t]*|UNIT[ \t]*:?[ \t]*)?(KGS?|LBS?)\b|\b(KGS?|LBS?)[ \t]+FUEL\b/); // 같은 줄 안에서만(줄바꿈 넘어 붙지 않게)
  if (m) return (m[1] || m[2]).startsWith('K') ? 'kg' : 'lb';
  if (fuel?._units?.length) { const k = fuel._units.filter((x) => x === 'kg').length; return k * 2 >= fuel._units.length ? 'kg' : 'lb'; }
  // 연료표 머리줄(첫 연료 줄 위 3줄 안)의 단위
  if (fuel?._lines) {
    const lines = u.split('\n').slice(Math.max(0, fuel._lines[0] - 3), fuel._lines[0] + 1).join(' ');
    const h = lines.match(/\b(KGS?|LBS?)\b/); if (h) return h[1].startsWith('K') ? 'kg' : 'lb';
  }
  const w = u.match(/\bWEIGHTS?\s+(?:ARE\s+)?(?:IN\s+)?(KGS?|LBS?)\b/); // '모든 무게는 KG' 선언
  if (w) return w[1].startsWith('K') ? 'kg' : 'lb';
  return null;
}

// 양식 진단용 '모양' — 글자는 A, 숫자는 9로 바꾼 줄 모양 상위 목록(내용·이름·숫자는 담지 않는다). 새 양식 지원 요청에 쓴다
// 양식 라벨로 흔한 단어만 그대로 두고(무슨 칸인지 알아보게) 나머지 글자는 A
const SIG_KEEP = new Set('TRIP CONT CONTINGENCY ALTN ALTERNATE FINAL RES RESERVE RSV EXTRA DISC TAXI BLOCK RAMP FUEL TIME DIST KG KGS LB LBS ETD ETA STD STA ATD ATA FL WIND TEMP OAT NOTAM FPL OFP CFP PLAN RELEASE ROUTE RTE WPT AWY MORA MSA FIR TOC TOD TAS GS MACH TOW LDW ZFW TOF TKOF MIN REQ RQRD TOTAL BURN SR CI DEP DEST ARR ELEV EET PAGE UNIT'.split(' '));
export function formatSignature(text, max = 40) {
  const freq = new Map();
  for (const line of String(text || '').split('\n')) {
    const shape = line.trim().replace(/\p{L}+/gu, (w) => (SIG_KEEP.has(w.toUpperCase()) ? w.toUpperCase() : 'A')).replace(/\p{N}+/gu, '9').replace(/\s+/g, ' ');
    if (shape.length < 3) continue;
    freq.set(shape, (freq.get(shape) || 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([s, c]) => `${c}× ${s}`);
}
