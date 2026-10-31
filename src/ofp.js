// OFP 텍스트 파서 — OZ(APMS/Lido) 1차 + ICAO FPL 블록 범용 폴백. 원문은 기기 밖으로 나가지 않는다(R4)
const MONTHS = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };

function hmToMin(hm) { const m = String(hm || '').match(/(\d{1,2})[.:](\d{2})/); return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null; }
function pm(v) { if (!v) return null; const s = v[0] === 'M' ? -1 : 1; return s * parseInt(v.slice(1), 10); }

function parseFplBlock(text) {
  // 중첩 괄호(STS/..., RMK(...) 등) 대응: 균형 스캔으로 블록 경계 탐지
  const start = text.search(/\(FPL-[A-Z]{2,3}\d{1,4}-[A-Z]{2}/);
  if (start < 0) return null;
  let depth = 0, end = -1;
  for (let i = start; i < text.length && i < start + 4000; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) return null;
  const block = text.slice(start, end + 1);
  const cs = block.match(/^\(FPL-([A-Z]{2,3}\d{1,4})-/);
  const body = block.slice(block.indexOf('\n') + 1 || 5, -1);
  const out = { callsign: cs[1] };
  // 출발/목적지 줄은 같은 꼴(-ICAO+4자리) — 첫 매치=출발, 마지막 매치=목적지(+교체들)
  const legLines = [...body.matchAll(/^-([A-Z]{4})(\d{4})((?:\s+[A-Z]{4})*)\s*$/gm)];
  if (legLines.length) { out.dep = legLines[0][1]; out.eobt = legLines[0][2]; }
  const typ = body.match(/^-([A-Z0-9]{2,4})\/[HML]-/m);
  if (typ) out.actype = typ[1];
  if (legLines.length >= 2) {
    const dst = legLines[legLines.length - 1];
    out.dest = dst[1]; out.eetTotal = dst[2];
    out.altn = dst[3].trim().split(/\s+/).filter((x) => /^[A-Z]{4}$/.test(x));
  }
  // 순항 속도/고도 (마지막 변경치 우선): N0451F310, M082F350, K0844S0950
  const lvls = [...body.matchAll(/(?:[NK]\d{4}|M\d{3})([FS])(\d{3,4})/g)];
  if (lvls.length) {
    const last = lvls[lvls.length - 1];
    out.plannedFL = last[1] === 'F' ? parseInt(last[2], 10) : Math.round(parseInt(last[2], 10) * 10 * 3.28084 / 100);
  }
  const route = body.match(/-(?:[NK]\d{4}|M\d{3})[FS]\d{3,4}\s+([\s\S]*?)\n-[A-Z]{4}\d{4}/);
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
    // 도착 공항 행: "ZBAA   TAXI   N040 04.4   0114   21/01.35" + "103 ELEV 0084FT   E116 35.9   007/0094"
    const d1 = lines[i].match(/^([A-Z]{4})\s+TAXI\s+([NS])(\d{2,3})\s(\d{1,2}\.\d)\s.*?\s(\d{1,3})\/(\d{1,2}\.\d{2})\s*$/);
    const d2 = d1 && lines[i + 1].match(/^\s*(\d{1,4})\s+ELEV\b.*?([EW])(\d{2,3})\s(\d{1,2}\.\d).*?\s(\d{1,3})\/(\d{3,4})\s*$/);
    if (d1 && d2) {
      rows.push({ lat: (d1[2] === 'S' ? -1 : 1) * (+d1[3] + parseFloat(d1[4]) / 60), lon: (d2[2] === 'W' ? -1 : 1) * (+d2[3] + parseFloat(d2[4]) / 60), sr: null, dist: +d2[1], point: d1[1], fl: 'DSC', mc: null, tc: null, gs: null, wind: null, comp: null, tas: null, accMin: hmToMin(d1[6]), accFuel: +d2[6], fir: null });
      i += 1; continue;
    }
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
    const la = lines[i].match(/([NS])(\d{2,3})\s(\d{1,2}\.\d)/);
    const lo = lines[i + 1].match(/([EW])(\d{2,3})\s(\d{1,2}\.\d)/);
    let sr = null;
    if (compTok) { const nx = t1[t1.indexOf(compTok) + 1]; if (/^\d{1,2}$/.test(nx || '')) sr = parseInt(nx, 10); }
    rows.push({
      lat: la ? (la[1] === 'S' ? -1 : 1) * (parseInt(la[2], 10) + parseFloat(la[3]) / 60) : null,
      lon: lo ? (lo[1] === 'W' ? -1 : 1) * (parseInt(lo[2], 10) + parseFloat(lo[3]) / 60) : null,
      sr,
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
      accFuel: (() => { const f = [...t2].reverse().find((x) => /^\d{1,3}\/\d{3,4}$/.test(x)); return f ? parseInt(f.split('/')[1], 10) : null; })(),
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


// ── CFP 포맷 (FLIGHT RELEASE ... / 3줄 항법로그 / FL행 바람매트릭스) ──
function parseCfpNavlog(lines) {
  const rows = [];
  for (let i = 0; i < lines.length - 2; i++) {
    const l1 = lines[i], l2 = lines[i + 1];
    if (!/^\s*\d{4}\s+[NS]\d{2}/.test(l1)) continue;
    const t1 = l1.trim().split(/\s+/);
    const m2 = l2.trim().match(/^([A-Z0-9]{2,7})\s+[EW]\d{2,3}\s/);
    if (!m2) continue;
    const t2 = l2.trim().split(/\s+/);
    // line1: dist N.. ..  MC FL ETO/MSA RF OT WIND SR TAS ZT BO
    const fl = t1[4];
    let wind = null, comp = null, tas = null, sr = null;
    for (let k = 5; k < t1.length; k++) {
      const w = t1[k].match(/^(\d{3})(\d{2})([PM])(\d{3})$/);
      let next = k + 1;
      if (w) { wind = { dir: +w[1] || 360, spd: +w[2] }; comp = (w[3] === 'M' ? -1 : 1) * +w[4]; }
      else if (/^\d{5}$/.test(t1[k]) && /^[+-]?\d{3}$/.test(t1[k + 1] || '') && k > 6) {
        wind = { dir: +t1[k].slice(0, 3) || 360, spd: +t1[k].slice(3) }; comp = parseInt(t1[k + 1], 10); next = k + 2;
      }
      if (wind) {
        if (/^\d{1,2}$/.test(t1[next] || '')) sr = +t1[next];
        const after = t1.slice(next).filter((x) => /^\d{3}$/.test(x));
        if (after.length) tas = +after[0] >= 250 ? +after[0] : (+after[1] >= 250 ? +after[1] : null);
        break;
      }
    }
    const la = l1.match(/([NS])(\d{2})\s(\d{1,2}\.\d)/);
    const lo = l2.match(/([EW])(\d{2,3})\s(\d{1,2}\.\d)/);
    const firM = (lines[i + 2] || '').match(/^\s*\/\s*([A-Z]{4})\s+FIR/);
    const accTok = [...t2].reverse().find((x) => /^\d{2}\.\d{2}$/.test(x));
    const gsIdx = accTok ? t2.indexOf(accTok) - 1 : -1;
    const l3 = (lines[i + 2] || '').trim().split(/\s+/);
    const tcTok = firM ? (l3.find((x, ix) => ix > 2 && /^\d{3}$/.test(x)) || null) : l3[0];
    rows.push({
      lat: la ? (la[1] === 'S' ? -1 : 1) * (+la[2] + parseFloat(la[3]) / 60) : null,
      lon: lo ? (lo[1] === 'W' ? -1 : 1) * (+lo[2] + parseFloat(lo[3]) / 60) : null,
      sr,
      dist: +t1[0],
      point: m2[1],
      fl: /^\d{3}$/.test(fl) ? +fl : fl,
      mc: +t1[3] || null,
      tc: /^\d{3}$/.test(tcTok || '') ? +tcTok : null,
      gs: gsIdx >= 0 && /^\d{3}$/.test(t2[gsIdx] || '') ? +t2[gsIdx] : null,
      wind, comp, tas,
      accMin: accTok ? hmToMin(accTok) : null,
      accFuel: (() => { const f = [...t2].reverse().find((x) => /^\d{3,4}\/$/.test(x)); return f ? parseInt(f, 10) : null; })(),
      fir: firM ? firM[1] : null,
    });
    i += 1;
  }
  return rows;
}

function parseCfpMatrix(lines) {
  // FL행 블록(351 -55 01021-017-36 ...) 4열 + 아래 웨이포인트 이름줄
  const byPoint = new Map(); // name -> {fl: {dir,spd,comp,temp}}
  const levels = new Set();
  let pending = []; // [{fl, entries:[{...}x4]}]
  const entryRe = /(\d{3})(\d{2})([+\-])(\d{3})([+\-])(\d{2})/g;
  for (const line of lines) {
    const row = line.match(/^\s*(\d{3})\s+(-?\d{1,3})\s+((?:\d{5}[+\-]\d{3}[+\-]\d{2}\s*)+)$/);
    if (row) {
      const entries = [...row[3].matchAll(entryRe)].map((e) => ({
        dir: +e[1] || 360, spd: +e[2], comp: (e[3] === '-' ? -1 : 1) * +e[4], temp: (e[5] === '-' ? -1 : 1) * +e[6],
      }));
      pending.push({ fl: +row[1], entries });
      levels.add(+row[1]);
      continue;
    }
    const names = line.match(/^\s{6,}([A-Z][A-Z0-9]{1,6}(?:\s+[A-Z][A-Z0-9]{1,6}){0,3})\s*$/);
    if (names && pending.length) {
      const ns = names[1].trim().split(/\s+/);
      for (const p of pending) {
        p.entries.forEach((e, ci) => {
          const n = ns[ci];
          if (!n) return;
          if (!byPoint.has(n)) byPoint.set(n, {});
          byPoint.get(n)[p.fl] = e;
        });
      }
      pending = [];
      continue;
    }
    if (pending.length && /[a-z]/.test(line)) pending = [];
  }
  if (!byPoint.size) return null;
  return { type: 'cfp', levels: [...levels].sort((a, b) => a - b), byPoint };
}

function parseCfp(text, fpl, model) {
  const lines = text.split('\n');
  const rel = text.match(/FLIGHT RELEASE\s+([A-Z]{3}\d{1,4})\s+([A-Z]{4})\/([A-Z]{4})\s+ON\s+(\d{2})\/([A-Z]{3})\/(\d{2})/);
  if (!rel) return false;
  model.src = 'OZ-CFP';
  model.callsign = rel[1];
  model.fltNo = rel[1].replace(/^AAR/, 'OZ').replace(/^KAL/, 'KE');
  model.depIcao = rel[2];
  model.destIcao = rel[3];
  model.date = new Date(Date.UTC(2000 + +rel[6], MONTHS[rel[5]] ?? 0, +rel[4]));
  const reg = text.match(/\b(HL\d{4}|HL7\w{3}|HL8\w{3})\b/); if (reg) model.reg = reg[1];
  const ci = text.match(/CRZ-\s*(\d+)/); if (ci) model.ci = +ci[1];
  const wt = text.match(/AVG WIND\/TEMP[\s\S]{0,120}?([PM]\d{3})\/([PM]\d{2})/); if (wt) { model.avgComp = pm(wt[1]); model.avgTemp = pm(wt[2]); }

  // 시각: ETD ZUTF 1630Z ETA RKSI 1940Z + HRS UTC+0900(도착지 로컬)
  const et = text.match(/ETD\s+([A-Z]{4})\s+(\d{4})Z\s+ETA\s+([A-Z]{4})\s+(\d{4})Z/);
  const tz = text.match(/HRS UTC([+-])(\d{2})(\d{2})/);
  const destTz = tz ? (tz[1] === '-' ? -1 : 1) * (+tz[2] * 60 + +tz[3]) : null;
  if (et) {
    const f = (s) => s.slice(0, 2) + '.' + s.slice(2);
    model.dep = { icao: et[1], iata: null, tzMin: null, std: f(et[2]), etd: f(et[2]) };
    model.dest = { icao: et[3], iata: null, tzMin: destTz, sta: f(et[4]), eta: f(et[4]) };
  }

  // 연료 (CFP 라벨 → 공용 키)
  const fuel = {};
  const fr = (name, re) => { const m = text.match(re); if (m) fuel[name] = { v: +m[1], time: m[2] || null, extra: m[3] || null }; };
  const tr = text.match(/^TRIP\s+(\d{3,5})\s+(\d{1,2}\.\d{2})\s+(\d{3,5})\s+(\d{3,5})/m);
  if (tr) { fuel.trip = { v: +tr[1], time: tr[2] }; model.dist = { gnd: +tr[3], air: +tr[4] }; }
  const am = text.match(/^\s*ALTN\/([A-Z]{4})\s+(\d{3,5})\s+(\d{1,2}\.\d{2})/m);
  if (am) { fuel.altn = { v: +am[2], time: am[3] }; model.altnIcao = am[1]; }
  fr('frsv', /^\s*FINAL RES\s+(\d{3,5})\s+(\d{1,2}\.\d{2})/m);
  fr('cont', /^\s*5 PCT CONT\s+(\d{3,5})\s+(\d{1,2}\.\d{2})/m);
  fr('rqrd', /^RQD TAKEOFF\s+(\d{3,5})\s+(\d{1,2}\.\d{2})/m);
  fr('extra', /^DISC\s+(\d{3,5})\s+(\d{1,2}\.\d{2})/m);
  fr('tkof', /^PLN TAKEOFF\s+(\d{3,5})\s+(\d{1,2}\.\d{2})/m);
  const tx = text.match(/^TAXI\s+(\d{3,5})\s*$/m); if (tx) fuel.taxi = { v: +tx[1] };
  fr('ramp', /^RAMP OUT\s+(\d{3,5})\s+(\d{1,2}\.\d{2})/m);
  fr('fod', /^FOD\s+(\d{3,5})\s+(\d{1,2}\.\d{2})/m);
  if (Object.keys(fuel).length) model.fuel = fuel;
  const w = {};
  for (const [k, re] of [['tow', /\bTOW\s+0?(\d{4,5})/], ['ldw', /\bLDW\s+0?(\d{4,5})/], ['zfw', /\bZFW\s+0?(\d{4,5})/], ['agtow', /AGTOW\s+0?(\d{4,5})/]]) {
    const m = text.match(re); if (m) w[k] = +m[1];
  }
  if (Object.keys(w).length) model.weights = w;

  const dsp = text.match(/- DISPATCHER:\s*(\S+)/); if (dsp) model.dispatcher = dsp[1];
  const val = text.match(/PLAN VALID FOR DEPARTURE UNTIL\s+(\d{4}Z \d{2}\/[A-Z]{3}\/\d{2})/); if (val) model.validity = val[1];

  // ALTN 요약: ALTERNATE - 1 RKPC 087 179 0299 280 P000 00.49 5200
  model.altnSummary = [];
  for (const m of text.matchAll(/ALTERNATE\s+-\s+\d\s+([A-Z]{4})\s+(\d{3})\s+(\d{3})\s+(\d{3,4})\s+(\d{3})\s+([PM]\d{3})\s+(\d{1,2}\.\d{2})\s+(\d{3,5})/g)) {
    model.altnSummary.push({ icao: m[1], rwy: '—', dist: +m[4], fl: Math.round(+m[5] / 10) * 10, time: m[7], comp: pm(m[6]), fuel: Math.round(+m[8] / 100), rte: '' });
  }
  const altnRte = text.match(/ROUTE TO ALTN\s*:\s*(.+)/); if (altnRte && model.altnSummary[0]) model.altnSummary[0].rte = altnRte[1].trim();
  model.altnSummary = model.altnSummary.filter((a, i, arr) => arr.findIndex((x) => x.icao === a.icao) === i);
  if (!model.altnSummary.length) delete model.altnSummary;

  model.navlog = parseCfpNavlog(lines);
  model.windMatrix = parseCfpMatrix(lines);

  // 계획 FL = 항법로그 숫자 FL의 최빈값
  const freq = {};
  model.navlog.forEach((r) => { if (typeof r.fl === 'number') freq[r.fl] = (freq[r.fl] || 0) + 1; });
  const best = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
  if (best) model.plannedFL = +best[0];

  if (fpl) {
    model.actype = model.actype || fpl.actype;
    model.altn = fpl.altn?.length ? fpl.altn : (model.altnIcao ? [model.altnIcao] : []);
    model.route = fpl.route || null;
    model.eet = fpl.eet || null;
    model.eetTotal = fpl.eetTotal ? hmToMin(fpl.eetTotal.slice(0, 2) + '.' + fpl.eetTotal.slice(2)) : null;
  }
  if (model.date && model.dep?.etd) {
    const [h, mi] = model.dep.etd.split('.').map(Number);
    model.etdDate = new Date(model.date.getTime() + (h * 60 + mi) * 60000);
    if (model.dest?.eta) {
      const [h2, m2] = model.dest.eta.split('.').map(Number);
      let eta = new Date(model.date.getTime() + (h2 * 60 + m2) * 60000);
      if (eta < model.etdDate) eta = new Date(eta.getTime() + 86400000);
      model.etaDate = eta;
    }
  }
  model.ok = !!(model.depIcao && model.destIcao && model.fuel);
  return model.ok;
}

// ── 국내선 DOM FLT PLAN & RLS SHEET (1장짜리, 1줄 항법로그, 좌표·바람매트릭스 없음, 시각은 L로 표기) ──
function parseDomNavlog(lines) {
  const rows = [];
  for (const line of lines) {
    const t = line.trim().split(/\s+/);
    // dist point awy fl [mora] rem/ zt/acc tif/acc [comp] [eet]
    if (t.length < 7 || !/^\d{1,4}$/.test(t[0]) || !/^[A-Z][A-Z0-9]{1,6}$/.test(t[1]) || !/^(DCT|ARR|-|[A-Z]{1,2}\d{1,4}[A-Z]?)$/.test(t[2])) continue;
    const ri = t.findIndex((x) => /^\d{3,4}\/$/.test(x));
    if (ri < 0 || !/^\d{1,3}\/\d{4}$/.test(t[ri + 1] || '') || !/^\d{1,3}\/\d{4}$/.test(t[ri + 2] || '')) continue;
    if (t[2] === '-') continue; // DEP 행은 제외. ARR 행(도착 공항)은 넣어 누적시간=TRIP 대조에 쓴다
    const acc = t[ri + 1].split('/')[1], mm = +acc.slice(2);
    const comp = t.slice(ri + 3).find((x) => /^[PM]\d{2}$/.test(x));
    rows.push({
      lat: null, lon: null, sr: null, dist: +t[0], point: t[1], awy: t[2],
      fl: /^\d{3}$/.test(t[3]) ? +t[3] : t[3], mc: null, tc: null, gs: null, wind: null,
      comp: comp ? (comp[0] === 'M' ? -1 : 1) * +comp.slice(1) : null, tas: null,
      accMin: mm < 60 ? +acc.slice(0, 2) * 60 + mm : +acc, // ZT/ACTM 누적은 hhmm(0042=42분, 0115=75분). 끝 두 자리 ≥60이면 분 단위로 간주
      accFuel: +t[ri + 2].split('/')[1], fir: null,
    });
  }
  return rows;
}
function parseDom(text, fpl, model) {
  const rel = text.match(/\b([A-Z]{2}\d{1,4})\s+([A-Z]{4})\/([A-Z]{4})\s+(\d{2})\/([A-Z]{3})\/(\d{2})\s+DOM\s+FLT\s+PLAN/);
  if (!rel) return false;
  model.src = 'OZ-DOM';
  model.fltNo = rel[1]; model.depIcao = rel[2]; model.destIcao = rel[3];
  model.date = new Date(Date.UTC(2000 + +rel[6], MONTHS[rel[5]] ?? 0, +rel[4]));
  const head = text.match(new RegExp(rel[1] + '\\s+\\d{2}\\/[A-Z]{3}\\/\\d{4}\\s+([A-Z0-9]{5,7})\\s+([A-Z]-?\\d[A-Z0-9\\-]*)'));
  if (head) { model.reg = head[1]; model.actype = head[2]; }
  const ci = text.match(/SPD\s*:\s*CI(\d+)/); if (ci) model.ci = +ci[1];
  const dl = text.match(/DIST\/FLIGHT LEVEL\s*:\s*(\d{2,5})\/FL(\d{3})/); if (dl) { model.dist = { gnd: +dl[1], air: null }; model.plannedFL = +dl[2]; }
  // 시각: "GMP/RKSS P0900 : STD/ 16.20L ETD/ ATD- /" — L 표기면 오프셋으로 UTC 환산, ETD 비면 STD 사용
  const tm = (kind) => {
    const m = text.match(new RegExp('^\\s*([A-Z]{3})\\/([A-Z]{4})\\s+([PM])(\\d{2})(\\d{2})\\s*:\\s*' + kind[0] + '\\/\\s*(\\d{1,2}[.:]\\d{2})(L?)Z?\\s+' + kind[1] + '\\/\\s*(\\d{1,2}[.:]\\d{2})?(L?)', 'm'));
    if (!m) return null;
    const tzMin = (m[3] === 'M' ? -1 : 1) * (+m[4] * 60 + +m[5]);
    const toZ = (s, local) => { if (!s) return null; let min = hmToMin(s); if (local) min = ((min - tzMin) % 1440 + 1440) % 1440; return `${String(Math.floor(min / 60)).padStart(2, '0')}.${String(min % 60).padStart(2, '0')}`; };
    const std = toZ(m[6], m[7] === 'L'), est = toZ(m[8], m[9] === 'L' || (m[8] && m[7] === 'L')) || std;
    return { iata: m[1], icao: m[2], tzMin, std, est };
  };
  const d = tm(['STD', 'ETD']), a = tm(['STA', 'ETA']);
  if (d) model.dep = { iata: d.iata, icao: d.icao, tzMin: d.tzMin, std: d.std, etd: d.est };
  if (a) model.dest = { iata: a.iata, icao: a.icao, tzMin: a.tzMin, sta: a.std, eta: a.est };
  parseApmsFuel(text, model);
  const dr = text.match(/DISP REMARK\s*:\s*([^\n]+)/); if (dr && dr[1].trim()) model.remarks = [dr[1].trim()];
  const asIdx = text.indexOf('ALTN SUMMARY');
  if (asIdx >= 0) {
    model.altnSummary = [];
    for (const line of text.slice(asIdx, asIdx + 600).split('\n').slice(1)) {
      const m = line.match(/^\s*([A-Z]{4})\s+(\d+)\s+(\d{3})\s+(\d{1,2}\.\d{2})\s+(\d{3,5})\s+(.+?)\s*$/);
      if (m) model.altnSummary.push({ icao: m[1], rwy: '—', dist: +m[2], fl: +m[3], time: m[4], comp: null, fuel: +m[5], rte: m[6] });
      else if (model.altnSummary.length) break;
    }
    if (!model.altnSummary.length) delete model.altnSummary;
  }
  model.navlog = parseDomNavlog(text.split('\n'));
  model.windMatrix = null;
  if (fpl) {
    model.callsign = fpl.callsign; model.actype = model.actype || fpl.actype; model.reg = model.reg || fpl.reg;
    model.altn = fpl.altn?.length ? fpl.altn : (model.altnIcao ? [model.altnIcao] : []);
    model.plannedFL = model.plannedFL || fpl.plannedFL || null;
    model.route = fpl.route || null; model.eet = fpl.eet || null;
    model.eetTotal = fpl.eetTotal ? hmToMin(fpl.eetTotal.slice(0, 2) + '.' + fpl.eetTotal.slice(2)) : null;
  } else { model.callsign = model.fltNo.replace(/^OZ/, 'AAR').replace(/^KE/, 'KAL'); model.altn = model.altnIcao ? [model.altnIcao] : []; }
  if (!model.route) { const rt = text.match(new RegExp('^\\s*' + model.depIcao + '\\s+(.+?)\\s+' + model.destIcao + '\\s*:', 'm')); if (rt) model.route = rt[1].trim(); }
  setDates(model);
  model.ok = !!(model.depIcao && model.destIcao && model.fuel);
  model.warnings.push('noWindMatrix', 'noCoords');
  return model.ok;
}
function setDates(model) {
  if (!(model.date && model.dep?.etd)) return;
  const [h, mi] = model.dep.etd.split(/[.:]/).map(Number);
  model.etdDate = new Date(model.date.getTime() + (h * 60 + mi) * 60000);
  if (model.dest?.eta) {
    const [h2, m2] = model.dest.eta.split(/[.:]/).map(Number);
    let eta = new Date(model.date.getTime() + (h2 * 60 + m2) * 60000);
    if (eta < model.etdDate) eta = new Date(eta.getTime() + 86400000);
    model.etaDate = eta;
  }
}
// APMS·DOM 공용 연료표(100LBS)·중량
function parseApmsFuel(text, model) {
  const fuel = {};
  const fr = (name, re) => { const m = text.match(re); if (m) fuel[name] = { v: parseInt(m[1], 10), time: m[2] || null, extra: m[3] || null }; };
  fr('trip', /^\s*TRIP\s+(\d{3,5})\s+(\d{1,2}\.\d{2})/m);
  fr('cont', /^\s*CONT(?:\/[A-Z]{4})?\s+(\d{3,5})\s+(\d{1,2}\.\d{2})/m); // CONT/RKPC 꼴(보정연료 기준 공항)도
  const am = text.match(/^\s*ALTN\/([A-Z]{4})\s+(\d{3,5})\s+(\d{1,2}\.\d{2})/m);
  if (am) { fuel.altn = { v: parseInt(am[2], 10), time: am[3] }; model.altnIcao = am[1]; }
  fr('frsv', /^\s*F-RSV\s+(\d{3,5})\s+(\d{1,2}\.\d{2})/m);
  fr('rqrd', /^\s*RQRD\s+(\d{3,5})\s+(\d{1,2}\.\d{2})/m);
  fr('extra', /^\s*EXTRA\s+(\d{3,5})\s+(\d{1,2}\.\d{2})(?:\s+RSN\/(\S+))?/m);
  fr('tkof', /^\s*TKOF\s+(\d{3,5})\s+(\d{1,2}\.\d{2})/m);
  const tx = text.match(/^\s*TAXI\s+(\d{3,5})/m); if (tx) fuel.taxi = { v: parseInt(tx[1], 10) };
  fr('ramp', /^\s*RAMP\s+(\d{3,5})\s+(\d{1,2}\.\d{2})/m);
  if (Object.keys(fuel).length) model.fuel = fuel;
  const w = {};
  for (const [k, re] of [['tow', /\bTOW\s+(\d{4,5})/], ['ldw', /\bLDW\s+(\d{4,5})/], ['zfw', /\bZFW\s+(\d{4,5})/], ['agtow', /AGTOW\s+(\d{4,5})/]]) {
    const m = text.match(re); if (m) w[k] = parseInt(m[1], 10);
  }
  if (Object.keys(w).length) model.weights = w;
}

export function parseOFP(raw) {
  const text = raw.replace(/\r/g, '');
  const fpl = parseFplBlock(text);
  const model = { ok: false, src: 'NONE', fpl, warnings: [] };

  // 국내선 DOM FLT PLAN & RLS SHEET
  if (/DOM\s+FLT\s+PLAN/.test(text) && parseDom(text, fpl, model)) return model;

  // CFP 포맷(FLIGHT RELEASE) 우선 — 실제 브리핑 PDF가 이 양식
  if (/FLIGHT RELEASE\s+[A-Z]{3}\d/.test(text) && /RQD TAKEOFF/.test(text)) {
    if (parseCfp(text, fpl, model)) {
      if (!model.windMatrix) model.warnings.push('noWindMatrix');
      return model;
    }
  }

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

  // ── 연료 (100LBS 단위) · 중량 ──
  parseApmsFuel(text, model);

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
  setDates(model);

  // ── 판정 ──
  if (model.depIcao && model.destIcao && (model.fuel || model.navlog?.length)) { model.ok = true; model.src = 'OZ-APMS'; }
  else if (fpl && fpl.dep && fpl.dest) { model.ok = true; model.src = 'ICAO-FPL'; model.warnings.push('generic'); }
  if (model.ok && !model.windMatrix) model.warnings.push('noWindMatrix');
  if (model.ok && !model.navlog?.length) model.warnings.push('noNavlog');
  return model;
}
