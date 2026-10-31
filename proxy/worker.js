// 기상 중계 Worker — aviationweather.gov가 CORS를 안 주므로 이 Worker가 유일한 통로 (skyworker-wx)
// GET /health                 → {ok:true}
// GET /wx/metar?ids=RKSI,RKPC → AWC METAR JSON 그대로 (90초 캐시)
// GET /wx/taf?ids=RKSI        → AWC TAF JSON 그대로 (5분 캐시)
// GET /wx/isigmet?cells=30_120,30_130 → 국제 SIGMET 중 10° 칸과 겹치는 것만 (원본 1개 5분 캐시, 최대 80칸)
// GET /wx/pirep?cells=30_120,…        → 칸별 최근 3시간 PIREP/AIREP (칸마다 5분 캐시, 최대 16칸)
const ALLOW_ORIGINS = ['https://daudetwoong.github.io']; // GitHub Pages 주소 확정 시 추가/교체

function cors(origin) {
  const ok = ALLOW_ORIGINS.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '');
  return {
    'Access-Control-Allow-Origin': ok ? origin : ALLOW_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}
const json = (obj, status, origin) => new Response(JSON.stringify(obj), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(origin) },
});

async function relay(kind, ids, origin, ctx) {
  if (!/^[A-Z0-9]{3,4}(,[A-Z0-9]{3,4}){0,19}$/.test(ids)) return json({ error: 'bad ids' }, 400, origin);
  const ttl = kind === 'metar' ? 90 : 300;
  const upstream = `https://aviationweather.gov/api/data/${kind}?ids=${ids}&format=json`;
  const cacheKey = new Request(`https://wx-cache.local/${kind}/${ids}`);
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) {
    const body = await hit.text();
    return new Response(body, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Cache': 'HIT', ...cors(origin) } });
  }
  let r;
  try {
    r = await fetch(upstream, { headers: { 'Accept': 'application/json', 'User-Agent': 'skyworker-wx-proxy/0.2 (personal, non-commercial)' }, signal: AbortSignal.timeout(9000) });
  } catch (e) { return json({ error: 'upstream timeout' }, 504, origin); }
  if (!r.ok) return json({ error: `upstream HTTP ${r.status}` }, 502, origin);
  const body = await r.text();
  ctx.waitUntil(cache.put(cacheKey, new Response(body, { headers: { 'Cache-Control': `s-maxage=${ttl}` } })));
  return new Response(body, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Cache': 'MISS', ...cors(origin) } });
}

// 칸 파라미터: "lat_lon" 10° 격자 칸 목록 (예: 30_120,30_130). 칸 단위라 캐시 키가 유한하고 보내는 위치도 거칠다(R4)
function parseCells(s, max) {
  const out = [];
  for (const c of String(s || '').split(',')) {
    const m = c.match(/^(-?\d{1,2})_(-?\d{1,3})$/); if (!m) return null;
    const la = +m[1], lo = +m[2];
    if (la % 10 || lo % 10 || la < -90 || la > 80 || lo < -180 || lo > 170) return null;
    if (!out.includes(c)) out.push(c);
  }
  return out.length && out.length <= max ? out.map((c) => c.split('_').map(Number)) : null;
}
async function cachedUpstream(key, upstream, ttl, ctx) {
  const cacheKey = new Request(`https://wx-cache.local/${key}`);
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) { const body = await hit.text(); if (body === '__ERR__') throw new Error('upstream recently failed'); return { body, hit: true }; }
  let r;
  try { r = await fetch(upstream, { headers: { 'Accept': 'application/json', 'User-Agent': 'skyworker-wx-proxy/0.3 (personal, non-commercial)' }, signal: AbortSignal.timeout(9000) }); }
  catch (e) { ctx.waitUntil(cache.put(cacheKey, new Response('__ERR__', { headers: { 'Cache-Control': 's-maxage=60' } }))); throw new Error('upstream timeout'); }
  if (!r.ok) { ctx.waitUntil(cache.put(cacheKey, new Response('__ERR__', { headers: { 'Cache-Control': 's-maxage=60' } }))); throw new Error(`upstream HTTP ${r.status}`); }
  const body = await r.text();
  ctx.waitUntil(cache.put(cacheKey, new Response(body, { headers: { 'Cache-Control': `s-maxage=${ttl}` } })));
  return { body, hit: false };
}
// 경도를 앞 꼭짓점에 붙여 펴서(날짜변경선) 고리의 범위를 구한다
function ringBox(ring) {
  let la0 = 90, la1 = -90, lo0 = 1e9, lo1 = -1e9, prev = null;
  for (const p of ring) {
    if (!Number.isFinite(+p?.lat) || !Number.isFinite(+p?.lon)) continue;
    let lon = +p.lon; if (prev != null) { while (lon - prev > 180) lon -= 360; while (lon - prev < -180) lon += 360; } prev = lon;
    la0 = Math.min(la0, +p.lat); la1 = Math.max(la1, +p.lat); lo0 = Math.min(lo0, lon); lo1 = Math.max(lo1, lon);
  }
  return prev == null ? null : [la0, lo0, la1, lo1];
}
const overlapCell = (bx, [la, lo]) => [0, 360, -360].some((k) => bx[2] >= la && bx[0] <= la + 10 && bx[3] + k >= lo && bx[1] + k <= lo + 10);
async function sigmets(cellStr, origin, ctx) {
  const cells = parseCells(cellStr, 80); if (!cells) return json({ error: 'bad cells' }, 400, origin);
  let res;
  try { res = await cachedUpstream('isigmet-all', 'https://aviationweather.gov/api/data/isigmet?format=json', 300, ctx); }
  catch (e) { return json({ error: String(e.message || e) }, 504, origin); }
  let list; try { list = JSON.parse(res.body); } catch { return json({ error: 'upstream parse' }, 502, origin); }
  const out = (Array.isArray(list) ? list : []).filter((x) => {
    const cs = Array.isArray(x.coords) ? x.coords : []; if (!cs.length) return true; // 좌표 없는 건 앱이 '그리지 못함'으로 따로 센다
    const rings = Array.isArray(cs[0]) ? cs : [cs]; // geom 'AREAS'는 고리 여러 개
    return rings.some((r) => { const bx = ringBox(r); return bx && cells.some((c) => overlapCell(bx, c)); });
  });
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Cache': res.hit ? 'HIT' : 'MISS', ...cors(origin) } });
}
async function pireps(cellStr, origin, ctx) {
  const cells = parseCells(cellStr, 16); if (!cells) return json({ error: 'bad cells' }, 400, origin);
  const got = await Promise.allSettled(cells.map(([la, lo]) => cachedUpstream(`pirep/${la}_${lo}`, `https://aviationweather.gov/api/data/pirep?format=json&age=3&bbox=${la},${lo},${la + 10},${lo + 10}`, 300, ctx)));
  if (!got.some((g) => g.status === 'fulfilled')) return json({ error: 'upstream failed' }, 504, origin);
  const seen = new Set(), out = [];
  for (const g of got) {
    if (g.status !== 'fulfilled') continue;
    let arr; try { arr = JSON.parse(g.value.body || '[]'); } catch { continue; }
    for (const p of Array.isArray(arr) ? arr : []) { const k = `${p.rawOb}|${p.obsTime}`; if (!seen.has(k)) { seen.add(k); out.push(p); } }
  }
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Partial': got.every((g) => g.status === 'fulfilled') ? '0' : '1', ...cors(origin) } });
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const origin = req.headers.get('Origin');
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (req.method !== 'GET') return json({ error: 'GET only' }, 405, origin);
    if (url.pathname === '/health') return json({ ok: true, v: '0.3' }, 200, origin);
    if (url.pathname === '/wx/isigmet') return sigmets(url.searchParams.get('cells'), origin, ctx);
    if (url.pathname === '/wx/pirep') return pireps(url.searchParams.get('cells'), origin, ctx);
    const m = url.pathname.match(/^\/wx\/(metar|taf)$/);
    if (m) return relay(m[1], (url.searchParams.get('ids') || '').toUpperCase(), origin, ctx);
    return json({ error: 'not found' }, 404, origin);
  },
};
