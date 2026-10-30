// 메인 앱 — 홈은 "내 비행"(OFP 브리핑 자동 구성), 공항 수동 조회는 보조 탭. 모든 수치 참고용(R3)
import { t, setLang, lang } from './i18n.js';
import { getList, addAirport, removeAirport, airportInfo, saveUserRwys } from './airports.js';
import { fetchWx, renderMetarLines, renderTafPeriods, fltCatInfo, obsTimeStr } from './wx.js';
import { runwayWind } from './wind.js';
import { sunTimes } from './sun.js';
import { timePref, toggleTimePref, fmtTime, fmtHmZ, fmtDayTime, tzOffsetMin } from './time.js';
import { parseOFP } from './ofp.js';
import { flTrade } from './fltrade.js';

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
const p100lbs = (v) => v == null ? '—' : (v * 100).toLocaleString() + ' lbs';
const hm = (s) => s ? s.replace('.', ':') : '—';

let model = null;       // 파싱된 OFP
let wxCache = { mMap: {}, tMap: {}, fetchedAt: null, stale: false };

// ── 공항 기상 카드 (내 비행/공항 탭 공용) ─────────────────
function airportCard(icao, { removable = false, roleLabel = null, offsetMin = null } = {}) {
  const metar = wxCache.mMap[icao];
  const taf = wxCache.tMap[icao];
  const info = airportInfo(icao, metar);
  const off = offsetMin != null ? offsetMin : (info.tz ? tzOffsetMin(info.tz) : null);
  const card = el('div', 'card');

  const head = el('div', 'card-head');
  if (roleLabel) head.append(el('span', 'role', roleLabel));
  head.append(el('span', 'icao', icao), el('span', 'apt-name', info.name));
  if (metar?.fltCat) {
    const fc = fltCatInfo(metar.fltCat);
    const chip = el('span', 'fltcat', fc.label);
    chip.style.background = fc.color;
    head.append(chip);
  }
  if (removable) {
    const rm = el('button', 'btn-remove', '✕');
    rm.title = t('remove');
    rm.onclick = () => { removeAirport(icao); card.remove(); };
    head.append(rm);
  }
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
  raw.onclick = () => navigator.clipboard?.writeText(metar.rawOb);
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
        tr.append(el('td', 'rwy', 'RWY ' + r.rwy));
        tr.append(el('td', r.head >= 0 ? 'hw' : 'tw', `${r.head >= 0 ? t('headwind') : t('tailwind')} ${Math.abs(r.head)}kt`));
        tr.append(el('td', null, `${t('crosswind')} ${r.cross}kt${r.side ? ` (${r.side === 'L' ? t('left') : t('right')})` : ''}`));
        tb.append(tr);
      });
      wSect.append(tb);
    } else wSect.append(el('div', 'sub-line', metar.wspd ? t('variable') : t('calm')));
  } else {
    wSect.append(el('div', 'sub-line', t('noRunwayData')));
    const form = el('div', 'rwy-input');
    const inp = el('input'); inp.placeholder = '15,33';
    const btn = el('button', null, t('saveRunways'));
    btn.onclick = () => {
      const rwys = inp.value.split(',').map((s) => s.trim().toUpperCase()).filter((s) => /^\d{2}[LRC]?$/.test(s));
      if (rwys.length) { saveUserRwys(icao, rwys); render(); }
    };
    form.append(inp, btn);
    wSect.append(form);
  }
  card.append(wSect);

  const tSect = el('div', 'sect');
  tSect.append(el('div', 'sect-title', t('taf')));
  const periods = renderTafPeriods(taf, off);
  if (periods.length) {
    periods.forEach((p) => {
      const row = el('div', 'taf-row');
      const when = el('div', 'taf-when');
      when.append(el('div', 'taf-kind', p.kind), document.createTextNode(`${p.from} → ${p.to}`));
      row.append(when, el('div', null, p.text));
      tSect.append(row);
    });
    const rawT = el('div', 'raw', taf.rawTAF);
    rawT.onclick = () => navigator.clipboard?.writeText(taf.rawTAF);
    tSect.append(rawT);
  } else tSect.append(el('div', 'sub-line', t('noTaf')));
  card.append(tSect);

  const lat = info.lat ?? metar.lat, lon = info.lon ?? metar.lon;
  if (lat != null) {
    const s = sunTimes(new Date(), lat, lon);
    if (s) {
      const sSect = el('div', 'sect');
      sSect.append(el('div', 'sect-title', t('sun')));
      sSect.append(el('div', 'sub-line', `${t('sunrise')} ${fmtTime(s.rise, off)} · ${t('sunset')} ${fmtTime(s.set, off)}`));
      card.append(sSect);
    }
  }
  return card;
}

