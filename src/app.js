// 메인 앱 — 홈은 "내 비행": OFP PDF → 요약·지도·NOTAM·기상·SR·FL트레이드·타임라인·연료·FPL 카드. 모든 수치 참고용(R3), 기기 안 처리(R4)
import { t, setLang, lang } from './i18n.js';
import { getList, addAirport, removeAirport, airportInfo, saveUserRwys } from './airports.js';
import { fetchWx, renderMetarLines, renderTafPeriods, fltCatInfo, obsTimeStr } from './wx.js';
import { runwayWind } from './wind.js';
import { sunTimes } from './sun.js';
import { timePref, toggleTimePref, fmtTime, fmtHmZ, fmtDayTime, tzOffsetMin } from './time.js';
import { parseOFP } from './ofp.js';
import { flTrade } from './fltrade.js';
import { parseNotamPackage, isActive, activeInWindow, headline, literalKo, glossary, scheduleKo, routeRelation, gcDistNm, CAT_KO, KIND_KO } from './notam.js';
import { explainFpl, FIR_KO } from './fpl.js';

const $ = (sel) => document.querySelector(sel);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
const p100lbs = (v) => v == null ? '—' : (v * 100).toLocaleString() + ' ' + t('lbs');
const hm = (s) => s ? s.replace('.', ':') : '—';
const hmFromMin = (m) => m == null ? '—' : `${Math.floor(m / 60)}:${String(Math.round(m) % 60).padStart(2, '0')}`;
const SR_MIN = 4;

let model = null;       // 파싱된 OFP (+ _flTrade, _leg, _srRuns, _notam)
let wxCache = { mMap: {}, tMap: {}, fetchedAt: null, stale: false };
let gps = null, gpsWatch = null, gpsTrail = [];
let mapHost = null;

// ── 파생 데이터 ──────────────────────────────────────────
function mainLeg(m) {
  const nl = m.navlog || [];
  const endIdx = nl.findIndex((r) => r.point === m.destIcao);
  const todIdx = nl.findIndex((r) => r.point === 'TOD');
  const cut = endIdx >= 0 ? endIdx : (todIdx >= 0 ? todIdx : nl.length - 1);
  return nl.slice(0, cut + 1);
}
function srRuns(leg) {
  const runs = [];
  let cur = null;
  leg.forEach((r, i) => {
    if (r.sr != null && r.sr >= SR_MIN) {
      if (cur && cur.i1 === i - 1) { cur.i1 = i; cur.max = Math.max(cur.max, r.sr); }
      else { cur = { i0: i, i1: i, max: r.sr }; runs.push(cur); }
    }
  });
  runs.forEach((r) => {
    r.s = Math.max(0, r.i0 - 1);
    r.t0 = leg[r.s]?.accMin ?? leg[r.i0]?.accMin ?? null;
    r.t1 = leg[r.i1]?.accMin ?? null;
  });
  return runs;
}
function buildModel(rawText) {
  const m = parseOFP(rawText);
  if (!m.ok) return m;
  m._flTrade = flTrade(m);
  m._leg = mainLeg(m);
  m._srRuns = srRuns(m._leg);
  m._notam = parseNotamPackage(rawText);
  m._fpl = explainFpl(rawText);
  m._route = m._leg.filter((r) => r.lat != null && r.lon != null);
  if (m._notam) {
    const win = [m.etdDate?.getTime(), m.etaDate?.getTime()];
    m._notam.items.forEach((n) => {
      n.rel = (n.kind === 'FIR' || n.kind === 'ERA') ? routeRelation(n, m._route) : null;
      if (win[0] && win[1]) {
        n.act = n.kind === 'DEP' ? isActive(n, win[0]) : (n.kind === 'DEST' || n.kind === 'ALTN') ? isActive(n, win[1]) : activeInWindow(n, win[0], win[1]);
      } else n.act = true;
    });
  }
  return m;
}
function ensureModel() {
  if (model) return model;
  const rawText = store.get('sw_ofp_text', '');
  if (!rawText) return null;
  model = buildModel(rawText);
  return model;
}
function apCoords(icao) {
  const mt = wxCache.mMap[icao];
  if (mt?.lat != null) return { icao, lat: mt.lat, lon: mt.lon };
  const info = airportInfo(icao, null);
  return info.lat != null ? { icao, lat: info.lat, lon: info.lon } : { icao, lat: null, lon: null };
}

