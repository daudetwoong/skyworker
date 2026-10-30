// OFP 텍스트 파서 — OZ(APMS/Lido) 1차 + ICAO FPL 블록 범용 폴백. 원문은 기기 밖으로 나가지 않는다(R4)
const MONTHS = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };

function hmToMin(hm) { const m = String(hm || '').match(/(\d{1,2})[.:](\d{2})/); return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null; }
function pm(v) { if (!v) return null; const s = v[0] === 'M' ? -1 : 1; return s * parseInt(v.slice(1), 10); }

function parseFplBlock(text) {
  const m = text.match(/\(FPL-([A-Z]{2,3}\d{1,4})-[A-Z]{2}\s*\n?([\s\S]*?)\)/);
  if (!m) return null;
  const body = m[2];
  const out = { callsign: m[1] };
  const dep = body.match(/^-([A-Z]{4})(\d{4})$/m) || body.match(/-([A-Z]{4})(\d{4})\n/);
  if (dep) { out.dep = dep[1]; out.eobt = dep[2]; }
  const typ = body.match(/^-([A-Z0-9]{2,4})\/[HML]-/m);
  if (typ) out.actype = typ[1];
  // 목적지/EET/교체: "-RKSI0130 RKSS" 꼴
  const dst = body.match(/^-([A-Z]{4})(\d{4})\s+([A-Z]{4})(?:\s+([A-Z]{4}))?/m);
  if (dst) { out.dest = dst[1]; out.eetTotal = dst[2]; out.altn = [dst[3], dst[4]].filter(Boolean); }
  // 순항 속도/고도 (마지막 변경치 우선): N0451F310, K0844S0950
  const lvls = [...body.matchAll(/[NMK](\d{4})([FS])(\d{3,4})/g)];
  if (lvls.length) {
    const last = lvls[lvls.length - 1];
    out.plannedFL = last[2] === 'F' ? parseInt(last[3], 10) : Math.round(parseInt(last[3], 10) * 10 * 3.28084 / 100);
  }
  const route = body.match(/-[KMN]\d{4}[FS]\d{3,4}\s+([\s\S]*?)\n-[A-Z]{4}\d{4}/);
  if (route) out.route = route[1].replace(/\s+/g, ' ').trim();
  const eet = body.match(/EET\/((?:[A-Z]{4}\d{4}\s*)+)/);
  if (eet) out.eet = [...eet[1].matchAll(/([A-Z]{4})(\d{2})(\d{2})/g)].map((x) => ({ fir: x[1], min: parseInt(x[2], 10) * 60 + parseInt(x[3], 10) }));
  const reg = body.match(/REG\/([A-Z0-9]+)/);
  if (reg) out.reg = reg[1];
  return out;
}

function parseNavlog(lines) {
  const rows = [];
  for (let i = 0; i < lines.length - 1; i++) {
    const m1 = lines[i].match(/^\s*(\d{1,3})\s+(-?[A-Z][A-Z0-9]{1,6})\s+(CL|DSC|\d{3})\s+(\d{1,3})\s+[NS]\d{2,3}\s/);
    if (!m1) continue;
    const t1 = lines[i].trim().split(/\s+/);
    const t2 = lines[i + 1].trim().split(/\s+/);
    if (!/^\d{3}$/.test(t2[0] || '')) continue; // 2행(MORA TC ...)이 아니면 스킵
    const windTok = t1.find((x) => /^\d{2}\/\d{3}$/.test(x));
    const compTok = t1.find((x) => /^[PM]\d{3}$/.test(x));
    const ztTok = [...t1].reverse().find((x) => /^\d{1,3}\/\d{2}\.\d{2}$/.test(x));
    let tas = null;
    if (compTok) {
      const after = t1.slice(t1.indexOf(compTok) + 1).filter((x) => /^\d{3}$/.test(x));
      if (after.length) tas = parseInt(after[after.length - 1], 10); // SR(2자리)과 구분: 3자리만, 마지막
    }
    const gsCand = t2.filter((x) => /^\d{3}$/.test(x));
    rows.push({
      dist: parseInt(m1[1], 10),
      point: m1[2],
      fl: /^\d{3}$/.test(m1[3]) ? parseInt(m1[3], 10) : m1[3],
      mc: parseInt(m1[4], 10),
      tc: gsCand.length > 1 ? parseInt(gsCand[1], 10) : null,  // t2: [MORA, TC, ...]
      gs: gsCand.length > 2 ? parseInt(gsCand[gsCand.length - 1], 10) : null,
      wind: windTok ? { dir: parseInt(windTok.slice(0, 2), 10) * 10, spd: parseInt(windTok.slice(3), 10) } : null,
      comp: pm(compTok),
      tas,
      accMin: ztTok ? hmToMin(ztTok.split('/')[1]) : null,
      fir: m1[2].startsWith('-') ? m1[2].slice(1) : null,
    });
  }
  return rows;
}