// ── 내 비행 카드들 ────────────────────────────────────────
const CARD_IDS = ['summary', 'fuel', 'wx', 'fltrade', 'timeline', 'altn', 'raw'];
function cardVisible(id) { return store.get('sw_card_' + id, '1') === '1'; }

function briefCard(id, title, build) {
  if (!cardVisible(id)) return null;
  const d = document.createElement('details');
  d.className = 'card';
  d.open = store.get('sw_open_' + id, '1') === '1';
  d.addEventListener('toggle', () => store.set('sw_open_' + id, d.open ? '1' : '0'));
  const s = el('summary', 'card-sum', title);
  d.append(s);
  const body = el('div', 'card-body');
  build(body);
  d.append(body);
  return d;
}

function kv(body, pairs) {
  const g = el('div', 'kv');
  pairs.forEach(([k, v]) => { if (v != null && v !== '') { const c = el('div', 'kv-item'); c.append(el('div', 'kv-k', k), el('div', 'kv-v', String(v))); g.append(c); } });
  body.append(g);
}

function summaryCard() {
  return briefCard('summary', t('cardSummary'), (b) => {
    const m = model;
    const legLine = el('div', 'leg');
    legLine.append(el('b', null, m.fltNo || m.callsign || '—'), el('span', 'leg-route', ` ${m.dep?.iata || m.depIcao} → ${m.dest?.iata || m.destIcao}`));
    if (m.date) legLine.append(el('span', 'leg-date', ` · ${m.date.getUTCFullYear()}-${String(m.date.getUTCMonth() + 1).padStart(2, '0')}-${String(m.date.getUTCDate()).padStart(2, '0')}`));
    b.append(legLine);
    if (m.src === 'ICAO-FPL') b.append(el('div', 'note', t('genericNote')));
    kv(b, [
      ['STD', m.dep?.std ? fmtHmZ(m.dep.std, m.dep.tzMin) : null],
      ['ETD', m.dep?.etd ? fmtHmZ(m.dep.etd, m.dep.tzMin) : null],
      ['STA', m.dest?.sta ? fmtHmZ(m.dest.sta, m.dest.tzMin) : null],
      ['ETA', m.dest?.eta ? fmtHmZ(m.dest.eta, m.dest.tzMin) : null],
      [t('reg'), m.reg ? `${m.reg}${m.actype ? ' · ' + m.actype : ''}` : m.actype],
      ['CI', m.ci],
      [t('planFl'), m.plannedFL ? 'FL' + m.plannedFL : null],
      [t('dist'), m.dist ? `${m.dist.gnd}nm (GND)` : null],
      [t('avgWind'), m.avgComp != null ? `${m.avgComp >= 0 ? '+' : ''}${m.avgComp}kt` : null],
      [t('block'), m.eetTotal ? `${Math.floor(m.eetTotal / 60)}:${String(m.eetTotal % 60).padStart(2, '0')}` : null],
    ]);
    if (m.route) b.append(el('div', 'raw route', m.route));
  });
}

function fuelCard() {
  if (!model.fuel) return null;
  return briefCard('fuel', t('cardFuel'), (b) => {
    const f = model.fuel;
    const tb = el('table', 'data-table');
    const thead = el('tr');
    [t('fuelItem'), t('fuelLbs'), t('fuelTime')].forEach((h) => thead.append(el('th', null, h)));
    tb.append(thead);
    const rows = [
      ['fTrip', f.trip], ['fCont', f.cont], ['fAltn', f.altn, model.altnIcao], ['fFrsv', f.frsv],
      ['fRqrd', f.rqrd], ['fExtra', f.extra, f.extra?.extra ? 'RSN/' + f.extra.extra : null],
      ['fTkof', f.tkof], ['fTaxi', f.taxi], ['fRamp', f.ramp],
    ];
    for (const [key, v, note] of rows) {
      if (!v) continue;
      const tr = el('tr', ['fRqrd', 'fTkof', 'fRamp'].includes(key) ? 'row-strong' : null);
      tr.append(el('td', null, t(key) + (note ? ` ${note}` : '')), el('td', 'num', p100lbs(v.v)), el('td', 'num', hm(v.time)));
      tb.append(tr);
    }
    b.append(tb);
    if (model.weights) {
      kv(b, [['TOW', p100lbs(model.weights.tow)], ['LDW', p100lbs(model.weights.ldw)], ['ZFW', p100lbs(model.weights.zfw)], ['AGTOW', p100lbs(model.weights.agtow)]]);
    }
    if (model.remarks?.length) {
      b.append(el('div', 'sect-title', t('dispRemark')));
      model.remarks.forEach((r) => b.append(el('div', 'note', r)));
    }
  });
}