// ── 공항 기상 카드 (공용) ─────────────────────────────────
function airportCard(icao, { removable = false, roleLabel = null, offsetMin = null } = {}) {
  const metar = wxCache.mMap[icao];
  const taf = wxCache.tMap[icao];
  const info = airportInfo(icao, metar);
  const off = offsetMin != null ? offsetMin : (info.tz ? tzOffsetMin(info.tz) : null);
  const card = el('div', 'card');
  const head = el('div', 'card-head');
  if (roleLabel) head.append(el('span', 'role', roleLabel));
  head.append(el('span', 'icao', icao), el('span', 'apt-name', info.name));
  if (metar?.fltCat) { const fc = fltCatInfo(metar.fltCat); const chip = el('span', 'fltcat', fc.label); chip.style.background = fc.color; head.append(chip); }
  if (removable) { const rm = el('button', 'btn-remove', '✕'); rm.title = t('remove'); rm.onclick = () => { removeAirport(icao); card.remove(); }; head.append(rm); }
  card.append(head);
  if (!metar) { card.append(el('div', 'err', t('loadError'))); return card; }

  const mSect = el('div', 'sect');
  const mTitle = el('div', 'sect-title', t('metar'));
  const ot = obsTimeStr(metar, off);
  if (ot) mTitle.append(el('span', 'updated', ` · ${ot}${wxCache.stale ? ' ⚠︎' : ''}`));
  mSect.append(mTitle);
  const lines = el('div', 'lines');
  renderMetarLines(metar).forEach((l) => lines.append(el('div', null, l)));
  mSect.append(lines);
  const raw = el('div', 'raw', metar.rawOb);
  raw.onclick = () => navigator.clipboard?.writeText(metar.rawOb).catch(() => {});
  mSect.append(raw);
  card.append(mSect);

  const wSect = el('div', 'sect');
  wSect.append(el('div', 'sect-title', t('runwayWind')));
  if (info.rwys.length) {
    const rows = runwayWind(info.rwys, info.var, metar.wdir, metar.wspd, metar.wgst);
    if (rows) {
      const tb = el('table', 'rwy-table');
      rows.forEach((r) => {
        const tr = el('tr');
        tr.append(el('td', 'rwy', 'RWY ' + r.rwy), el('td', r.head >= 0 ? 'hw' : 'tw', `${r.head >= 0 ? t('headwind') : t('tailwind')} ${Math.abs(r.head)}kt`), el('td', null, `${t('crosswind')} ${r.cross}kt${r.side ? ` (${r.side === 'L' ? t('left') : t('right')})` : ''}`));
        tb.append(tr);
      });
      wSect.append(tb);
    } else wSect.append(el('div', 'sub-line', metar.wspd ? t('variable') : t('calm')));
  } else {
    wSect.append(el('div', 'sub-line', t('noRunwayData')));
    const form = el('div', 'rwy-input');
    const inp = el('input'); inp.placeholder = t('rwyPlaceholder');
    const btn = el('button', null, t('saveRunways'));
    btn.onclick = () => { const rwys = inp.value.split(',').map((s) => s.trim().toUpperCase()).filter((s) => /^\d{2}[LRC]?$/.test(s)); if (rwys.length) { saveUserRwys(icao, rwys); render(); } };
    form.append(inp, btn); wSect.append(form);
  }
  card.append(wSect);

  const tSect = el('div', 'sect');
  tSect.append(el('div', 'sect-title', t('taf')));
  const periods = renderTafPeriods(taf, off);
  if (periods.length) {
    periods.forEach((p) => { const row = el('div', 'taf-row'); const when = el('div', 'taf-when'); when.append(el('div', 'taf-kind', p.kind), document.createTextNode(`${p.from} → ${p.to}`)); row.append(when, el('div', null, p.text)); tSect.append(row); });
    const rawT = el('div', 'raw', taf.rawTAF); rawT.onclick = () => navigator.clipboard?.writeText(taf.rawTAF).catch(() => {}); tSect.append(rawT);
  } else tSect.append(el('div', 'sub-line', t('noTaf')));
  card.append(tSect);

  const lat = info.lat ?? metar.lat, lon = info.lon ?? metar.lon;
  if (lat != null) {
    const s = sunTimes(new Date(), lat, lon);
    if (s) { const sSect = el('div', 'sect'); sSect.append(el('div', 'sect-title', t('sun')), el('div', 'sub-line', `${t('sunrise')} ${fmtTime(s.rise, off)} · ${t('sunset')} ${fmtTime(s.set, off)}`)); card.append(sSect); }
  }
  return card;
}

// ── 카드 프레임 ──────────────────────────────────────────
const CARD_IDS = ['summary', 'map', 'notam', 'wx', 'sr', 'fltrade', 'timeline', 'fuel', 'fpl', 'altn', 'raw'];
function cardVisible(id) { return store.get('sw_card_' + id, '1') === '1'; }
function briefCard(id, title, build) {
  if (!cardVisible(id)) return null;
  const d = document.createElement('details');
  d.className = 'card'; d.dataset.card = id;
  d.open = store.get('sw_open_' + id, '1') === '1';
  d.addEventListener('toggle', () => store.set('sw_open_' + id, d.open ? '1' : '0'));
  d.append(el('summary', 'card-sum', title));
  const body = el('div', 'card-body');
  build(body);
  d.append(body);
  return d;
}
function kv(body, pairs) {
  const g = el('div', 'kv');
  pairs.forEach(([k, v, cls]) => { if (v != null && v !== '') { const c = el('div', 'kv-item' + (cls ? ' ' + cls : '')); c.append(el('div', 'kv-k', k), el('div', 'kv-v', String(v))); g.append(c); } });
  body.append(g);
}