function parseWindMatrix(text) {
  const idx = text.indexOf('UPPER WIND/TEMP DATA');
  if (idx < 0) return null;
  const seg = text.slice(idx, idx + 4000).split('\n');
  const out = { levels: [], rows: [], clb: null, dsc: null };
  const entryRe = /(\d{3})(\d{2})([MP])(\d{2})/g;
  const decode = (s) => [...s.matchAll(entryRe)].map((e) => ({
    dir: parseInt(e[1], 10) || 360, spd: parseInt(e[2], 10), temp: (e[3] === 'M' ? -1 : 1) * parseInt(e[4], 10),
  }));
  for (const line of seg) {
    const lv = [...line.matchAll(/\((\d{4,5})\)/g)];
    if (lv.length >= 2) { out.levels = lv.map((x) => parseInt(x[1], 10)); continue; }
    const row = line.match(/^\s*([A-Z][A-Z0-9]{1,6}|TOC|TOD)\s+((?:\d{5}[MP]\d{2}\s*)+)$/);
    if (row && out.levels.length) {
      const winds = decode(row[2]);
      if (winds.length === out.levels.length) {
        if (row[1] === 'CLB') out.clb = winds;
        else if (row[1] === 'DSC') out.dsc = winds;
        else out.rows.push({ point: row[1], winds });
      }
    }
    if (out.rows.length && /^\s*$/.test(line) && out.rows.length > 3) { /* 섹션 끝 근처 */ }
    if (line.includes('ATC Flight Plan')) break;
  }
  return out.rows.length ? out : null;
}

