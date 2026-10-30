// ICAO ATS 비행계획(FPL) 풀이 — Item 7~19 장비·감시·PBN·Item 18/19 코드를 한국어로 (Doc 4444 App.2 기준, 참고용)
const EQUIP = {
  N: '무선·항법·진입보조 장비 없음', S: '표준 장비 (VHF·VOR·ILS)', A: 'GBAS 착륙', B: 'LPV (SBAS APV)', C: 'LORAN C', D: 'DME',
  E1: 'FMC WPR ACARS', E2: 'D-FIS ACARS', E3: 'PDC ACARS (출발허가 데이터링크)', F: 'ADF', G: 'GNSS (GPS)', H: 'HF 무선', I: '관성항법 (IRS)',
  J1: 'CPDLC ATN VDL2', J2: 'CPDLC FANS 1/A HFDL', J3: 'CPDLC FANS 1/A VDL A', J4: 'CPDLC FANS 1/A VDL2', J5: 'CPDLC FANS 1/A SATCOM(INMARSAT)', J6: 'CPDLC FANS 1/A SATCOM(MTSAT)', J7: 'CPDLC FANS 1/A SATCOM(Iridium)',
  K: 'MLS', L: 'ILS', M1: 'SATVOICE (INMARSAT)', M2: 'SATVOICE (MTSAT)', M3: 'SATVOICE (Iridium)', O: 'VOR',
  P1: 'CPDLC RCP 400', P2: 'CPDLC RCP 240', P3: 'SATVOICE RCP 400',
  R: 'PBN 승인 (상세는 PBN/)', T: 'TACAN', U: 'UHF 무선', V: 'VHF 무선', W: 'RVSM 승인', X: 'MNPS/NAT HLA 승인', Y: 'VHF 8.33kHz', Z: '기타 장비 (Item 18 참조)',
};
const SURV = {
  N: '감시장비 없음', A: 'Mode A', C: 'Mode A+C', E: 'Mode S (식별·고도·EHS)', H: 'Mode S (식별·고도·EHS)', I: 'Mode S (식별만)', L: 'Mode S (식별·고도·ADS-B·EHS)', P: 'Mode S (고도만)', S: 'Mode S (식별+고도)', X: 'Mode S (식별·고도 없음)',
  B1: 'ADS-B OUT (1090ES)', B2: 'ADS-B OUT+IN (1090ES)', U1: 'ADS-B OUT (UAT)', U2: 'ADS-B OUT+IN (UAT)', V1: 'ADS-B OUT (VDL4)', V2: 'ADS-B OUT+IN (VDL4)', D1: 'ADS-C FANS 1/A', G1: 'ADS-C ATN',
};
const PBN = {
  A1: 'RNAV 10 (대양·원격)', B1: 'RNAV 5 전센서', B2: 'RNAV 5 GNSS', B3: 'RNAV 5 DME/DME', B4: 'RNAV 5 VOR/DME', B5: 'RNAV 5 INS', B6: 'RNAV 5 LORAN',
  C1: 'RNAV 2 전센서', C2: 'RNAV 2 GNSS', C3: 'RNAV 2 DME/DME', C4: 'RNAV 2 DME/DME/IRU', D1: 'RNAV 1 전센서', D2: 'RNAV 1 GNSS', D3: 'RNAV 1 DME/DME', D4: 'RNAV 1 DME/DME/IRU',
  L1: 'RNP 4', O1: 'Basic RNP 1 전센서', O2: 'Basic RNP 1 GNSS', O3: 'Basic RNP 1 DME/DME', O4: 'Basic RNP 1 DME/DME/IRU',
  S1: 'RNP APCH (LNAV)', S2: 'RNP APCH + BARO-VNAV', T1: 'RNP AR APCH (RF 포함)', T2: 'RNP AR APCH (RF 없음)',
};
const RULES = { I: 'IFR', V: 'VFR', Y: 'IFR→VFR', Z: 'VFR→IFR' };
const FTYPE = { S: '정기 항공운송', N: '부정기', G: '일반항공', M: '군용', X: '기타' };
const WAKE = { L: 'Light', M: 'Medium', H: 'Heavy', J: 'Super' };
const PER = { A: 'Vat 91kt 미만', B: '91~120kt', C: '121~140kt', D: '141~165kt', E: '166~210kt', H: '헬리콥터' };
const STS = { ALTRV: '고도 예약 비행', ATFMX: 'ATFM 면제', FFR: '소방', FLTCK: '항행시설 점검', HAZMAT: '위험물', HEAD: '국가원수', HOSP: '의료 비행', HUM: '인도적 임무', MARSA: '군 분리책임', MEDEVAC: '긴급 환자이송', NONRVSM: 'RVSM 비승인', SAR: '수색구조', STATE: '국가 항공기' };
const RADIO = { U: 'UHF 243.0', V: 'VHF 121.5', E: 'ELT' };
const SURVIVAL = { P: '극지', D: '사막', M: '해상', J: '정글' };
const JACKET = { L: '조명', F: '형광염료', U: 'UHF', V: 'VHF' };
export const FIR_KO = { RKRR: '인천', RJJJ: '후쿠오카', RCAA: '타이베이', VHHK: '홍콩', ZJSA: '싼야', VVHM: '호치민', VVHN: '하노이', VLVT: '비엔티안', VTBB: '방콕', ZSHA: '상하이', ZBPE: '베이징', ZGZU: '광저우', ZWUQ: '우루무치', ZLHW: '란저우', ZHWH: '우한', ZPKM: '쿤밍', ZYSH: '선양', ZUCK: '충칭', RPHI: '마닐라', WSJC: '싱가포르', WMFC: '쿠알라룸푸르', WIIF: '자카르타', VYYF: '양곤', UHHH: '하바롭스크', PAZA: '앵커리지', KZAK: '오클랜드 대양', RJTG: '도쿄' };
const ITEM18 = { STS: '특수 취급', PBN: 'PBN 능력', NAV: '항법 추가', COM: '통신 추가', DAT: '데이터링크', SUR: '감시 추가', DOF: '비행 날짜', REG: '등록부호', EET: 'FIR 통과 경과시간', SEL: 'SELCAL', TYP: '기종', CODE: 'Mode S 주소', DLE: '경로상 지연', OPR: '운항자', ORGN: '발신자', PER: '성능 분류', ALTN: '교체공항', RALT: '항로 교체', TALT: '이륙 교체', RMK: '비고' };