// ── 요약 ──
function summaryCard() {
  return briefCard('summary', t('cardSummary'), (b) => {
    const m = model;
    const hero = el('div', 'hero');
    const route = el('div', 'hero-route');
    route.append(el('span', 'hero-ap', m.dep?.iata || m.depIcao || '—'), el('span', 'hero-arrow', '✈'), el('span', 'hero-ap', m.dest?.iata || m.destIcao || '—'));
    hero.append(route);
    const subBits = [m.fltNo || m.callsign];
    if (m.date) subBits.push(`${m.date.getUTCFullYear()}-${String(m.date.getUTCMonth() + 1).padStart(2, '0')}-${String(m.date.getUTCDate()).padStart(2, '0')}`);
    if (m.reg) subBits.push(m.reg + (m.actype ? ' · ' + m.actype : ''));
    if (m.ci != null) subBits.push('CI' + m.ci);
    hero.append(el('div', 'hero-sub', subBits.filter(Boolean).join('  ·  ')));
    if (m.dep?.etd && m.dest?.eta) {
      const bar = el('div', 'hero-bar');
      bar.append(el('span', 'hero-time', fmtHmZ(m.dep.etd, m.dep.tzMin)));
      const track = el('div', 'hero-track'); track.append(el('div', 'hero-plane', '✈︎'));
      bar.append(track, el('span', 'hero-time', fmtHmZ(m.dest.eta, m.dest.tzMin)));
      hero.append(bar);
    }
    b.append(hero);
    if (m.src === 'ICAO-FPL') b.append(el('div', 'note', t('genericNote')));
    kv(b, [
      ['STD', m.dep?.std && m.dep.std !== m.dep.etd ? fmtHmZ(m.dep.std, m.dep.tzMin) : null],
      ['ETD', m.dep?.etd ? fmtHmZ(m.dep.etd, m.dep.tzMin) : null],
      ['STA', m.dest?.sta && m.dest.sta !== m.dest.eta ? fmtHmZ(m.dest.sta, m.dest.tzMin) : null],
      ['ETA', m.dest?.eta ? fmtHmZ(m.dest.eta, m.dest.tzMin) : null],
      [t('planFl'), m.plannedFL ? 'FL' + m.plannedFL : null],
      [t('dist'), m.dist ? `${m.dist.gnd}nm (GND)` : null],
      [t('avgWind'), m.avgComp != null ? `${m.avgComp >= 0 ? '+' : ''}${m.avgComp}kt` : null],
      [t('block'), m.eetTotal ? hmFromMin(m.eetTotal) : null],
      [t('validity'), m.validity || null],
      [t('dispatcher'), m.dispatcher || null],
    ]);
    if (m.route) b.append(el('div', 'raw route', m.route));
  });
}

// ── 지도 + GPS ──
function mapCard() {
  const m = model;
  if (!m._route?.length) return null;
  return briefCard('map', t('cardMap'), (b) => {
    mapHost = el('div', 'map-host');
    b.append(mapHost);
    const legend = el('div', 'map-legend');
    [['#5b9cf6', t('legendRoute')], ['#a855f7', t('legendSr')], ['#f59e0b', t('legendFir')], ['#f87171', t('legendNotam')], ['#22b07d', t('legendApt')]].forEach(([c, l]) => { const s = el('span'); const i = el('i'); i.style.background = c; s.append(i, l); legend.append(s); });
    b.append(legend);
    // GPS 패널
    const row = el('div', 'sect-actions');
    const btn = el('button', 'btn-sm' + (gpsWatch != null ? ' on' : ''), gpsWatch != null ? t('gpsStop') : t('gpsStart'));
    btn.onclick = () => { gpsWatch != null ? stopGps() : startGps(); };
    row.append(btn);
    b.append(row);
    const msg = el('div', 'sub-line'); msg.id = 'gpsMsg'; b.append(msg);
    const grid = el('div', 'gps-grid'); grid.id = 'gpsGrid'; grid.hidden = !gps; b.append(grid);
    const prog = el('div'); prog.id = 'gpsProg'; b.append(prog);
    drawMap();
    renderGpsPanel();
  });
}
async function drawMap() {
  if (!mapHost || !model?._route) return;
  const { renderMap } = await import('./map.js');
  const apts = [model.depIcao, model.destIcao, ...(model.altn || [])].filter(Boolean).map(apCoords);
  const notams = (model._notam?.items || []).filter((n) => n.coords.length && n.act && (n.rel === 'direct' || n.rel === 'near')).flatMap((n) => n.coords.slice(0, 1).map((c) => ({ ...c, id: n.id, level: n.rel })));
  await renderMap(mapHost, { route: model._leg, srRuns: model._srRuns, notams, airports: apts, gps: gps ? { ...gps, trail: gpsTrail } : null, width: mapHost.clientWidth || 380 });
}
function gpsMsg(txt, cls) { const m = $('#gpsMsg'); if (m) { m.textContent = txt; m.className = cls || 'sub-line'; } }
function startGps() {
  if (!navigator.geolocation) { gpsMsg(t('gpsDenied'), 'err'); return; }
  if (!window.isSecureContext) { gpsMsg(t('gpsInsecure'), 'err'); return; }
  gpsMsg(t('gpsWaiting'));
  gpsWatch = navigator.geolocation.watchPosition((pos) => {
    const c = pos.coords;
    gps = { lat: c.latitude, lon: c.longitude, alt: c.altitude != null ? c.altitude * 3.28084 : null, spd: c.speed != null ? c.speed * 1.943844 : null, hdg: c.heading, acc: c.accuracy, t: pos.timestamp };
    const last = gpsTrail[gpsTrail.length - 1];
    if (!last || Math.abs(last[0] - gps.lat) + Math.abs(last[1] - gps.lon) > 0.01) { gpsTrail.push([gps.lat, gps.lon]); if (gpsTrail.length > 1500) gpsTrail.shift(); }
    gpsMsg(`✅ ${t('gpsOk')} · ±${Math.round(c.accuracy)}m`, 'ok-note');
    renderGpsPanel(); drawMap();
  }, (err) => { gpsMsg(err.code === 1 ? t('gpsDenied') : t('gpsWaiting'), 'err'); if (err.code === 1) stopGps(); }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 30000 });
  render();
}
function stopGps() { if (gpsWatch != null) navigator.geolocation.clearWatch(gpsWatch); gpsWatch = null; render(); }
function renderGpsPanel() {
  const grid = $('#gpsGrid'), prog = $('#gpsProg');
  if (!grid || !gps) return;
  grid.hidden = false;
  const ll = (v, p, n) => `${v >= 0 ? p : n}${Math.floor(Math.abs(v))}°${((Math.abs(v) % 1) * 60).toFixed(1)}'`;
  grid.replaceChildren();
  const cell = (k, v) => { const d = el('div'); d.append(el('span', null, k), el('b', null, v)); grid.append(d); };
  cell('LAT', ll(gps.lat, 'N', 'S')); cell('LON', ll(gps.lon, 'E', 'W'));
  cell(t('gs'), gps.spd != null ? Math.round(gps.spd) + 'kt' : '—'); cell(t('trk'), gps.hdg != null && !isNaN(gps.hdg) ? String(Math.round(gps.hdg)).padStart(3, '0') + '°' : '—');
  cell(t('gpsAlt'), gps.alt != null ? Math.round(gps.alt).toLocaleString() + 'ft' : '—'); cell(t('acc'), gps.acc != null ? '±' + Math.round(gps.acc) + 'm' : '—');
  // 진행 상황
  const leg = model._leg, R = model._route;
  if (!R.length) return;
  let bi = 0, bd = Infinity;
  R.forEach((p, i) => { const d = gcDistNm(gps, p); if (d < bd) { bd = d; bi = i; } });
  const idx = leg.indexOf(R[bi]);
  const remain = leg.slice(idx + 1).reduce((a, r) => a + (r.dist || 0), 0);
  const bits = [`${t('nearestWpt')}: ${R[bi].point} (${Math.round(bd)}nm)`, `${t('remainDist')}: ${remain}nm`];
  if (gps.spd > 60) bits.push(`${t('liveEta')}: ${fmtTime(new Date(Date.now() + (remain / gps.spd) * 3600000), model.dest?.tzMin)}`);
  const el0 = leg[idx]?.accMin;
  const inRun = model._srRuns.find((r) => idx >= r.s && idx <= r.i1);
  const next = model._srRuns.find((r) => r.s > idx);
  if (inRun) bits.push(`🌪️ ${t('srIn')} (SR ${inRun.max})`);
  else if (next && el0 != null && next.t0 != null) bits.push(`🌪️ ${t('srNext')} ${Math.max(0, next.t0 - el0)}${t('min')} (SR ${next.max})`);
  prog.replaceChildren(el('div', 'note', bits.join('  ·  ')));
}

