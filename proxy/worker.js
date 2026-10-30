// 기상 중계 Worker — aviationweather.gov가 CORS를 안 주므로 이 Worker가 유일한 통로 (skyworker-wx)
// GET /health                 → {ok:true}
// GET /wx/metar?ids=RKSI,RKPC → AWC METAR JSON 그대로 (90초 캐시)
// GET /wx/taf?ids=RKSI        → AWC TAF JSON 그대로 (5분 캐시)
const ALLOW_ORIGINS = ['https://daudetwoong.github.io']; // GitHub Pages 주소 확정 시 추가/교체

function cors(origin) {
  const ok = ALLOW_ORIGINS.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin || '');
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

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const origin = req.headers.get('Origin');
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (req.method !== 'GET') return json({ error: 'GET only' }, 405, origin);
    if (url.pathname === '/health') return json({ ok: true, v: '0.2' }, 200, origin);
    const m = url.pathname.match(/^\/wx\/(metar|taf)$/);
    if (m) return relay(m[1], (url.searchParams.get('ids') || '').toUpperCase(), origin, ctx);
    return json({ error: 'not found' }, 404, origin);
  },
};