function wxCardsWrap() {
  return briefCard('wx', t('cardWx'), (b) => {
    const list = [
      [model.depIcao, t('depAp'), model.dep?.tzMin],
      [model.destIcao, t('destAp'), model.dest?.tzMin],
      ...(model.altn || []).map((a) => [a, t('altnAp'), null]),
    ].filter(([i]) => i);
    list.forEach(([icao, role, off]) => b.append(airportCard(icao, { roleLabel: role, offsetMin: off })));
  });
}

function flTradeCard() {
  const ft = model._flTrade;
  if (!ft) return null;
  return briefCard('fltrade', t('cardFlTrade'), (b) => {
    const tb = el('table', 'data-table');
    const thead = el('tr');
    [t('flCol'), t('dTimeCol'), t('etaCol'), t('compCol'), t('tempCol')].forEach((h) => thead.append(el('th', null, h)));
    tb.append(thead);
    for (const l of ft.levels) {
      const tr = el('tr', l.isPlanned ? 'row-planned' : null);
      const eta = model.etaDate ? fmtTime(new Date(model.etaDate.getTime() + l.dMin * 60000), model.dest?.tzMin) : '—';
      tr.append(
        el('td', null, 'FL' + l.fl + (l.isPlanned ? ` ◀ ${t('planned')}` : '')),
        el('td', 'num ' + (l.dMin > 0 ? 'tw' : l.dMin < 0 ? 'hw' : ''), (l.dMin >= 0 ? '+' : '') + l.dMin + '분'),
        el('td', 'num', eta),
        el('td', 'num', (l.avgComp >= 0 ? '+' : '') + l.avgComp + 'kt'),
        el('td', 'num', l.avgTemp + '°C'),
      );
      tb.append(tr);
    }
    b.append(tb);
    kv(b, [[t('flTradeBasis'), `M${ft.mach} · ${ft.cruiseDist}nm`], [t('windProg'), model.windProg || null]]);
    b.append(el('div', 'note warn-note', t('flTradeNote')));
  });
}

function timelineCard() {
  const m = model;
  if (!m.etdDate) return null;
  return briefCard('timeline', t('cardTimeline'), (b) => {
    const rows = [];
    rows.push([t('tlEtd'), m.etdDate, m.dep?.tzMin, m.depIcao]);
    const toc = m.navlog?.find((r) => r.point === 'TOC');
    if (toc?.accMin != null) rows.push([t('tlToc'), new Date(m.etdDate.getTime() + toc.accMin * 60000), null, null]);
    (m.eet || []).forEach((e) => rows.push([`${t('tlFir')} ${e.fir}`, new Date(m.etdDate.getTime() + e.min * 60000), null, null]));
    const tod = m.navlog?.find((r) => r.point === 'TOD');
    if (tod?.accMin != null) rows.push([t('tlTod'), new Date(m.etdDate.getTime() + tod.accMin * 60000), null, null]);
    if (m.etaDate) rows.push([t('tlEta'), m.etaDate, m.dest?.tzMin, m.destIcao]);
    const tb = el('table', 'data-table tl-table');
    rows.sort((a, b2) => a[1] - b2[1]).forEach(([label, date, off, ap]) => {
      const tr = el('tr');
      tr.append(el('td', null, label + (ap ? ` · ${ap}` : '')), el('td', 'num', fmtDayTime(date, off)));
      tb.append(tr);
    });
    b.append(tb);
    // 도착 시 주/야 판정 (목적지 좌표: METAR 응답 사용)
    const dm = wxCache.mMap[m.destIcao];
    if (dm?.lat != null && m.etaDate) {
      const s = sunTimes(m.etaDate, dm.lat, dm.lon);
      if (s) {
        const night = m.etaDate < s.rise || m.etaDate > s.set;
        b.append(el('div', 'note', `${night ? '🌙 ' + t('tlNight') : '☀️ ' + t('tlDay')} — ${t('sunrise')} ${fmtTime(s.rise, m.dest?.tzMin)} · ${t('sunset')} ${fmtTime(s.set, m.dest?.tzMin)}`));
      }
    }
  });
}

function altnCard() {
  if (!model.altnSummary?.length) return null;
  return briefCard('altn', t('cardAltn'), (b) => {
    const tb = el('table', 'data-table');
    const thead = el('tr');
    ['ALTN', t('altnRwy'), t('altnDist'), t('altnFl'), t('altnTime'), t('compCol'), t('altnFuel'), t('altnRte')].forEach((h) => thead.append(el('th', null, h)));
    tb.append(thead);
    model.altnSummary.forEach((a) => {
      const tr = el('tr');
      tr.append(el('td', null, a.icao), el('td', null, a.rwy), el('td', 'num', a.dist + 'nm'), el('td', 'num', 'FL' + a.fl),
        el('td', 'num', hm(a.time)), el('td', 'num', (a.comp >= 0 ? '+' : '') + a.comp + 'kt'), el('td', 'num', p100lbs(a.fuel)), el('td', 'rte', a.rte));
      tb.append(tr);
    });
    b.append(tb);
  });
}