// ── NOTAM 브리핑 ──
let notamTab = 'DEP', notamAll = false;
function notamCard() {
  const np = model._notam;
  return briefCard('notam', t('cardNotam'), (b) => {
    if (!np) { b.append(el('div', 'note', t('notamNone'))); return; }
    const kinds = ['DEP', 'DEST', 'ALTN', 'ERA', 'FIR'].filter((k) => np.sections.some((s) => s.kind === k));
    if (!kinds.includes(notamTab)) notamTab = kinds[0];
    const tabs = el('div', 'ntabs');
    kinds.forEach((k) => {
      const items = np.items.filter((n) => n.kind === k);
      const act = items.filter((n) => n.act).length;
      const btn = el('button', 'ntab' + (k === notamTab ? ' on' : ''));
      btn.append(document.createTextNode(KIND_KO[k]), el('small', null, `${act}/${items.length}`));
      btn.onclick = () => { notamTab = k; render(); };
      tabs.append(btn);
    });
    b.append(tabs);
    const secs = np.sections.filter((s) => s.kind === notamTab);
    const allBtn = el('button', 'chip' + (notamAll ? ' chip-on' : ''), t('notamShowAll'));
    allBtn.onclick = () => { notamAll = !notamAll; render(); };
    b.append(allBtn);
    for (const s of secs) {
      if (!s.items.length) continue;
      if (secs.length > 1) b.append(el('div', 'sect-title', `${s.icao} ${s.name}`));
      const groups = new Map();
      for (const n of s.items) { if (!notamAll && !n.act) continue; const c = n.category; if (!groups.has(c)) groups.set(c, []); groups.get(c).push(n); }
      for (const [cat, arr] of groups) {
        b.append(el('div', 'ncat', `${CAT_KO[cat] || cat} · ${arr.length}`));
        arr.sort((x, y) => (y.act - x.act) || (x.rel === 'direct' ? -1 : 0));
        arr.forEach((n) => b.append(notamItem(n)));
      }
    }
  });
}
function notamItem(n) {
  const d = document.createElement('details');
  d.className = 'nitem' + (n.act ? '' : ' off');
  const s = el('summary');
  const badges = el('div');
  badges.append(el('span', 'nbadge ' + (n.act ? 'act' : 'off'), n.act ? t('notamActive') : t('notamOff')));
  if (n.rel === 'direct') badges.append(document.createTextNode(' '), el('span', 'nbadge direct', t('notamDirect')));
  else if (n.rel === 'near') badges.append(document.createTextNode(' '), el('span', 'nbadge near', t('notamNear')));
  s.append(badges, el('span', 'nid', `${n.icao} ${n.id}`));
  s.append(el('div', 'nhead', headline(n)));
  s.append(el('div', 'nsub', n.etext));
  d.append(s);
  const body = el('div', 'nbody');
  const to = /UFN/.test(n.to) ? '추후 통보 시까지' : /PERM/.test(n.to) ? '영구' : n.toMs ? fmtDayTime(new Date(n.toMs), null) : n.to;
  body.append(el('div', 'note', `📅 ${t('notamValid')}: ${n.fromMs ? fmtDayTime(new Date(n.fromMs), null) : n.from} ~ ${to}`));
  if (n.schedule) body.append(el('div', 'note', `⏰ ${t('notamSched')}: ${n.schedule} → ${scheduleKo(n.schedule)}`));
  if (n.comment) body.append(el('div', 'note warn-note', `💬 ${t('notamComment')}: ${n.comment}`));
  body.append(el('div', 'sect-title', t('notamLit')), el('div', 'nlit', literalKo(n.etext)));
  const gl = glossary(n.etext);
  if (gl.length) { const g = el('div', 'ngloss'); gl.forEach(([k, v]) => g.append(el('span', null, `${k} ${v}`))); body.append(g); }
  body.append(el('div', 'raw', n.raw));
  d.append(body);
  return d;
}

