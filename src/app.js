// 메인 앱 — 공항 카드 렌더링, 새로고침, 설정(공항 추가/삭제·테마·언어), 오프라인 스냅샷
import { t, setLang, lang } from './i18n.js';
import { getList, addAirport, removeAirport, airportInfo, saveUserRwys } from './airports.js';
import { fetchWx, renderMetarLines, renderTafPeriods, fltCatInfo } from './wx.js';
import { runwayWind } from './wind.js';
import { sunTimes, fmtUtcKst } from './sun.js';

const $ = (sel) => document.querySelector(sel);
const SNAP_KEY = 'ft_snapshot';

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function loadSnapshot() { try { return JSON.parse(localStorage.getItem(SNAP_KEY) || 'null'); } catch { return null; } }
function saveSnapshot(data) { try { localStorage.setItem(SNAP_KEY, JSON.stringify(data)); } catch {} }

function applyStaticText() {
  $('#appTitle').textContent = t('appTitle');
  $('#tagline').textContent = t('tagline');
  $('#disclaimer').textContent = t('disclaimer');
  $('#addInput').placeholder = t('addAirport');
  $('#addBtn').textContent = t('add');
  $('#btnLang').textContent = t('lang');
}

function renderCard(icao, metar, taf, fetchedAt, stale) {
  const info = airportInfo(icao, metar);
  const card = el('div', 'card');

  const head = el('div', 'card-head');
  head.append(el('span', 'icao', icao), el('span', 'apt-name', info.name));
  if (metar?.fltCat) {
    const fc = fltCatInfo(metar.fltCat);
    const chip = el('span', 'fltcat', fc.label);
    chip.style.background = fc.color;
    head.append(chip);
  }
  const rm = el('button', 'btn-remove', '✕');
  rm.title = t('remove');
  rm.onclick = () => { removeAirport(icao); card.remove(); };
  head.append(rm);
  card.append(head);

  if (!metar) {
    card.append(el('div', 'err', t('loadError')));
    return card;
  }

  // METAR
  const mSect = el('div', 'sect');
  const mTitle = el('div', 'sect-title', t('metar'));
  if (fetchedAt) mTitle.append(el('span', 'updated', ` · ${t('updated')} ${new Date(fetchedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}${stale ? ' ⚠︎' : ''}`));
  mSect.append(mTitle);
  const lines = el('div', 'lines');
  renderMetarLines(metar).forEach((l) => lines.append(el('div', null, l)));
  mSect.append(lines);
  const raw = el('div', 'raw', metar.rawOb);
  raw.title = 'tap to copy';
  raw.onclick = () => navigator.clipboard?.writeText(metar.rawOb);
  mSect.append(raw);
  card.append(mSect);

  // 활주로 바람
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
    } else {
      wSect.append(el('div', 'sun-line', metar.wspd ? t('variable') : t('calm')));
    }
  } else {
    wSect.append(el('div', 'sun-line', t('noRunwayData')));
    const form = el('div', 'rwy-input');
    const inp = el('input');
    inp.placeholder = '15,33';
    const btn = el('button', null, t('saveRunways'));
    btn.onclick = () => {
      const rwys = inp.value.split(',').map((s) => s.trim().toUpperCase()).filter((s) => /^\d{2}[LRC]?$/.test(s));
      if (rwys.length) { saveUserRwys(icao, rwys); refresh(); }
    };
    form.append(inp, btn);
    wSect.append(form);
  }
  card.append(wSect);

  // TAF
  const tSect = el('div', 'sect');
  tSect.append(el('div', 'sect-title', t('taf')));
  const periods = renderTafPeriods(taf);
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
  } else {
    tSect.append(el('div', 'sun-line', t('noTaf')));
  }
  card.append(tSect);

  // 일출·일몰
  if (info.lat != null) {
    const s = sunTimes(new Date(), info.lat, info.lon);
    if (s) {
      const sSect = el('div', 'sect');
      sSect.append(el('div', 'sect-title', t('sun')));
      sSect.append(el('div', 'sun-line', `${t('sunrise')} ${fmtUtcKst(s.rise)} · ${t('sunset')} ${fmtUtcKst(s.set)}`));
      card.append(sSect);
    }
  }
  return card;
}

async function refresh() {
  const list = getList();
  const cards = $('#cards');
  const offline = $('#offlineNote');
  if (!list.length) { cards.replaceChildren(); return; }
  try {
    const [metars, tafs] = await Promise.all([fetchWx('metar', list), fetchWx('taf', list)]);
    const mMap = {}, tMap = {};
    (metars || []).forEach((m) => { mMap[m.icaoId] = m; });
    (tafs || []).forEach((f) => { tMap[f.icaoId] = f; });
    const fetchedAt = Date.now();
    saveSnapshot({ fetchedAt, mMap, tMap, list });
    offline.hidden = true;
    cards.replaceChildren(...list.map((icao) => renderCard(icao, mMap[icao], tMap[icao], fetchedAt, false)));
  } catch (e) {
    const snap = loadSnapshot();
    if (snap) {
      offline.textContent = `${t('offlineNote')} (${new Date(snap.fetchedAt).toLocaleString('ko-KR')})`;
      offline.hidden = false;
      cards.replaceChildren(...list.map((icao) => renderCard(icao, snap.mMap[icao], snap.tMap[icao], snap.fetchedAt, true)));
    } else {
      cards.replaceChildren(el('div', 'err', `${t('loadError')}: ${e.message}`));
    }
  }
}

function initControls() {
  $('#btnRefresh').onclick = refresh;
  $('#btnTheme').onclick = () => {
    const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    document.body.dataset.theme = next;
    try { localStorage.setItem('ft_theme', next); } catch {}
  };
  $('#btnLang').onclick = () => {
    setLang(lang === 'ko' ? 'en' : 'ko');
    try { localStorage.setItem('ft_lang', lang); } catch {}
    applyStaticText();
    refresh();
  };
  $('#addForm').onsubmit = (ev) => {
    ev.preventDefault();
    const icao = addAirport($('#addInput').value);
    if (icao) { $('#addInput').value = ''; refresh(); }
  };
}

(function main() {
  try {
    document.body.dataset.theme = localStorage.getItem('ft_theme') || 'dark';
    setLang(localStorage.getItem('ft_lang') || 'ko');
  } catch {}
  applyStaticText();
  initControls();
  refresh();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