function rawCard(rawText) {
  return briefCard('raw', t('cardRaw'), (b) => {
    b.append(el('div', 'note', t('rawHint')));
    const pre = el('pre', 'ofp-raw', rawText);
    b.append(pre);
  });
}

function cardSettingsRow() {
  const row = el('div', 'card-toggles');
  row.append(el('span', 'sect-title', t('cards')));
  CARD_IDS.forEach((id) => {
    const btn = el('button', 'chip' + (cardVisible(id) ? ' chip-on' : ''), t('card' + id[0].toUpperCase() + id.slice(1)));
    btn.onclick = () => { store.set('sw_card_' + id, cardVisible(id) ? '0' : '1'); render(); };
    row.append(btn);
  });
  return row;
}

function flightView(container) {
  const rawText = store.get('sw_ofp_text', '');
  if (!rawText) {
    const box = el('div', 'paste-box');
    box.append(el('h2', null, t('pasteTitle')));
    box.append(el('p', 'sub-line', t('pasteHint')));
    const ta = el('textarea', 'ofp-input');
    ta.placeholder = 'OFP ...';
    const btn = el('button', 'primary', t('buildBrief'));
    const err = el('div', 'err');
    btn.onclick = () => {
      const parsed = parseOFP(ta.value || '');
      if (!parsed.ok) { err.textContent = t('parseFail'); return; }
      store.set('sw_ofp_text', ta.value);
      model = null;
      render();
      refreshWx();
    };
    box.append(ta, btn, err);
    container.append(box);
    return;
  }
  if (!model) {
    model = parseOFP(rawText);
    model._flTrade = flTrade(model);
  }
  const actions = el('div', 'flight-actions');
  const bNew = el('button', 'chip', t('newOfp'));
  bNew.onclick = () => { store.del('sw_ofp_text'); model = null; render(); };
  actions.append(bNew);
  container.append(actions);
  [summaryCard(), fuelCard(), wxCardsWrap(), flTradeCard(), timelineCard(), altnCard(), rawCard(rawText)]
    .filter(Boolean).forEach((c) => container.append(c));
  container.append(cardSettingsRow());
}

function airportsView(container) {
  const wrap = el('div', 'cards');
  getList().forEach((icao) => wrap.append(airportCard(icao, { removable: true })));
  container.append(wrap);
  const form = el('form', 'add-form');
  const inp = el('input');
  inp.maxLength = 4; inp.placeholder = t('addAirport'); inp.spellcheck = false;
  const btn = el('button', 'primary', t('add'));
  form.onsubmit = (ev) => { ev.preventDefault(); if (addAirport(inp.value)) { inp.value = ''; refreshWx(); } };
  form.append(inp, btn);
  container.append(form);
}

// ── 데이터 로딩/렌더 ──────────────────────────────────────
function neededIcaos() {
  const set = new Set(getList());
  if (model?.ok) [model.depIcao, model.destIcao, ...(model.altn || [])].filter(Boolean).forEach((i) => set.add(i));
  else {
    const rawText = store.get('sw_ofp_text', '');
    if (rawText) { const m = parseOFP(rawText); [m.depIcao, m.destIcao, ...(m.altn || [])].filter(Boolean).forEach((i) => set.add(i)); }
  }
  return [...set];
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
  $('#appTitle').textContent = t('appTitle');
  $('#tagline').textContent = t('tagline');
  $('#disclaimer').textContent = t('disclaimer');
  $('#btnLang').textContent = t('lang');
  $('#btnTime').textContent = timePref();
  $('#tabFlight').textContent = t('tabFlight');
  $('#tabAirports').textContent = t('tabAirports');
}

function render() {
  applyStaticText();
  const tab = store.get('sw_tab', 'flight');
  $('#tabFlight').classList.toggle('tab-on', tab === 'flight');
  $('#tabAirports').classList.toggle('tab-on', tab !== 'flight');
  const main = $('#view');
  main.replaceChildren();
  if (tab === 'flight') flightView(main);
  else airportsView(main);
}

function initControls() {
  $('#btnRefresh').onclick = refreshWx;
  $('#btnTheme').onclick = () => {
    const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    document.body.dataset.theme = next;
    store.set('sw_theme', next);
  };
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