// ── 공항 기상 ──
function wxCardsWrap() {
  return briefCard('wx', t('cardWx'), (b) => {
    [[model.depIcao, t('depAp'), model.dep?.tzMin], [model.destIcao, t('destAp'), model.dest?.tzMin], ...(model.altn || []).map((a) => [a, t('altnAp'), null])]
      .filter(([i]) => i).forEach(([icao, role, off]) => b.append(airportCard(icao, { roleLabel: role, offsetMin: off })));
  });
}

// ── SR 구간 ──
function srCard() {
  const m = model;
  if (!m._leg?.some((r) => r.sr != null)) return null;
  return briefCard('sr', t('cardSr'), (b) => {
    if (!m._srRuns.length) { b.append(el('div', 'ok-note', `✅ ${t('srNone')} (${t('srMax')} ${Math.max(...m._leg.filter((r) => r.sr != null).map((r) => r.sr))})`)); }
    m._srRuns.forEach((r) => {
      const row = el('div', 'sr-row');
      const dur = r.t0 != null && r.t1 != null ? r.t1 - r.t0 : null;
      const big = el('div', 'sr-big');
      big.append(`${t('srAfter')} `, el('b', null, hmFromMin(r.t0)), dur != null ? ` ${dur}${t('srFor')}` : '', ` · ${t('srMax')} ${r.max}`);
      row.append(big);
      const fls = [...new Set(m._leg.slice(r.i0, r.i1 + 1).map((w) => w.fl).filter((v) => typeof v === 'number'))].map((v) => 'FL' + v).join('·');
      row.append(el('div', 'sub-line', `${m._leg[r.s]?.point} → ${m._leg[r.i1]?.point} · ${hmFromMin(r.t0)}~${hmFromMin(r.t1)}${fls ? ' · ' + fls : ''}`));
      if (m.etdDate && r.t0 != null) row.append(el('div', 'sub-line', `≈ ${fmtTime(new Date(m.etdDate.getTime() + r.t0 * 60000), null)}${r.t1 != null ? ' ~ ' + fmtTime(new Date(m.etdDate.getTime() + r.t1 * 60000), null) : ''}`));
      b.append(row);
    });
    b.append(el('div', 'note', t('srNote')));
  });
}

// ── 연료 (+실제 RAMP 입력) ──
function fuelCard() {
  if (!model.fuel) return null;
  return briefCard('fuel', t('cardFuel'), (b) => {
    const f = model.fuel;
    const tb = el('table', 'data-table');
    const thead = el('tr'); [t('fuelItem'), t('fuelLbs'), t('fuelTime')].forEach((h) => thead.append(el('th', null, h))); tb.append(thead);
    const rows = [['fTrip', f.trip], ['fCont', f.cont], ['fAltn', f.altn, model.altnIcao], ['fFrsv', f.frsv], ['fRqrd', f.rqrd], ['fExtra', f.extra, f.extra?.extra ? 'RSN/' + f.extra.extra : null], ['fTkof', f.tkof], ['fTaxi', f.taxi], ['fRamp', f.ramp], ['fFod', f.fod]];
    for (const [key, v, note] of rows) {
      if (!v) continue;
      const tr = el('tr', ['fRqrd', 'fTkof', 'fRamp', 'fFod'].includes(key) ? 'row-strong' : null);
      tr.append(el('td', null, t(key) + (note ? ` ${note}` : '')), el('td', 'num', p100lbs(v.v)), el('td', 'num', hm(v.time)));
      tb.append(tr);
    }
    b.append(tb);
    const w = model.weights || {};
    kv(b, [['TOW', p100lbs(w.tow)], ['LDW', p100lbs(w.ldw)], ['ZFW', p100lbs(w.zfw)], ['AGTOW', p100lbs(w.agtow)]]);
    // 실제 RAMP 입력 → 재계산 (OFP의 ZFW·TAXI·TRIP·한계 사용)
    const key = 'sw_ramp_' + (model.callsign || '') + (model.date?.toISOString().slice(0, 10) || '');
    const inRow = el('div', 'fuel-in');
    const lab = el('label', null, t('actualRamp'));
    const inp = el('input'); inp.type = 'number'; inp.placeholder = String((f.ramp?.v || 0) * 100); inp.value = store.get(key, '');
    inRow.append(lab, inp, el('span', 'sub-line', t('fuelRecalc')));
    b.append(inRow);
    const out = el('div'); b.append(out);
    const recalc = () => {
      out.replaceChildren();
      const ramp = parseFloat(inp.value);
      if (!ramp || !w.zfw) return;
      store.set(key, inp.value);
      const taxi = (f.taxi?.v || 0) * 100, trip = (f.trip?.v || 0) * 100;
      const tow = w.zfw * 100 + ramp - taxi, ldw = tow - trip, fod = ramp - taxi - trip;
      const minLdg = ((f.altn?.v || 0) + (f.frsv?.v || 0)) * 100;
      kv(out, [
        [t('estTow'), `${tow.toLocaleString()} lbs${w.agtow ? ` (AGTOW −${(w.agtow * 100 - tow).toLocaleString()})` : ''}`, w.agtow && tow > w.agtow * 100 ? 'bad' : 'good'],
        [t('estLdw'), `${ldw.toLocaleString()} lbs`],
        [t('estFod'), `${fod.toLocaleString()} lbs`, fod < minLdg ? 'bad' : 'good'],
        [t('minLdgFuel'), `${minLdg.toLocaleString()} lbs`],
        [t('holdMargin'), `${(fod - minLdg).toLocaleString()} lbs`, fod - minLdg < 0 ? 'bad' : 'good'],
      ]);
    };
    inp.oninput = recalc; recalc();
    if (model.remarks?.length) { b.append(el('div', 'sect-title', t('dispRemark'))); model.remarks.forEach((r) => b.append(el('div', 'note', r))); }
  });
}

