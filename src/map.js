// Leaflet 지도 — 오프라인 기본(내장 해안선+격자) 위에 온라인 상세지도(OSM) 선택, 경로·SR·FIR·NOTAM 구역·공항·흔들림·내 위치. 줌/팬/팝업/따라가기
let coastPromise = null, leafletPromise = null;
let lastView = null, lastRouteKey = null;

function loadCoast() {
  if (!coastPromise) coastPromise = fetch(new URL('../vendor/coastline.json', import.meta.url)).then((r) => r.json()).catch(() => ({ features: [] }));
  return coastPromise;
}
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (!leafletPromise) leafletPromise = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = new URL('../vendor/leaflet.js', import.meta.url).href;
    s.onload = () => res(window.L); s.onerror = rej;
    document.head.append(s);
  });
  return leafletPromise;
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// opts: {route, srRuns, notams:[{id,title,text,level,area:{type,center,rNm,pts}}], airports, gps:{lat,lon,hdg,spd,alt,trail}, turb:[{lat,lon,label}], follow, tiles, routeKey, labels:{...}}
export async function renderMap(container, opts) {
  const L = await loadLeaflet();
  const { route = [], srRuns = [], notams = [], airports = [], gps = null, turb = [], follow = false, tiles = false, routeKey = '' } = opts;
  const pts = route.filter((r) => r.lat != null && r.lon != null);
  let map = container._lmap;
  if (!map) {
    map = L.map(container, { attributionControl: false, zoomControl: true, worldCopyJump: false, minZoom: 2, maxZoom: 13 });
    map.setView(lastView ? lastView.c : [35, 125], lastView ? lastView.z : 4); // 레이어 추가 전 뷰 필수(없으면 'min' 에러)
    container._lmap = map;
    const coast = await loadCoast();
    L.geoJSON(coast, { style: { color: 'var(--map-coast)', weight: 1, opacity: 0.9 }, interactive: false }).addTo(map);
    const grid = [];
    for (let lat = -80; lat <= 80; lat += 10) grid.push([[lat, -180], [lat, 180]]);
    for (let lon = -180; lon <= 180; lon += 10) grid.push([[-85, lon], [85, lon]]);
    L.polyline(grid, { color: 'var(--map-grid)', weight: 0.6, interactive: false }).addTo(map);
    map.on('moveend zoomend', () => { lastView = { c: map.getCenter(), z: map.getZoom() }; });
    container._layers = L.layerGroup().addTo(map);
    container._tiles = null;
  }
  if (tiles && !container._tiles) {
    container._tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 13, opacity: 0.85 }).addTo(map);
    container._tiles.bringToBack();
    container._attr = L.control.attribution({ prefix: false }).addAttribution('© OpenStreetMap').addTo(map);
  } else if (!tiles && container._tiles) {
    map.removeLayer(container._tiles); container._tiles = null;
    if (container._attr) { container._attr.remove(); container._attr = null; }
  }

  const g = container._layers;
  g.clearLayers();
  if (pts.length > 1) {
    L.polyline(pts.map((p) => [p.lat, p.lon]), { color: '#5b9cf6', weight: 2.5 }).addTo(g);
    srRuns.forEach((r) => {
      const seg = route.slice(r.s, r.i1 + 1).filter((p) => p.lat != null).map((p) => [p.lat, p.lon]);
      if (seg.length > 1) L.polyline(seg, { color: '#a855f7', weight: 9, opacity: 0.5, lineCap: 'round' }).addTo(g).bindTooltip(`🌪️ SR ${r.max}`, { sticky: true });
    });
    pts.forEach((p, i) => {
      const special = p.point === 'TOC' || p.point === 'TOD' || p.fir || i === 0 || i === pts.length - 1;
      const m = L.circleMarker([p.lat, p.lon], { radius: special ? 5 : 3, color: p.fir ? '#f59e0b' : '#dbe7ff', fillColor: p.fir ? '#f59e0b' : '#5b9cf6', fillOpacity: 0.9, weight: 1.5 }).addTo(g);
      const info = [`<b>${esc(p.point)}</b>${p.fir ? ` → ${esc(p.fir)} FIR` : ''}`, typeof p.fl === 'number' ? `FL${p.fl}` : null, p.accMin != null ? `T+${Math.floor(p.accMin / 60)}:${String(p.accMin % 60).padStart(2, '0')}` : null, p.sr != null ? `SR ${p.sr}` : null, p.wind ? `${String(p.wind.dir).padStart(3, '0')}/${p.wind.spd}` : null].filter(Boolean).join(' · ');
      m.bindPopup(info);
      if (special) m.bindTooltip(p.fir ? `${p.point} ▸${p.fir}` : p.point, { permanent: true, direction: 'top', offset: [0, -4], className: 'swmap-tip' });
    });
  }
  airports.forEach((a) => {
    if (a.lat == null) return;
    L.circleMarker([a.lat, a.lon], { radius: 6, color: '#22b07d', fillColor: '#22b07d', fillOpacity: 1, weight: 1 }).addTo(g)
      .bindTooltip(`${a.icao}${a.role ? ' · ' + a.role : ''}`, { permanent: true, direction: 'right', offset: [6, 0], className: 'swmap-tip apt' });
  });
  notams.forEach((n) => {
    const a = n.area; if (!a) return;
    const col = n.level === 'direct' ? '#ef4444' : n.level === 'near' ? '#f59e0b' : '#94a3b8';
    let layer;
    if (a.type === 'polygon') layer = L.polygon(a.pts.map((p) => [p.lat, p.lon]), { color: col, weight: 1.5, fillOpacity: 0.15 });
    else if (a.type === 'circle') layer = L.circle([a.center.lat, a.center.lon], { radius: a.rNm * 1852, color: col, weight: 1.5, fillOpacity: 0.15 });
    else layer = L.circleMarker([a.center.lat, a.center.lon], { radius: 6, color: col, fillColor: col, fillOpacity: 0.5, weight: 1.5 });
    layer.addTo(g).bindPopup(`<b>${esc(n.id)}</b> ${esc(n.title || '')}<br><span class="swmap-pop">${esc((n.text || '').slice(0, 220))}</span>`);
  });
  turb.forEach((tb) => {
    L.marker([tb.lat, tb.lon], { icon: L.divIcon({ className: 'swmap-turb', html: '🌀', iconSize: [20, 20], iconAnchor: [10, 10] }) }).addTo(g).bindTooltip(tb.label, { direction: 'top' });
  });
  if (gps) {
    if (gps.trail?.length > 1) L.polyline(gps.trail, { color: '#38bdf8', weight: 2, dashArray: '4 4' }).addTo(g);
    L.marker([gps.lat, gps.lon], { zIndexOffset: 1000, icon: L.divIcon({ className: 'swmap-plane', html: `<div style="transform:rotate(${(gps.hdg || 0) - 90}deg)">➤</div>`, iconSize: [24, 24], iconAnchor: [12, 12] }) }).addTo(g)
      .bindTooltip(`GS ${gps.spd != null ? Math.round(gps.spd) + 'kt' : '--'} · ${gps.alt != null ? Math.round(gps.alt).toLocaleString() + 'ft' : '--'}`);
  }

  setTimeout(() => map.invalidateSize(), 50);
  if (gps && follow) map.setView([gps.lat, gps.lon], Math.max(map.getZoom(), 6), { animate: false });
  else if (routeKey !== lastRouteKey || !lastView) {
    const all = [...pts, ...airports.filter((a) => a.lat != null), ...(gps ? [gps] : [])].map((p) => [p.lat, p.lon]);
    if (all.length) map.fitBounds(L.latLngBounds(all), { padding: [24, 24] });
    lastRouteKey = routeKey;
  } else if (lastView && !container._viewRestored) {
    map.setView(lastView.c, lastView.z, { animate: false });
    container._viewRestored = true;
  }
  return map;
}
// render()로 컨테이너가 버려질 때 호출 — Leaflet의 window/document 리스너 해제
export function destroyMap(container) {
  const map = container?._lmap; if (!map) return;
  try { map.remove(); } catch {}
  container._lmap = null; container._layers = null; container._tiles = null; container._attr = null;
}
// 새 비행 로드 시 이전 비행의 뷰를 잊는다
export function resetMapView() { lastView = null; lastRouteKey = null; }
