// 오프라인 SVG 지도 — 내장 해안선(Natural Earth 110m) 위에 경로·웨이포인트·TOC/TOD·FIR·SR 구간·NOTAM·내 위치를 그린다 (타일 서버 없음)
let coastPromise = null;
function loadCoast() {
  if (!coastPromise) coastPromise = fetch(new URL('../vendor/coastline.json', import.meta.url)).then((r) => r.json()).catch(() => ({ features: [] }));
  return coastPromise;
}

const NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

// opts: {route:[{lat,lon,point,fl,sr,fir}], srRuns:[{s,i1,max}], notams:[{lat,lon,id,level}], airports:[{icao,lat,lon,role}], gps:{lat,lon,hdg,trail:[[lat,lon]]}, width, height}
export async function renderMap(container, opts) {
  const { route = [], srRuns = [], notams = [], airports = [], gps = null } = opts;
  const W = opts.width || container.clientWidth || 400;
  const H = opts.height || Math.round(W * 0.72);
  const pts = route.filter((r) => r.lat != null && r.lon != null);
  const all = [...pts, ...airports.filter((a) => a.lat != null), ...(gps ? [gps] : [])];
  if (!all.length) { container.replaceChildren(); return; }
  let minLat = Math.min(...all.map((p) => p.lat)), maxLat = Math.max(...all.map((p) => p.lat));
  let minLon = Math.min(...all.map((p) => p.lon)), maxLon = Math.max(...all.map((p) => p.lon));
  const midLat = (minLat + maxLat) / 2;
  const cosL = Math.max(0.2, Math.cos((midLat * Math.PI) / 180));
  // 여백 + 화면 비율 맞추기
  let spanLon = Math.max(2, (maxLon - minLon) * 1.25), spanLat = Math.max(1.5, (maxLat - minLat) * 1.35);
  const aspect = W / H;
  if ((spanLon * cosL) / spanLat < aspect) spanLon = (spanLat * aspect) / cosL; else spanLat = (spanLon * cosL) / aspect;
  const cLon = (minLon + maxLon) / 2, cLat = midLat;
  const kx = W / spanLon, ky = H / spanLat;
  const X = (lon) => (lon - (cLon - spanLon / 2)) * kx;
  const Y = (lat) => H - (lat - (cLat - spanLat / 2)) * ky;
  const inBox = (lat, lon) => lat >= cLat - spanLat / 2 - 2 && lat <= cLat + spanLat / 2 + 2 && lon >= cLon - spanLon / 2 - 2 && lon <= cLon + spanLon / 2 + 2;

  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: H, class: 'swmap' });
  svg.append(svgEl('rect', { x: 0, y: 0, width: W, height: H, class: 'swmap-sea' }));

  // 위경도 격자 5°
  const g = svgEl('g', { class: 'swmap-grid' });
  for (let lon = Math.floor((cLon - spanLon / 2) / 5) * 5; lon <= cLon + spanLon / 2; lon += 5) {
    g.append(svgEl('line', { x1: X(lon), y1: 0, x2: X(lon), y2: H }));
    g.append(Object.assign(svgEl('text', { x: X(lon) + 2, y: H - 3, class: 'swmap-gl' }), { textContent: `${Math.abs(lon)}${lon < 0 ? 'W' : 'E'}` }));
  }
  for (let lat = Math.floor((cLat - spanLat / 2) / 5) * 5; lat <= cLat + spanLat / 2; lat += 5) {
    g.append(svgEl('line', { x1: 0, y1: Y(lat), x2: W, y2: Y(lat) }));
    g.append(Object.assign(svgEl('text', { x: 3, y: Y(lat) - 2, class: 'swmap-gl' }), { textContent: `${Math.abs(lat)}${lat < 0 ? 'S' : 'N'}` }));
  }
  svg.append(g);

  // 해안선
  const coast = await loadCoast();
  const cg = svgEl('g', { class: 'swmap-coast' });
  for (const f of coast.features || []) {
    const coords = f.geometry?.type === 'LineString' ? [f.geometry.coordinates] : f.geometry?.type === 'MultiLineString' ? f.geometry.coordinates : [];
    for (const line of coords) {
      let d = '', pen = false;
      for (const [lon, lat] of line) {
        if (inBox(lat, lon)) { d += `${pen ? 'L' : 'M'}${X(lon).toFixed(1)} ${Y(lat).toFixed(1)}`; pen = true; } else pen = false;
      }
      if (d) cg.append(svgEl('path', { d }));
    }
  }
  svg.append(cg);

  // 경로
  if (pts.length > 1) {
    svg.append(svgEl('path', { class: 'swmap-route', d: pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.lon).toFixed(1)} ${Y(p.lat).toFixed(1)}`).join('') }));
    for (const r of srRuns) {
      const seg = route.slice(r.s, r.i1 + 1).filter((p) => p.lat != null);
      if (seg.length > 1) svg.append(svgEl('path', { class: 'swmap-sr', d: seg.map((p, i) => `${i ? 'L' : 'M'}${X(p.lon).toFixed(1)} ${Y(p.lat).toFixed(1)}`).join('') }));
    }
    const labelEvery = pts.length > 24 ? Math.ceil(pts.length / 12) : 1;
    pts.forEach((p, i) => {
      const special = p.point === 'TOC' || p.point === 'TOD' || p.fir || i === 0 || i === pts.length - 1;
      svg.append(svgEl('circle', { cx: X(p.lon), cy: Y(p.lat), r: special ? 3.5 : 2, class: 'swmap-wpt' + (p.fir ? ' fir' : '') }));
      if (special || i % labelEvery === 0) {
        const t = svgEl('text', { x: X(p.lon) + 5, y: Y(p.lat) - 5, class: 'swmap-lbl' + (special ? ' b' : '') });
        t.textContent = p.fir ? `${p.point} ▸${p.fir}` : p.point;
        svg.append(t);
      }
    });
  }
  // 공항
  for (const a of airports) {
    if (a.lat == null) continue;
    svg.append(svgEl('rect', { x: X(a.lon) - 4, y: Y(a.lat) - 4, width: 8, height: 8, class: 'swmap-apt' }));
    const t = svgEl('text', { x: X(a.lon) + 7, y: Y(a.lat) + 4, class: 'swmap-lbl apt' }); t.textContent = a.icao; svg.append(t);
  }
  // NOTAM
  for (const n of notams.slice(0, 60)) {
    svg.append(svgEl('circle', { cx: X(n.lon), cy: Y(n.lat), r: 5, class: 'swmap-notam ' + (n.level || '') }));
    const t = svgEl('text', { x: X(n.lon) + 7, y: Y(n.lat) + 3, class: 'swmap-lbl notam' }); t.textContent = n.id; svg.append(t);
  }
  // 내 위치
  if (gps) {
    if (gps.trail?.length > 1) svg.append(svgEl('path', { class: 'swmap-trail', d: gps.trail.map(([la, lo], i) => `${i ? 'L' : 'M'}${X(lo).toFixed(1)} ${Y(la).toFixed(1)}`).join('') }));
    const t = svgEl('text', { x: X(gps.lon), y: Y(gps.lat), class: 'swmap-plane', transform: `rotate(${(gps.hdg || 0) - 90} ${X(gps.lon)} ${Y(gps.lat)})` });
    t.textContent = '➤';
    svg.append(t);
  }
  container.replaceChildren(svg);
}