// ── FL 트레이드 ──
function flTradeCard() {
  const ft = model._flTrade;
  if (!ft) return null;
  return briefCard('fltrade', t('cardFlTrade'), (b) => {
    const tb = el('table', 'data-table');
    const thead = el('tr'); [t('flCol'), t('dTimeCol'), t('etaCol'), t('compCol'), t('tempCol')].forEach((h) => thead.append(el('th', null, h))); tb.append(thead);
    for (const l of ft.levels) {
      const tr = el('tr', l.isPlanned ? 'row-planned' : null);
      const eta = model.etaDate ? fmtTime(new Date(model.etaDate.getTime() + l.dMin * 60000), model.dest?.tzMin) : '—';
      tr.append(el('td', null, 'FL' + l.fl + (l.isPlanned ? ` ◀ ${t('planned')}` : '')), el('td', 'num ' + (l.dMin > 0 ? 'tw' : l.dMin < 0 ? 'hw' : ''), (l.dMin >= 0 ? '+' : '') + l.dMin + t('min')), el('td', 'num', eta), el('td', 'num', (l.avgComp >= 0 ? '+' : '') + l.avgComp + 'kt'), el('td', 'num', l.avgTemp + '°C'));
      tb.append(tr);
    }
    b.append(tb);
    kv(b, [[t('flTradeBasis'), `M${ft.mach} · ${ft.cruiseDist}nm`], [t('windProg'), model.windProg || null]]);
    b.append(el('div', 'note warn-note', t('flTradeNote')));
  });
}

// ── 타임라인 ──
function timelineCard() {
  const m = model;
  if (!m.etdDate) return null;
  return briefCard('timeline', t('cardTimeline'), (b) => {
    const rows = [[t('tlEtd'), m.etdDate, m.dep?.tzMin, m.depIcao]];
    const toc = m._leg?.find((r) => r.point === 'TOC');
    if (toc?.accMin != null) rows.push([t('tlToc'), new Date(m.etdDate.getTime() + toc.accMin * 60000), null, null]);
    (m.eet || []).forEach((e) => rows.push([`${t('tlFir')} ${e.fir}${FIR_KO[e.fir] ? '(' + FIR_KO[e.fir] + ')' : ''}`, new Date(m.etdDate.getTime() + e.min * 60000), null, null]));
    m._srRuns.forEach((r) => { if (r.t0 != null) rows.push([`🌪️ ${t('tlSr')} SR${r.max} ${m._leg[r.s]?.point}→${m._leg[r.i1]?.point}`, new Date(m.etdDate.getTime() + r.t0 * 60000), null, null]); });
    const tod = m._leg?.find((r) => r.point === 'TOD');
    if (tod?.accMin != null) rows.push([t('tlTod'), new Date(m.etdDate.getTime() + tod.accMin * 60000), null, null]);
    if (m.etaDate) rows.push([t('tlEta'), m.etaDate, m.dest?.tzMin, m.destIcao]);
    const tb = el('table', 'data-table tl-table');
    rows.sort((a, b2) => a[1] - b2[1]).forEach(([label, date, off, ap]) => { const tr = el('tr'); tr.append(el('td', null, label + (ap ? ` · ${ap}` : '')), el('td', 'num', fmtDayTime(date, off))); tb.append(tr); });
    b.append(tb);
    const dm = wxCache.mMap[m.destIcao];
    if (dm?.lat != null && m.etaDate) {
      const s = sunTimes(m.etaDate, dm.lat, dm.lon);
      if (s) { const night = m.etaDate < s.rise || m.etaDate > s.set; b.append(el('div', 'note', `${night ? '🌙 ' + t('tlNight') : '☀️ ' + t('tlDay')} — ${t('sunrise')} ${fmtTime(s.rise, m.dest?.tzMin)} · ${t('sunset')} ${fmtTime(s.set, m.dest?.tzMin)}`)); }
    }
  });
}

// ── FPL 풀이 ──
function fplCard() {
  const fp = model._fpl;
  return briefCard('fpl', t('cardFpl'), (b) => {
    if (!fp) { b.append(el('div', 'note', t('fplNone'))); return; }
    const caps = el('div', 'fcaps');
    fp.caps.forEach((c) => caps.append(el('span', 'fcap ' + c.cls, (c.cls === 'ok' ? '✅ ' : c.cls === 'warn' ? '⚠️ ' : '') + c.text)));
    b.append(caps);
    fp.sections.forEach((s) => {
      const sec = el('div', 'fsec');
      const h = el('h4', null, s.title); if (s.mono) h.append(el('code', null, s.mono)); sec.append(h);
      if (s.rows?.length) { const g = el('div', 'frow'); s.rows.forEach(([k, v]) => g.append(el('b', null, k), el('span', null, v))); sec.append(g); }
      if (s.chips?.length) { const g = el('div', 'fchips'); s.chips.forEach((c) => { const sp = el('span', 'fchip'); sp.append(el('b', null, c.code), c.desc); g.append(sp); }); sec.append(g); }
      if (s.route) sec.append(el('div', 'raw route', s.route));
      b.append(sec);
    });
  });
}