export function parseOFP(raw) {
  const text = raw.replace(/\r/g, '');
  const fpl = parseFplBlock(text);
  const model = { ok: false, src: 'NONE', fpl, warnings: [] };

  // ── 헤더 ──
  let head = null;
  for (const h of text.matchAll(/\b([A-Z]{2,3}\d{1,4})\s+(\d{2})\/([A-Z]{3})\/(\d{4})\s+([A-Z0-9]{5,7})\s+([A-Z0-9][A-Z0-9\-]{2,})/g)) {
    if (/^[A-Z]-?\d/.test(h[6])) { head = h; break; }   // 기종은 글자+숫자 꼴(A321-251NX, B789)만 인정
    if (!head) head = h;
  }
  const leg = text.match(/\b([A-Z]{2}\d{1,4})\s+([A-Z]{4})\/([A-Z]{4})\s+\d{2}\/[A-Z]{3}\/\d{4}/);
  if (head) {
    model.callsign = head[1];
    model.date = new Date(Date.UTC(parseInt(head[4], 10), MONTHS[head[3]] ?? 0, parseInt(head[2], 10)));
    model.reg = head[5];
    model.actype = head[6];
  }
  if (leg) { model.fltNo = leg[1]; model.depIcao = leg[2]; model.destIcao = leg[3]; }

  const ci = text.match(/SPD:\s*CI(\d+)/); if (ci) model.ci = parseInt(ci[1], 10);
  const wt = text.match(/WIND\/TEMP\s+([PM]\d{3})\/([PM]\d{2})/); if (wt) { model.avgComp = pm(wt[1]); model.avgTemp = pm(wt[2]); }
  const di = text.match(/DIST\s+(\d{2,5})\/(\d{2,5})/); if (di) model.dist = { air: parseInt(di[1], 10), gnd: parseInt(di[2], 10) };

  // ── 출발/도착 (로컬 오프셋 포함) ──
  const dep = text.match(/^([A-Z]{3})\/([A-Z]{4})\s+([PM])(\d{2})(\d{2})\s*:\s*STD\/\s*(\d{1,2}[.:]\d{2})Z?\s+ETD\/\s*(\d{1,2}[.:]\d{2})/m);
  const arr = text.match(/^([A-Z]{3})\/([A-Z]{4})\s+([PM])(\d{2})(\d{2})\s*:\s*STA\/\s*(\d{1,2}[.:]\d{2})Z?\s+ETA\/\s*(\d{1,2}[.:]\d{2})/m);
  if (dep) model.dep = { iata: dep[1], icao: dep[2], tzMin: (dep[3] === 'M' ? -1 : 1) * (parseInt(dep[4], 10) * 60 + parseInt(dep[5], 10)), std: dep[6], etd: dep[7] };
  if (arr) model.dest = { iata: arr[1], icao: arr[2], tzMin: (arr[3] === 'M' ? -1 : 1) * (parseInt(arr[4], 10) * 60 + parseInt(arr[5], 10)), sta: arr[6], eta: arr[7] };

  // ── 연료 (100LBS 단위) ──
  const fuel = {};
  const fr = (name, re) => { const m = text.match(re); if (m) fuel[name] = { v: parseInt(m[1], 10), time: m[2] || null, extra: m[3] || null }; };
  fr('trip', /^TRIP\s+(\d{3,5})\s+(\d{1,2}\.\d{2})/m);
  fr('cont', /^CONT\s+(\d{3,5})\s+(\d{1,2}\.\d{2})/m);
  const am = text.match(/^ALTN\/([A-Z]{4})\s+(\d{3,5})\s+(\d{1,2}\.\d{2})/m);
  if (am) { fuel.altn = { v: parseInt(am[2], 10), time: am[3] }; model.altnIcao = am[1]; }
  fr('frsv', /^F-RSV\s+(\d{3,5})\s+(\d{1,2}\.\d{2})/m);
  fr('rqrd', /^RQRD\s+(\d{3,5})\s+(\d{1,2}\.\d{2})/m);
  fr('extra', /^EXTRA\s+(\d{3,5})\s+(\d{1,2}\.\d{2})(?:\s+RSN\/(\S+))?/m);
  fr('tkof', /^TKOF\s+(\d{3,5})\s+(\d{1,2}\.\d{2})/m);
  const tx = text.match(/^TAXI\s+(\d{3,5})/m); if (tx) fuel.taxi = { v: parseInt(tx[1], 10) };
  fr('ramp', /^RAMP\s+(\d{3,5})\s+(\d{1,2}\.\d{2})/m);
  if (Object.keys(fuel).length) model.fuel = fuel;
  const w = {};
  for (const [k, re] of [['tow', /\bTOW\s+(\d{4,5})/], ['ldw', /\bLDW\s+(\d{4,5})/], ['zfw', /\bZFW\s+(\d{4,5})/], ['agtow', /AGTOW\s+(\d{4,5})/]]) {
    const m = text.match(re); if (m) w[k] = parseInt(m[1], 10);
  }
  if (Object.keys(w).length) model.weights = w;

  // ── 디스패처 비고 ──
  const dr = text.match(/DISP REMARK:\s*\n([\s\S]*?)\n\s*-{6,}/);
  if (dr) model.remarks = dr[1].split('\n').map((s) => s.replace(/^\s*\*?\s*/, '').trim()).filter(Boolean);

  // ── ALTN SUMMARY ──
  const asIdx = text.indexOf('ALTN SUMMARY:');
  if (asIdx >= 0) {
    model.altnSummary = [];
    for (const line of text.slice(asIdx, asIdx + 800).split('\n').slice(1)) {
      const m = line.match(/^\s*([A-Z]{4})\/(\S+)\s+(\d+)\s+(\d+)\s+(\d{1,2}\.\d{2})\s+([PM]\d{1,3})\s+(\d+)\s+(.+?)\s*$/);
      if (m) model.altnSummary.push({ icao: m[1], rwy: m[2], dist: parseInt(m[3], 10), fl: parseInt(m[4], 10), time: m[5], comp: pm(m[6]), fuel: parseInt(m[7], 10), rte: m[8] });
      else if (model.altnSummary.length) break;
    }
  }

  model.navlog = parseNavlog(text.split('\n'));
  model.windMatrix = parseWindMatrix(text);
  const prog = text.match(/UPPER WIND\/TEMP DATA:\s*PROG\s+([\d\s]+)/); if (prog) model.windProg = prog[1].trim();

  // ── 폴백 보강 (FPL 블록) ──
  if (fpl) {
    model.callsign = model.callsign || fpl.callsign;
    model.depIcao = model.depIcao || fpl.dep;
    model.destIcao = model.destIcao || fpl.dest;
    model.actype = model.actype || fpl.actype;
    model.reg = model.reg || fpl.reg;
    model.altn = fpl.altn || (model.altnIcao ? [model.altnIcao] : []);
    model.plannedFL = fpl.plannedFL || null;
    model.route = fpl.route || null;
    model.eet = fpl.eet || null;
    model.eetTotal = fpl.eetTotal ? hmToMin(fpl.eetTotal.slice(0, 2) + '.' + fpl.eetTotal.slice(2)) : null;
  }
  if (!model.plannedFL && model.navlog?.length) {
    const fls = model.navlog.filter((r) => typeof r.fl === 'number').map((r) => r.fl);
    if (fls.length) model.plannedFL = Math.round(fls.sort((a, b) => a - b)[Math.floor(fls.length / 2)] / 10) * 10;
  }

  // ── 시각 Date 합성 ──
  if (model.date && model.dep?.etd) {
    const [h, mi] = model.dep.etd.split(/[.:]/).map(Number);
    model.etdDate = new Date(model.date.getTime() + (h * 60 + mi) * 60000);
    if (model.dest?.eta) {
      const [h2, m2] = model.dest.eta.split(/[.:]/).map(Number);
      let eta = new Date(model.date.getTime() + (h2 * 60 + m2) * 60000);
      if (eta < model.etdDate) eta = new Date(eta.getTime() + 86400000);
      model.etaDate = eta;
    }
  }

  // ── 판정 ──
  if (model.depIcao && model.destIcao && (model.fuel || model.navlog?.length)) { model.ok = true; model.src = 'OZ-APMS'; }
  else if (fpl && fpl.dep && fpl.dest) { model.ok = true; model.src = 'ICAO-FPL'; model.warnings.push('generic'); }
  if (model.ok && !model.windMatrix) model.warnings.push('noWindMatrix');
  if (model.ok && !model.navlog?.length) model.warnings.push('noNavlog');
  return model;
}
