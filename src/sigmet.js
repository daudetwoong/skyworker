// 경로 SIGMET·PIREP — AWC 국제 SIGMET을 중계 Worker로 받아 내 경로와의 교차·통과 시각·고도로 분류한다. 기내용 스냅샷은 기기 안에만(R4)
import { proxyBase } from './wx.js';

const R_NM = 3440.065;
const rad = (d) => (d * Math.PI) / 180;
const wrap = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180;
export function distNm(a, b) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_NM * Math.asin(Math.min(1, Math.sqrt(h)));
}
// 경도를 이전 꼭짓점에 가깝게 이어 붙여(±360) 날짜변경선을 넘는 고리를 연속으로 만든다
export function unwrapRing(ring) {
  const out = [];
  for (const p of ring) {
    if (!out.length) { out.push({ lat: p.lat, lon: p.lon }); continue; }
    const prev = out[out.length - 1].lon;
    let lon = p.lon;
    while (lon - prev > 180) lon -= 360;
    while (lon - prev < -180) lon += 360;
    out.push({ lat: p.lat, lon });
  }
  return out;
}
// 다각형 안인가 — 점 경도를 ±360 옮겨 가며 확인(풀어 놓은 고리와 같은 쪽으로)
function inRingPlanar(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.lat > p.lat) !== (b.lat > p.lat) && p.lon < ((b.lon - a.lon) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lon) inside = !inside;
  }
  return inside;
}
export function inPoly(p, ring) {
  return [0, 360, -360].some((k) => inRingPlanar({ lat: p.lat, lon: p.lon + k }, ring));
}
// 점→선분 거리(해리): 선분 중간 위도 기준 평면 근사 (수백 NM 이내에서 충분)
function segDistNm(p, a, b) {
  const lat0 = rad((a.lat + b.lat) / 2), kx = Math.cos(lat0) * 60, ky = 60;
  let best = Infinity;
  for (const k of [0, 360, -360]) {
    const px = (p.lon + k) * kx, py = p.lat * ky, ax = a.lon * kx, ay = a.lat * ky, bx = b.lon * kx, by = b.lat * ky;
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    const t = L2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2)) : 0;
    best = Math.min(best, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
  }
  return best;
}
function ringDistNm(p, ring) {
  let d = Infinity;
  for (let i = 0; i + 1 < ring.length; i++) d = Math.min(d, segDistNm(p, ring[i], ring[i + 1]));
  if (ring.length > 1) d = Math.min(d, segDistNm(p, ring[ring.length - 1], ring[0])); // 닫히지 않은 고리도
  return d;
}

// ── 요청 범위: 경로가 지나는 10° 격자 칸(여유 3°) — 장거리·날짜변경선 경로도 되고, 칸 단위라 캐시가 잘 맞고 위치 정밀도도 낮다(R4) ──
export function routeCells(route, pad = 3, max = 60) {
  const pts = (route || []).filter((r) => r.lat != null && r.lon != null);
  const cells = new Set();
  const addPt = (lat, lon) => {
    for (const dl of [-pad, 0, pad]) for (const dn of [-pad, 0, pad]) {
      const la = Math.max(-89.9, Math.min(89.9, lat + dl)), lo = wrap(lon + dn);
      cells.add(`${Math.floor(la / 10) * 10}_${Math.floor(lo / 10) * 10}`);
    }
  };
  for (let i = 0; i < pts.length; i++) {
    addPt(pts[i].lat, pts[i].lon);
    const b = pts[i + 1]; if (!b) break;
    const n = Math.ceil(distNm(pts[i], b) / 150); // 긴 구간은 중간 점도
    const bu = unwrapRing([pts[i], b])[1];
    for (let k = 1; k < n; k++) addPt(pts[i].lat + (b.lat - pts[i].lat) * (k / n), pts[i].lon + (bu.lon - pts[i].lon) * (k / n));
  }
  const list = [...cells].sort();
  return list.length ? list.slice(0, max) : null;
}
// PIREP은 칸마다 상류 호출이라 개수를 줄인다(경로를 고르게 덮도록 건너뛰며)
export function pirepCells(cells, max = 16) {
  if (!cells || cells.length <= max) return cells;
  const step = cells.length / max;
  return Array.from({ length: max }, (_, i) => cells[Math.floor(i * step)]);
}