// ── 교체공항 / 원문 ──
function altnCard() {
  if (!model.altnSummary?.length) return null;
  return briefCard('altn', t('cardAltn'), (b) => {
    const tb = el('table', 'data-table');
    const thead = el('tr'); ['ALTN', t('altnRwy'), t('altnDist'), t('altnFl'), t('altnTime'), t('compCol'), t('altnFuel'), t('altnRte')].forEach((h) => thead.append(el('th', null, h))); tb.append(thead);
    model.altnSummary.forEach((a) => { const tr = el('tr'); tr.append(el('td', null, a.icao), el('td', null, a.rwy), el('td', 'num', a.dist + 'nm'), el('td', 'num', 'FL' + a.fl), el('td', 'num', hm(a.time)), el('td', 'num', (a.comp >= 0 ? '+' : '') + a.comp + 'kt'), el('td', 'num', p100lbs(a.fuel)), el('td', 'rte', a.rte)); tb.append(tr); });
    b.append(tb);
  });
}
function rawCard(rawText) {
  return briefCard('raw', t('cardRaw'), (b) => { b.append(el('div', 'note', t('rawHint')), el('pre', 'ofp-raw', rawText)); });
}
function cardSettingsRow() {
  const row = el('div', 'card-toggles');
  row.append(el('span', 'sect-title', t('cards')));
  CARD_IDS.forEach((id) => {
    const btn = el('button', 'chip' + (cardVisible(id) ? ' chip-on' : ''), t('card' + id[0].toUpperCase() + id.slice(1)).replace(/^\S+\s/, ''));
    btn.onclick = () => { store.set('sw_card_' + id, cardVisible(id) ? '0' : '1'); render(); };
    row.append(btn);
  });
  return row;
}

// ── 요약 복사 / 인쇄 ──
function briefText() {
  const m = model, L = [];
  L.push(`${m.fltNo || m.callsign} ${m.depIcao}→${m.destIcao} ${m.date ? m.date.toISOString().slice(0, 10) : ''} ${m.reg || ''}`);
  L.push(`ETD ${fmtHmZ(m.dep?.etd, m.dep?.tzMin)} ETA ${fmtHmZ(m.dest?.eta, m.dest?.tzMin)} FL${m.plannedFL || '—'} ${m.dist ? m.dist.gnd + 'nm' : ''} WIND ${m.avgComp >= 0 ? '+' : ''}${m.avgComp ?? '—'}kt`);
  if (m.fuel) L.push(`FUEL TRIP ${p100lbs(m.fuel.trip?.v)} / TKOF ${p100lbs(m.fuel.tkof?.v)} / FOD ${p100lbs(m.fuel.fod?.v)} / EXTRA ${p100lbs(m.fuel.extra?.v)}${m.fuel.extra?.extra ? ' ' + m.fuel.extra.extra : ''}`);
  [m.depIcao, m.destIcao, ...(m.altn || [])].forEach((i) => { const w = wxCache.mMap[i]; if (w) L.push(`${i}: ${w.rawOb}`); });
  if (m._flTrade) L.push('FL TRADE: ' + m._flTrade.levels.map((l) => `FL${l.fl} ${l.dMin >= 0 ? '+' : ''}${l.dMin}m`).join(' | '));
  m._srRuns.forEach((r) => L.push(`SR${r.max} ${m._leg[r.s]?.point}→${m._leg[r.i1]?.point} T+${hmFromMin(r.t0)}~${hmFromMin(r.t1)}`));
  const act = (m._notam?.items || []).filter((n) => n.act && n.kind !== 'ERA');
  if (act.length) { L.push(`NOTAM (${act.length} active):`); act.slice(0, 40).forEach((n) => L.push(` ${n.icao} ${n.id} ${headline(n)} — ${n.etext.slice(0, 90)}`)); }
  L.push(t('disclaimer'));
  return L.join('\n');
}