function parseFields(p, keys) {
  const rx = new RegExp('\\b(' + keys.join('|') + ')\\/', 'g');
  const out = []; let m, last = null;
  while ((m = rx.exec(p))) { if (last) last.v = p.slice(last.end, m.index).trim(); last = { k: m[1], end: m.index + m[0].length }; out.push(last); }
  if (last) last.v = p.slice(last.end).trim();
  return out;
}
const codes = (s) => String(s || '').match(/[A-Z]\d?/g) || [];
const hhmm = (s) => (s ? `${s.slice(0, 2)}:${s.slice(2)}` : '');
function speedKo(s) { const v = s.slice(1); return s[0] === 'N' ? `TAS ${+v}kt` : s[0] === 'K' ? `TAS ${+v}km/h` : s[0] === 'M' ? `M${(+v / 100).toFixed(2)}` : s; }
function levelKo(l) { if (l === 'VFR') return 'VFR'; const v = l.slice(1); return l[0] === 'F' ? `FL${v}` : l[0] === 'S' ? `S${v} = ${+v * 10}m (미터 고도)` : l[0] === 'A' ? `${+v * 100}ft` : l[0] === 'M' ? `${+v * 10}m` : l; }

export function parseFpl(raw) {
  const m = String(raw || '').match(/\(FPL[\s\S]*?\n?-[A-Z]{4}\d{4}[^\n]*\n[\s\S]*?\)/) || String(raw || '').match(/\(FPL[\s\S]*?\)/);
  if (!m) return null;
  const body = m[0].slice(1, -1).replace(/\r/g, '');
  const parts = body.split(/\n\s*-|^-/).map((s) => s.replace(/\n\s*/g, ' ').trim()).filter(Boolean);
  const r = { raw: m[0] };
  parts.forEach((p, i) => {
    let mm;
    if (i === 0) { mm = p.match(/^FPL-?([A-Z0-9]+)-([IVYZ])([SNGMX])/); if (mm) { r.id = mm[1]; r.rules = mm[2]; r.ftype = mm[3]; } return; }
    if ((mm = p.match(/^(\d{0,2})([A-Z0-9]{2,4})\/([LMHJ])-([A-Z0-9]+)\/([A-Z0-9]+)$/))) { r.type = mm[2]; r.wake = mm[3]; r.equip = mm[4]; r.surv = mm[5]; return; }
    if ((mm = p.match(/^([A-Z]{4})(\d{4})$/)) && !r.dep) { r.dep = mm[1]; r.eobt = mm[2]; return; }
    if ((mm = p.match(/^([NKM]\d{3,4})([FSAM]\d{3,4}|VFR)\s+([\s\S]*)$/))) { r.spd = mm[1]; r.lvl = mm[2]; r.route = mm[3]; return; }
    if ((mm = p.match(/^([A-Z]{4})(\d{4})((?:\s+[A-Z]{4})*)$/)) && r.dep && !r.dest) { r.dest = mm[1]; r.eet = mm[2]; r.altn = mm[3].trim().split(/\s+/).filter(Boolean); return; }
    if (/^(STS|PBN|NAV|COM|DAT|SUR|DEP|DEST|DOF|REG|EET|SEL|TYP|CODE|DLE|OPR|ORGN|PER|ALTN|RALT|TALT|RIF|RVR|RFP|RMK)\//.test(p)) { r.i18 = parseFields(p, Object.keys(ITEM18)); return; }
    if (/^(E|P|R|S|J|D|A|N|C)\//.test(p)) { r.i19 = parseFields(p, ['E', 'P', 'R', 'S', 'J', 'D', 'A', 'N', 'C']); return; }
  });
  return r;
}

// 렌더용 데이터: {caps:[{cls,text}], sections:[{title, mono, rows:[[k,v]], chips:[{code,desc}]}]}
export function explainFpl(raw) {
  const f = parseFpl(raw);
  if (!f) return null;
  const eq = codes(f.equip), sv = codes(f.surv);
  const i18 = f.i18 || [], i19 = f.i19 || [];
  const g18 = (k) => (i18.find((x) => x.k === k) || {}).v;
  const pbn = (g18('PBN') || '').match(/[A-Z]\d/g) || [];
  const caps = [];
  caps.push(eq.includes('W') ? { cls: 'ok', text: 'RVSM 승인 (W)' } : { cls: 'no', text: 'RVSM 미승인' });
  caps.push(eq.includes('R') ? { cls: 'ok', text: `PBN 승인 (R)${pbn.length ? ' · ' + pbn.join(' ') : ''}` } : { cls: 'no', text: 'PBN 미승인' });
  caps.push(eq.includes('Y') ? { cls: 'ok', text: '8.33kHz (Y)' } : { cls: 'warn', text: '8.33kHz 없음' });
  const cpdlc = eq.filter((c) => /^J\d$/.test(c)); caps.push(cpdlc.length ? { cls: 'ok', text: `CPDLC ${cpdlc.join(' ')}` } : { cls: 'no', text: 'CPDLC 없음' });
  const sat = eq.filter((c) => /^M\d$/.test(c)); if (sat.length) caps.push({ cls: 'ok', text: `SATVOICE ${sat.join(' ')}` });
  caps.push(sv.some((c) => /^B[12]$/.test(c)) ? { cls: 'ok', text: `ADS-B OUT${/260B/.test(g18('SUR') || '') ? ' · DO-260B' : ''}` } : { cls: 'no', text: 'ADS-B 없음' });
  caps.push(sv.some((c) => /^[DG]1$/.test(c)) ? { cls: 'ok', text: `ADS-C${/RSP\d+/.test(g18('SUR') || '') ? ' · ' + (g18('SUR').match(/RSP\d+/) || [])[0] : ''}` } : { cls: 'no', text: 'ADS-C 없음' });
  const modeS = sv.find((c) => /^[EHILPSX]$/.test(c)); if (modeS) caps.push({ cls: 'ok', text: `Transponder ${modeS} · ${SURV[modeS]}` });
  if (/TCAS/i.test(g18('RMK') || '')) caps.push({ cls: 'ok', text: 'TCAS II' });
  const sts = g18('STS'); if (sts) caps.push({ cls: 'warn', text: `STS/${sts} — ${sts.split(/\s+/).map((s) => STS[s] || s).join(', ')}` });

  const sections = [];
  sections.push({ title: 'Item 7·8·9 — 식별·규칙·기종', mono: `${f.id || ''}-${(f.rules || '') + (f.ftype || '')} · ${f.type || ''}/${f.wake || ''}`, rows: [
    [f.id || '', '콜사인'], [f.rules || '', RULES[f.rules] || ''], [f.ftype || '', FTYPE[f.ftype] || ''], [f.type || '', '기종 ICAO 코드'], [f.wake || '', '후류 등급 ' + (WAKE[f.wake] || '')],
  ].filter((r) => r[0]) });
  sections.push({ title: 'Item 10a — 무선·항법·진입 장비', mono: f.equip || '', chips: eq.map((c) => ({ code: c, desc: EQUIP[c] || '알 수 없는 코드' })) });
  sections.push({ title: 'Item 10b — 감시 장비', mono: f.surv || '', chips: sv.map((c) => ({ code: c, desc: SURV[c] || '알 수 없는 코드' })) });
  if (f.dep) sections.push({ title: 'Item 13 — 출발', mono: f.dep + f.eobt, rows: [[f.dep, '출발 공항'], [f.eobt, `EOBT ${hhmm(f.eobt)}Z`]] });
  if (f.spd) {
    const toks = f.route.split(/\s+/);
    const chg = toks.filter((t) => /\/[NKM]\d{3,4}[FSAM]\d{3,4}/.test(t));
    const rows = [[f.spd, speedKo(f.spd)], [f.lvl, '요청 순항고도 ' + levelKo(f.lvl)]];
    chg.forEach((t) => { const [fx, sl] = t.split('/'); const sm = sl.match(/([NKM]\d{3,4})([FSAM]\d{3,4})/); if (sm) rows.push([fx, `여기부터 ${speedKo(sm[1])} · ${levelKo(sm[2])}`]); });
    sections.push({ title: 'Item 15 — 순항 속도·고도·경로', mono: f.spd + f.lvl, rows, route: f.route });
  }
  if (f.dest) sections.push({ title: 'Item 16 — 목적지·EET·교체', mono: `${f.dest}${f.eet} ${(f.altn || []).join(' ')}`, rows: [[f.dest, '목적 공항'], [f.eet, `총 예상 소요시간 ${hhmm(f.eet)}`], ...(f.altn || []).map((a, i) => [a, (i ? '제2 ' : '') + '교체공항'])] });
  if (i18.length) {
    const rows = i18.map(({ k, v }) => {
      let d = v;
      if (k === 'PBN') d = (v.match(/[A-Z]\d/g) || []).map((c) => `${c} ${PBN[c] || ''}`).join(' · ');
      else if (k === 'EET') d = (v.match(/[A-Z]{4}\d{4}/g) || []).map((x) => `${x.slice(0, 4)}${FIR_KO[x.slice(0, 4)] ? '(' + FIR_KO[x.slice(0, 4)] + ')' : ''} +${hhmm(x.slice(4))}`).join(', ');
      else if (k === 'DOF') d = `20${v.slice(0, 2)}-${v.slice(2, 4)}-${v.slice(4, 6)}`;
      else if (k === 'PER') d = `${v} — ${PER[v] || ''}`;
      else if (k === 'SUR') d = v.split(/\s+/).map((x) => /^RSP(\d+)$/.test(x) ? `${x} (ADS-C 보고 ${x.slice(3)}초)` : x === '260B' ? '260B (ADS-B DO-260B)' : x).join(', ');
      else if (k === 'DAT') d = `${v}${/FANS/i.test(v) ? ' (FANS 1/A: CPDLC·ADS-C)' : ''}`;
      else if (k === 'CODE') d = `${v} — Mode S 24비트 주소`;
      else if (k === 'SEL') d = `${v} — SELCAL 코드`;
      else if (k === 'STS') d = v.split(/\s+/).map((s) => `${s}: ${STS[s] || ''}`).join(', ');
      return [k + '/', `${ITEM18[k] ? ITEM18[k] + ' — ' : ''}${d}`];
    });
    sections.push({ title: 'Item 18 — 기타 정보', rows });
  }
  if (i19.length) {
    const rows = i19.map(({ k, v }) => {
      let d = v;
      if (k === 'E') d = `항속시간 ${v.slice(0, 2)}시간 ${v.slice(2)}분`;
      else if (k === 'P') d = v === 'TBN' ? '탑승 인원 TBN' : `탑승 인원 ${v}명`;
      else if (k === 'R') d = '비상 무선: ' + v.split('').map((c) => RADIO[c] || c).join(', ');
      else if (k === 'S') d = '생존 장비: ' + v.split('').map((c) => SURVIVAL[c] || c).join(', ');
      else if (k === 'J') d = '구명조끼: ' + v.split('').map((c) => JACKET[c] || c).join(', ');
      else if (k === 'D') { const mm = v.match(/^(\d+)\s+(\d+)\s*(C)?\s*(.*)$/); d = mm ? `구명보트 ${mm[1]}개 · ${mm[2]}명${mm[3] ? ' · 덮개' : ''}${mm[4] ? ' · ' + mm[4] : ''}` : v; }
      else if (k === 'A') d = `항공기 색상: ${v}`;
      return [k + '/', d];
    });
    sections.push({ title: 'Item 19 — 보충 정보(비상 장비)', rows });
  }
  return { caps, sections };
}