async function getJson(path, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${proxyBase()}${path}`, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    if (!Array.isArray(j)) throw new Error('bad payload');
    return j;
  } finally { clearTimeout(timer); }
}
export const fetchSigmets = (cells, ms = 15000) => getJson(`/wx/isigmet?cells=${cells.join(',')}`, ms);
export const fetchPireps = (cells, ms = 15000) => getJson(`/wx/pirep?cells=${pirepCells(cells).join(',')}`, ms);

// AWC isigmet JSON → 내부 형식. coords는 고리 1개([{lat,lon}...]) 또는 여러 개([[...],[...]] — geom 'AREAS')
export const POINT_RADIUS_NM = 30; // 좌표 1~2개짜리(화산 위치 등)는 반경 30NM 원으로 본다
export function normSigmet(x) {
  const raw = Array.isArray(x.coords) ? x.coords : [];
  const rings = (raw.length && Array.isArray(raw[0]) ? raw : [raw])
    .map((r) => (Array.isArray(r) ? r : []).map((p) => ({ lat: +p?.lat, lon: +p?.lon })).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon)))
    .filter((r) => r.length)
    .map(unwrapRing);
  const spd = String(x.spd ?? '').trim();
  const stnr = x.dir === '-' || /^0+(KT|KMH)?$/.test(spd);
  return {
    id: `${x.firId || x.icaoId || ''} ${x.seriesId || ''}`.trim(), fir: x.firId || '', firName: x.firName || '',
    hazard: x.hazard || '', qual: x.qualifier || '', base: x.base ?? null, top: x.top ?? null,
    from: x.validTimeFrom ? x.validTimeFrom * 1000 : null, to: x.validTimeTo ? x.validTimeTo * 1000 : null,
    polys: rings.filter((r) => r.length >= 3), points: rings.filter((r) => r.length < 3).flat(),
    mov: stnr ? 'STNR' : x.dir ? `${x.dir}${spd ? ' ' + (/^\d+$/.test(spd) ? spd + 'KT' : spd) : ''}` : '',
    chng: x.chng || '', raw: x.rawSigmet || '',
  };
}
export const placeable = (sg) => sg.polys.length > 0 || sg.points.length > 0;

// 경로 고도 추정: 출발→TOC 직선 상승, TOD→도착 직선 강하, 그 사이는 OFP FL. 모르면 지면~순항(넓게)
function altModel(route, cruiseFt) {
  const toc = route.find((r) => r.point === 'TOC'), tod = route.find((r) => r.point === 'TOD');
  const end = [...route].reverse().find((r) => r.accMin != null);
  return (min, a, b, f) => {
    if (typeof a.fl === 'number' && typeof b.fl === 'number') { const v = (a.fl + (b.fl - a.fl) * f) * 100; return [v - 1000, v + 1000]; }
    if (min != null && toc?.accMin && min <= toc.accMin) { const v = cruiseFt * (min / toc.accMin); return [Math.max(0, v - 4000), v + 4000]; }
    if (min != null && tod?.accMin != null && end?.accMin > tod.accMin && min >= tod.accMin) { const v = cruiseFt * (1 - (min - tod.accMin) / (end.accMin - tod.accMin)); return [Math.max(0, v - 4000), v + 4000]; }
    return [0, cruiseFt];
  };
}
// 경로를 약 5NM 간격 점으로 (가는 뇌우 띠도 놓치지 않게)
function sampleRoute(route, cruiseFt) {
  const pts = route.filter((r) => r.lat != null && r.lon != null);
  const alt = altModel(pts, cruiseFt);
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[i + 1];
    if (!b) { out.push({ lat: a.lat, lon: a.lon, min: a.accMin, alt: alt(a.accMin, a, a, 0), point: a.point }); break; }
    const bu = unwrapRing([a, b])[1];
    const n = Math.min(200, Math.max(1, Math.ceil(distNm(a, b) / 5)));
    for (let k = 0; k < n; k++) {
      const f = k / n;
      const min = a.accMin != null && b.accMin != null ? a.accMin + (b.accMin - a.accMin) * f : (k === 0 ? a.accMin : null);
      out.push({ lat: a.lat + (b.lat - a.lat) * f, lon: wrap(a.lon + (bu.lon - a.lon) * f), min, alt: alt(min, a, b, f), point: k === 0 ? a.point : null });
    }
  }
  return out;
}
// 선분 ab가 고리 경계와 만나는 비율 t(0~1)들 — 점 간격보다 가는 띠를 위해
function crossFracs(a, b, ring) {
  const out = [];
  const bu = unwrapRing([a, b])[1];
  for (const k of [0, 360, -360]) {
    const ax = a.lon + k, ay = a.lat, bx = bu.lon + k, by = bu.lat;
    for (let i = 0; i + 1 < ring.length; i++) {
      const c = ring[i], d = ring[i + 1];
      const den = (bx - ax) * (d.lat - c.lat) - (by - ay) * (d.lon - c.lon);
      if (!den) continue;
      const t = ((c.lon - ax) * (d.lat - c.lat) - (c.lat - ay) * (d.lon - c.lon)) / den;
      const u = ((c.lon - ax) * (by - ay) - (c.lat - ay) * (bx - ax)) / den;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1) out.push(t);
    }
  }
  return out;
}
const insideSig = (s, sg) => sg.polys.some((r) => inPoly(s, r)) || sg.points.some((c) => distNm(s, c) <= POINT_RADIUS_NM);
const distSig = (s, sg) => Math.min(Infinity, ...sg.polys.map((r) => ringDistNm(s, r)), ...sg.points.map((c) => Math.max(0, distNm(s, c) - POINT_RADIUS_NM)));

// 분류: red=경로 통과+시각·고도 걸림(모르면 걸치는 것으로) / amber=경로는 지나지만 시각 또는 고도 밖 / yellow=경로 100NM 이내 / null=무관
// plan: { etdMs, cruiseFt, nowMs }. ETD가 없거나 지금과 36시간 넘게 떨어지면(지난 OFP) 시각 판정은 하지 않는다 — 그때는 이미 끝난 SIGMET은 뺀다
export function classifySigmet(sg, route, plan) {
  const nowMs = plan.nowMs ?? Date.now();
  const timeJudge = plan.etdMs != null && Math.abs(plan.etdMs - nowMs) <= 36 * 3600000;
  const timeSkip = timeJudge ? null : plan.etdMs == null ? 'noEtd' : 'far';
  if (!timeJudge && sg.to != null && sg.to < nowMs) return { cls: null, expired: true };
  if (!placeable(sg)) return { cls: null, unplaced: true };
  const samples = sampleRoute(route || [], plan.cruiseFt || 35000);
  if (!samples.length) return { cls: null };
  const flags = samples.map((s) => insideSig(s, sg));
  const inside = samples.filter((_, i) => flags[i]);
  // 두 점이 모두 밖인데 그 사이 선분이 구역을 가로지르면(가는 띠) 그 구간 가운데를 '안'으로 넣는다
  for (let i = 0; i + 1 < samples.length; i++) {
    if (flags[i] || flags[i + 1]) continue;
    const a = samples[i], b = samples[i + 1];
    const fr = sg.polys.flatMap((r) => crossFracs(a, b, r));
    if (fr.length >= 2) {
      const f = (Math.min(...fr) + Math.max(...fr)) / 2, bu = unwrapRing([a, b])[1];
      inside.push({ lat: a.lat + (b.lat - a.lat) * f, lon: wrap(a.lon + (bu.lon - a.lon) * f), min: a.min != null && b.min != null ? a.min + (b.min - a.min) * f : null, alt: [Math.min(a.alt[0], b.alt[0]), Math.max(a.alt[1], b.alt[1])], point: null, _i: i });
    }
  }
  let dNm = 0;
  if (!inside.length) { dNm = Infinity; for (const s of samples) dNm = Math.min(dNm, distSig(s, sg)); }
  const base = sg.base ?? 0, top = sg.top ?? Infinity;
  let enterMin = null, exitMin = null, timeOk = null, altOk = null, enterPoint = null;
  if (inside.length) {
    const mins = inside.map((s) => s.min).filter((m) => m != null);
    // 경계를 넘는 이웃 점 사이는 이분법으로 좁혀 진입·이탈 시각을 1분 안쪽으로
    for (let i = 0; i + 1 < samples.length; i++) {
      const a = samples[i], b = samples[i + 1];
      if (a.min == null || b.min == null || flags[i] === flags[i + 1]) continue;
      const bu = unwrapRing([a, b])[1];
      let lo = 0, hi = 1;
      for (let k = 0; k < 8; k++) { const mid = (lo + hi) / 2; const p = { lat: a.lat + (b.lat - a.lat) * mid, lon: a.lon + (bu.lon - a.lon) * mid }; if (insideSig(p, sg) === flags[i]) lo = mid; else hi = mid; }
      mins.push(a.min + (b.min - a.min) * hi);
    }
    if (mins.length) { enterMin = Math.round(Math.min(...mins)); exitMin = Math.round(Math.max(...mins)); }
    altOk = inside.some((s) => s.alt[1] >= base && s.alt[0] <= top);
    if (timeJudge && sg.from != null && sg.to != null) {
      const known = inside.filter((s) => s.min != null);
      const slack = 30 * 60000;
      if (known.length) timeOk = known.some((s) => { const at = plan.etdMs + s.min * 60000; return at >= sg.from - slack && at <= sg.to + slack; });
      if (known.length < inside.length && timeOk === false) timeOk = null; // 일부 지점 시각을 모르면 '밖'이라 단정하지 않는다
    }
    const first = inside.reduce((m, x) => { const i = x._i ?? samples.indexOf(x); return i < m ? i : m; }, Infinity);
    for (let i = first; i >= 0; i--) if (samples[i]?.point) { enterPoint = samples[i].point; break; }
  }
  const cls = inside.length ? (altOk !== false && timeOk !== false ? 'red' : 'amber') : dNm <= 100 ? 'yellow' : null;
  return { cls, dNm: inside.length ? 0 : Math.round(dNm), enterMin, exitMin, timeOk, altOk, timeJudge, timeSkip, enterPoint };
}

// PIREP: 난류·착빙 보고 중 경로 100NM 이내만. 'NEG'(없음)·'SMTH'는 위험이 아니다
const NO_HAZ = /^(NEG|NIL|SMTH|SMOOTH)?$/i;
export function nearPireps(list, route) {
  const pts = (route || []).filter((r) => r.lat != null);
  return (Array.isArray(list) ? list : []).map((p) => {
    const tb = NO_HAZ.test(String(p.tbInt1 || '').trim()) ? '' : [p.tbInt1, p.tbType1].filter(Boolean).join(' ');
    const ic = NO_HAZ.test(String(p.icgInt1 || '').trim()) ? '' : [p.icgInt1, p.icgType1].filter(Boolean).join(' ');
    if (!tb && !ic) return null;
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return null;
    let d = Infinity; for (const w of pts) d = Math.min(d, distNm(p, w));
    if (d > 100) return null;
    return { lat: p.lat, lon: p.lon, fl: p.fltLvl ?? null, tb, ic, at: p.obsTime ? p.obsTime * 1000 : null, ac: p.acType || '', raw: p.rawOb || '', dNm: Math.round(d) };
  }).filter(Boolean);
}