// ── 내 비행 뷰 ──
function flightView(container) {
  const rawText = store.get('sw_ofp_text', '');
  if (!rawText) {
    const box = el('div', 'paste-box');
    const err = el('div', 'err');
    const prog = el('div', 'drop-progress'); prog.hidden = true;
    const acceptText = (text) => {
      const parsed = parseOFP(text || '');
      if (!parsed.ok) { err.textContent = t('parseFail'); prog.hidden = true; return; }
      store.set('sw_ofp_text', text); model = null; render(); refreshWx();
    };
    const handleFile = async (file) => {
      err.textContent = '';
      try {
        if (/pdf$/i.test(file.name) || file.type === 'application/pdf') {
          prog.hidden = false; prog.textContent = t('parsing');
          const { extractPdfText } = await import('./pdfread.js');
          const text = await extractPdfText(await file.arrayBuffer(), (i, n) => { prog.textContent = `${t('parsing')} ${i}/${n}`; });
          acceptText(text);
        } else acceptText(await file.text());
      } catch (e) { prog.hidden = true; err.textContent = `${t('fileBad')} (${e.message})`; }
    };
    const drop = el('div', 'dropzone');
    drop.append(el('div', 'drop-icon', '🛫'), el('h2', null, t('dropTitle')), el('p', 'sub-line', t('dropHint')));
    const fi = document.createElement('input'); fi.type = 'file'; fi.accept = '.pdf,.txt,application/pdf,text/plain'; fi.hidden = true;
    fi.onchange = () => { if (fi.files[0]) handleFile(fi.files[0]); };
    drop.onclick = () => fi.click();
    drop.ondragover = (ev) => { ev.preventDefault(); drop.classList.add('drag'); };
    drop.ondragleave = () => drop.classList.remove('drag');
    drop.ondrop = (ev) => { ev.preventDefault(); drop.classList.remove('drag'); const f = ev.dataTransfer?.files?.[0]; if (f) handleFile(f); };
    box.append(drop, fi, prog, err);
    const det = document.createElement('details'); det.className = 'paste-alt';
    det.append(el('summary', null, t('orPaste')));
    const ta = el('textarea', 'ofp-input'); ta.placeholder = t('ofpPlaceholder');
    const btn = el('button', 'primary', t('buildBrief')); btn.onclick = () => acceptText(ta.value);
    det.append(ta, btn); box.append(det);
    container.append(box);
    return;
  }
  ensureModel();
  const actions = el('div', 'flight-actions');
  const bCopy = el('button', 'chip', t('copyBrief'));
  bCopy.onclick = () => navigator.clipboard?.writeText(briefText()).then(() => { bCopy.textContent = t('copied'); setTimeout(() => { bCopy.textContent = t('copyBrief'); }, 1500); }).catch(() => {});
  const bPrint = el('button', 'chip', t('printBrief'));
  bPrint.onclick = () => { document.querySelectorAll('details.card').forEach((d) => { d.open = true; }); setTimeout(() => window.print(), 100); };
  const bNew = el('button', 'chip', t('newOfp'));
  bNew.onclick = () => { store.del('sw_ofp_text'); model = null; stopGps(); render(); };
  actions.append(bCopy, bPrint, bNew);
  container.append(actions);
  [summaryCard(), mapCard(), notamCard(), wxCardsWrap(), srCard(), flTradeCard(), timelineCard(), fuelCard(), fplCard(), altnCard(), rawCard(rawText)]
    .filter(Boolean).forEach((c) => container.append(c));
  container.append(cardSettingsRow());
}

function airportsView(container) {
  const wrap = el('div', 'cards');
  getList().forEach((icao) => wrap.append(airportCard(icao, { removable: true })));
  container.append(wrap);
  const form = el('form', 'add-form');
  const inp = el('input'); inp.maxLength = 4; inp.placeholder = t('addAirport'); inp.spellcheck = false;
  const btn = el('button', 'primary', t('add'));
  form.onsubmit = (ev) => { ev.preventDefault(); if (addAirport(inp.value)) { inp.value = ''; refreshWx(); } };
  form.append(inp, btn);
  container.append(form);
}

// ── 데이터 로딩/렌더 ──
function neededIcaos() {
  const set = new Set(getList());
  const m = ensureModel();
  if (m?.ok) [m.depIcao, m.destIcao, ...(m.altn || [])].filter(Boolean).forEach((i) => set.add(i));
  return [...set].slice(0, 20);
}
async function refreshWx() {
  const ids = neededIcaos();
  if (!ids.length) { render(); return; }
  try {
    const [metars, tafs] = await Promise.all([fetchWx('metar', ids), fetchWx('taf', ids)]);
    wxCache = { mMap: {}, tMap: {}, fetchedAt: Date.now(), stale: false };
    (metars || []).forEach((m) => { wxCache.mMap[m.icaoId] = m; });
    (tafs || []).forEach((f) => { wxCache.tMap[f.icaoId] = f; });
    store.set('sw_snapshot', JSON.stringify(wxCache));
    $('#offlineNote').hidden = true;
  } catch {
    try { wxCache = JSON.parse(store.get('sw_snapshot', 'null')) || wxCache; } catch {}
    wxCache.stale = true;
    const note = $('#offlineNote');
    note.textContent = `${t('offlineNote')}${wxCache.fetchedAt ? ` (${new Date(wxCache.fetchedAt).toLocaleString()})` : ''}`;
    note.hidden = false;
  }
  render();
}
function applyStaticText() {
  $('#appTitle').textContent = t('appTitle'); $('#tagline').textContent = t('tagline'); $('#disclaimer').textContent = t('disclaimer');
  $('#btnLang').textContent = t('lang'); $('#btnTime').textContent = timePref();
  $('#tabFlight').textContent = t('tabFlight'); $('#tabAirports').textContent = t('tabAirports');
}
function render() {
  applyStaticText();
  const tab = store.get('sw_tab', 'flight');
  $('#tabFlight').classList.toggle('tab-on', tab === 'flight');
  $('#tabAirports').classList.toggle('tab-on', tab !== 'flight');
  const main = $('#view');
  main.replaceChildren();
  mapHost = null;
  if (tab === 'flight') flightView(main); else airportsView(main);
}
function initControls() {
  $('#btnRefresh').onclick = refreshWx;
  $('#btnTheme').onclick = () => { const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark'; document.body.dataset.theme = next; store.set('sw_theme', next); };
  $('#btnLang').onclick = () => { setLang(lang === 'ko' ? 'en' : 'ko'); store.set('sw_lang', lang); render(); };
  $('#btnTime').onclick = () => { toggleTimePref(); render(); };
  $('#tabFlight').onclick = () => { store.set('sw_tab', 'flight'); render(); };
  $('#tabAirports').onclick = () => { store.set('sw_tab', 'airports'); render(); };
}
(function main() {
  document.body.dataset.theme = store.get('sw_theme', 'dark');
  setLang(store.get('sw_lang', 'ko'));
  try { wxCache = JSON.parse(store.get('sw_snapshot', 'null')) || wxCache; } catch {}
  initControls();
  render();
  refreshWx();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
