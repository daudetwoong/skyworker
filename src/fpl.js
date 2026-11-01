// ICAO ATS 비행계획(FPL) 풀이 — Item 7~19 장비·감시·PBN·Item 18/19 코드를 한국어로 (Doc 4444 App.2 기준, 참고용)
import { lang } from './i18n.js';
const tr = (ko, en) => (lang === 'en' ? en : ko); // 문장형 풀이 언어 선택
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
const ITEM18 = { DEP: '출발지(이름·좌표)', DEST: '목적지(이름·좌표)', RIF: '재허가 경로', RVR: '최소 RVR', RFP: '비행계획 재제출 차수', STS: '특수 취급', PBN: 'PBN 능력', NAV: '항법 추가', COM: '통신 추가', DAT: '데이터링크', SUR: '감시 추가', DOF: '비행 날짜', REG: '등록부호', EET: 'FIR 통과 경과시간', SEL: 'SELCAL', TYP: '기종', CODE: 'Mode S 주소', DLE: '경로상 지연', OPR: '운항자', ORGN: '발신자', PER: '성능 분류', ALTN: '교체공항', RALT: '항로 교체', TALT: '이륙 교체', RMK: '비고' };


// ── 영어판 사전 (Doc 4444 App.2 용어) ──
const EQUIP_EN = {
  N: 'No COM/NAV/approach aid equipment', S: 'Standard equipment (VHF, VOR, ILS)', A: 'GBAS landing system', B: 'LPV (APV with SBAS)', C: 'LORAN C', D: 'DME',
  E1: 'FMC WPR ACARS', E2: 'D-FIS ACARS', E3: 'PDC ACARS (pre-departure clearance by datalink)', F: 'ADF', G: 'GNSS', H: 'HF RTF', I: 'Inertial navigation',
  J1: 'CPDLC ATN VDL Mode 2', J2: 'CPDLC FANS 1/A HFDL', J3: 'CPDLC FANS 1/A VDL Mode A', J4: 'CPDLC FANS 1/A VDL Mode 2', J5: 'CPDLC FANS 1/A SATCOM (INMARSAT)', J6: 'CPDLC FANS 1/A SATCOM (MTSAT)', J7: 'CPDLC FANS 1/A SATCOM (Iridium)',
  K: 'MLS', L: 'ILS', M1: 'SATVOICE (INMARSAT)', M2: 'SATVOICE (MTSAT)', M3: 'SATVOICE (Iridium)', O: 'VOR',
  P1: 'CPDLC RCP 400', P2: 'CPDLC RCP 240', P3: 'SATVOICE RCP 400',
  R: 'PBN approved (see PBN/)', T: 'TACAN', U: 'UHF RTF', V: 'VHF RTF', W: 'RVSM approved', X: 'MNPS/NAT HLA approved', Y: 'VHF with 8.33 kHz spacing', Z: 'Other equipment (see Item 18)',
};
const SURV_EN = {
  N: 'No surveillance equipment', A: 'Mode A', C: 'Mode A+C', E: 'Mode S (ID, altitude, extended squitter)', H: 'Mode S (ID, altitude, enhanced surveillance)', I: 'Mode S (ID only)', L: 'Mode S (ID, altitude, ADS-B, enhanced surveillance)', P: 'Mode S (altitude only)', S: 'Mode S (ID + altitude)', X: 'Mode S (no ID, no altitude)',
  B1: 'ADS-B OUT (1090ES)', B2: 'ADS-B OUT+IN (1090ES)', U1: 'ADS-B OUT (UAT)', U2: 'ADS-B OUT+IN (UAT)', V1: 'ADS-B OUT (VDL4)', V2: 'ADS-B OUT+IN (VDL4)', D1: 'ADS-C FANS 1/A', G1: 'ADS-C ATN',
};
const PBN_EN = {
  A1: 'RNAV 10 (oceanic/remote)', B1: 'RNAV 5 all sensors', B2: 'RNAV 5 GNSS', B3: 'RNAV 5 DME/DME', B4: 'RNAV 5 VOR/DME', B5: 'RNAV 5 INS', B6: 'RNAV 5 LORAN',
  C1: 'RNAV 2 all sensors', C2: 'RNAV 2 GNSS', C3: 'RNAV 2 DME/DME', C4: 'RNAV 2 DME/DME/IRU', D1: 'RNAV 1 all sensors', D2: 'RNAV 1 GNSS', D3: 'RNAV 1 DME/DME', D4: 'RNAV 1 DME/DME/IRU',
  L1: 'RNP 4', O1: 'Basic RNP 1 all sensors', O2: 'Basic RNP 1 GNSS', O3: 'Basic RNP 1 DME/DME', O4: 'Basic RNP 1 DME/DME/IRU',
  S1: 'RNP APCH (LNAV)', S2: 'RNP APCH with BARO-VNAV', T1: 'RNP AR APCH with RF', T2: 'RNP AR APCH without RF',
};
const FTYPE_EN = { S: 'Scheduled air service', N: 'Non-scheduled', G: 'General aviation', M: 'Military', X: 'Other' };
const PER_EN = { A: 'Vat below 91 kt', B: '91–120 kt', C: '121–140 kt', D: '141–165 kt', E: '166–210 kt', H: 'Helicopter' };
const STS_EN = { ALTRV: 'Altitude reservation', ATFMX: 'ATFM exempt', FFR: 'Fire-fighting', FLTCK: 'Flight check of navaids', HAZMAT: 'Hazardous material', HEAD: 'Head of state', HOSP: 'Medical flight', HUM: 'Humanitarian', MARSA: 'Military separation responsibility', MEDEVAC: 'Medical evacuation', NONRVSM: 'Non-RVSM', SAR: 'Search and rescue', STATE: 'State aircraft' };
const SURVIVAL_EN = { P: 'polar', D: 'desert', M: 'maritime', J: 'jungle' };
const JACKET_EN = { L: 'lights', F: 'fluorescein', U: 'UHF', V: 'VHF' };
const FIR_EN = { RKRR: 'Incheon', RJJJ: 'Fukuoka', RCAA: 'Taipei', VHHK: 'Hong Kong', ZJSA: 'Sanya', VVHM: 'Ho Chi Minh', VVHN: 'Hanoi', VLVT: 'Vientiane', VTBB: 'Bangkok', ZSHA: 'Shanghai', ZBPE: 'Beijing', ZGZU: 'Guangzhou', ZWUQ: 'Urumqi', ZLHW: 'Lanzhou', ZHWH: 'Wuhan', ZPKM: 'Kunming', ZYSH: 'Shenyang', ZUCK: 'Chongqing', RPHI: 'Manila', WSJC: 'Singapore', WMFC: 'Kuala Lumpur', WIIF: 'Jakarta', VYYF: 'Yangon', UHHH: 'Khabarovsk', PAZA: 'Anchorage', KZAK: 'Oakland Oceanic', RJTG: 'Tokyo' };
const ITEM18_EN = { DEP: 'Departure (name/coords)', DEST: 'Destination (name/coords)', RIF: 'Reclearance route', RVR: 'Minimum RVR', RFP: 'Replacement flight plan number', STS: 'Special handling', PBN: 'PBN capability', NAV: 'Navigation equipment', COM: 'Communication equipment', DAT: 'Datalink', SUR: 'Surveillance', DOF: 'Date of flight', REG: 'Registration', EET: 'Elapsed time to FIR boundaries', SEL: 'SELCAL', TYP: 'Aircraft type', CODE: 'Mode S address', DLE: 'En-route delay', OPR: 'Operator', ORGN: 'Originator', PER: 'Performance category', ALTN: 'Alternate', RALT: 'En-route alternate', TALT: 'Takeoff alternate', RMK: 'Remarks' };
// 이름 그대로 쓰던 사전을 언어에 맞게 고른다
const DICTS = () => (lang === 'en'
  ? { EQUIP: EQUIP_EN, SURV: SURV_EN, PBN: PBN_EN, FTYPE: FTYPE_EN, PER: PER_EN, STS: STS_EN, SURVIVAL: SURVIVAL_EN, JACKET: JACKET_EN, ITEM18: ITEM18_EN }
  : { EQUIP, SURV, PBN, FTYPE, PER, STS, SURVIVAL, JACKET, ITEM18 });
export const firName = (code) => (lang === 'en' ? FIR_EN : FIR_KO)[code] || null;

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
function levelKo(l) { if (l === 'VFR') return 'VFR'; const v = l.slice(1); return l[0] === 'F' ? `FL${v}` : l[0] === 'S' ? `S${v} = ${+v * 10}m ${tr('(미터 고도)', '(metric level)')}` : l[0] === 'A' ? `${+v * 100}ft` : l[0] === 'M' ? `${+v * 10}m` : l; }

export function parseFpl(raw) {
  const m = String(raw || '').match(/\(FPL[\s\S]*?\n?-[A-Z]{4}\d{4}[^\n]*\n[\s\S]*?\)/) || String(raw || '').match(/\(FPL[\s\S]*?\)/);
  if (!m) return null;
  const body = m[0].slice(1, -1).replace(/\r/g, '');
  const parts = body.split(/\n\s*-|^-/).map((s) => s.replace(/\n\s*/g, ' ').trim()).filter(Boolean);
  const r = { raw: m[0] };
  parts.forEach((p, i) => {
    let mm;
    if (i === 0) { mm = p.match(/^FPL-?([A-Z0-9]+)-([IVYZ])([SNGMX])/); if (mm) { r.id = mm[1]; r.rules = mm[2]; r.ftype = mm[3]; } return; }
    if ((mm = p.match(/^(\d{0,2})([A-Z0-9]{2,4})\/([LMHJ])-([A-Z0-9]+)\/([A-Z0-9]+)$/))) { r.count = mm[1] || null; r.type = mm[2]; r.wake = mm[3]; r.equip = mm[4]; r.surv = mm[5]; return; }
    if ((mm = p.match(/^([A-Z]{4})(\d{4})$/)) && !r.dep) { r.dep = mm[1]; r.eobt = mm[2]; return; }
    if ((mm = p.match(/^([NKM]\d{3,4})([FSAM]\d{3,4}|VFR)\s+([\s\S]*)$/))) { r.spd = mm[1]; r.lvl = mm[2]; r.route = mm[3]; return; }
    if ((mm = p.match(/^([A-Z]{4})(\d{4})((?:\s+[A-Z]{4})*)$/)) && r.dep && !r.dest) { r.dest = mm[1]; r.eet = mm[2]; r.altn = mm[3].trim().split(/\s+/).filter(Boolean); return; }
    if (/^(STS|PBN|NAV|COM|DAT|SUR|DEP|DEST|DOF|REG|EET|SEL|TYP|CODE|DLE|OPR|ORGN|PER|ALTN|RALT|TALT|RIF|RVR|RFP|RMK)\//.test(p)) { r.i18 = parseFields(p, Object.keys(ITEM18)); return; }
    if (/^(E|P|R|S|J|D|A|N|C)\//.test(p)) { r.i19 = parseFields(p, ['E', 'P', 'R', 'S', 'J', 'D', 'A', 'N', 'C']); return; }
  });
  return r;
}

function item18Desc(k, v) {
  if (k === 'PBN') return (v.match(/[A-Z]\d/g) || []).map((c) => `${c} ${DICTS().PBN[c] || ''}`).join(' · ');
  if (k === 'EET') return (v.match(/[A-Z]{4}\d{4}/g) || []).map((x) => `${x.slice(0, 4)}${firName(x.slice(0, 4)) ? '(' + firName(x.slice(0, 4)) + ')' : ''} +${hhmm(x.slice(4))}`).join(', ');
  if (k === 'DOF') return `20${v.slice(0, 2)}-${v.slice(2, 4)}-${v.slice(4, 6)}`;
  if (k === 'PER') return `${v} — ${DICTS().PER[v] || ''}`;
  if (k === 'SUR') return v.split(/\s+/).map((x) => /^RSP(\d+)$/.test(x) ? `${x} (${tr('ADS-C 보고', 'ADS-C report')} ${x.slice(3)}${tr('초', ' s')})` : x === '260B' ? '260B (ADS-B DO-260B)' : x).join(', ');
  if (k === 'DAT') return `${v}${/FANS/i.test(v) ? ' (FANS 1/A: CPDLC·ADS-C)' : ''}`;
  if (k === 'CODE') return `${v} — ${tr('Mode S 24비트 주소', 'Mode S 24-bit address')}`;
  if (k === 'SEL') return `${v} — ${tr('SELCAL 코드', 'SELCAL code')}`;
  if (k === 'STS') return v.split(/\s+/).map((x) => `${x}: ${DICTS().STS[x] || ''}`).join(', ');
  if (k === 'RMK' && /TCAS/i.test(v)) return `${v} (${tr('공중충돌방지장치 TCAS 장착', 'TCAS collision avoidance fitted')})`;
  return v;
}
function item19Desc(k, v) {
  if (k === 'E') return tr(`항속시간 ${v.slice(0, 2)}시간 ${v.slice(2)}분`, `Endurance ${v.slice(0, 2)} h ${v.slice(2)} min`);
  if (k === 'P') return v === 'TBN' ? tr('탑승 인원 TBN', 'Persons on board TBN') : tr(`탑승 인원 ${v}명`, `Persons on board ${v}`);
  if (k === 'R') return tr('비상 무선: ', 'Emergency radio: ') + v.split('').map((c) => RADIO[c] || c).join(', ');
  if (k === 'S') return tr('생존 장비: ', 'Survival equipment: ') + v.split('').map((c) => DICTS().SURVIVAL[c] || c).join(', ');
  if (k === 'J') return tr('구명조끼: ', 'Life jackets: ') + v.split('').map((c) => DICTS().JACKET[c] || c).join(', ');
  if (k === 'D') { const mm = v.match(/^(\d+)\s+(\d+)\s*(C)?\s*(.*)$/); return mm ? tr(`구명보트 ${mm[1]}개 · ${mm[2]}명${mm[3] ? ' · 덮개' : ''}`, `Dinghies ${mm[1]} · capacity ${mm[2]}${mm[3] ? ' · covered' : ''}`) + (mm[4] ? ' · ' + mm[4] : '') : v; }
  if (k === 'A') return `${tr('항공기 색상', 'Aircraft colour')}: ${v}`;
  if (k === 'N') return `${tr('비고', 'Remarks')}: ${v}`;
  if (k === 'C') return `${tr('기장', 'Pilot in command')}: ${v}`;
  return v;
}

// ── 원문 주석 모드: FPL 원문을 항목(줄) 단위로 보여주고, 각 코드를 누르면 바로 아래에 풀이를 단다 ──
// 반환: [{ item, title, toks:[{text, note?}] }] — note 없는 토큰은 기호(-, /, 공백)
// opt.wpt(name) → 항법로그 기반 웨이포인트 보충 설명(예: 'T+0:42 · FL350') 또는 null
const AWY_RX = /^(?:[A-Z]{1,2}\d{1,4}[A-Z]?|U[A-Z]\d{1,4})$/;
export function annotateFpl(raw, opt = {}) {
  const f = parseFpl(raw);
  if (!f) return null;
  const T = (text, note) => ({ text, note });
  const S = (text) => ({ text });
  const lines = [];
  if (f.id) lines.push({ item: '7·8', title: tr('Item 7·8 — 식별부호·비행규칙·비행종류', 'Item 7·8 — Aircraft ID, flight rules, type of flight'), toks: [S('FPL-'), T(f.id, tr('콜사인(무선 호출부호). ICAO 3글자 항공사 코드 + 편명', 'Callsign: ICAO 3-letter operator code + flight number')), S('-'), ...(f.rules ? [T(f.rules, `${tr('비행규칙', 'Flight rules')}: ${RULES[f.rules] || f.rules}`)] : []), ...(f.ftype ? [T(f.ftype, `${tr('비행 종류', 'Type of flight')}: ${DICTS().FTYPE[f.ftype] || f.ftype}`)] : [])] });
  if (f.type) {
    const toks = [...(f.count ? [T(f.count, tr(`항공기 대수 ${+f.count}대 (편대)`, `Number of aircraft: ${+f.count} (formation)`))] : []), T(f.type, tr('기종 ICAO 코드 (Item 9)', 'ICAO aircraft type designator (Item 9)')), S('/'), T(f.wake, `${tr('후류(Wake) 등급', 'Wake turbulence category')}: ${WAKE[f.wake] || f.wake}`), S('-')];
    codes(f.equip).forEach((c) => toks.push(T(c, `Item 10a ${tr('장비', 'equipment')} ${c}: ${DICTS().EQUIP[c] || tr('사전에 없는 코드', 'code not in dictionary')}`)));
    toks.push(S('/'));
    codes(f.surv).forEach((c) => toks.push(T(c, `Item 10b ${tr('감시', 'surveillance')} ${c}: ${DICTS().SURV[c] || tr('사전에 없는 코드', 'code not in dictionary')}`)));
    lines.push({ item: '9·10', title: tr('Item 9·10 — 기종·후류·탑재 장비', 'Item 9·10 — Type, wake category, equipment'), toks });
  }
  if (f.dep) lines.push({ item: '13', title: tr('Item 13 — 출발 공항·EOBT', 'Item 13 — Departure aerodrome and EOBT'), toks: [T(f.dep, tr('출발 공항', 'Departure aerodrome')), T(f.eobt, `${tr('EOBT(블록 출발 예정)', 'EOBT (estimated off-block time)')} ${hhmm(f.eobt)}Z`)] });
  if (f.spd) {
    const toks = [T(f.spd, `${tr('순항 속도', 'Cruising speed')} ${speedKo(f.spd)}`), T(f.lvl, `${tr('요청 순항고도', 'Requested cruising level')} ${levelKo(f.lvl)}`)];
    const rt = f.route.split(/\s+/).filter(Boolean);
    const firstReal = rt.findIndex((x) => x !== 'DCT');
    rt.forEach((tk, i) => {
      toks.push(S(' '));
      const chg = tk.match(/^([A-Z0-9]+)\/([NKM]\d{3,4})([FSAM]\d{3,4}|VFR)$/);
      const point = chg ? chg[1] : tk;
      const extra = opt.wpt ? opt.wpt(point) : null;
      let note;
      if (point === 'DCT') note = tr('직항(Direct) — 다음 지점까지 항로 없이 바로', 'Direct to the next point (no airway)');
      else if (extra) note = `${tr('웨이포인트', 'Waypoint')} ${point} · ${extra}`;
      else if (/^\d{2,4}[NS]\d{3,5}[EW]$/.test(point)) note = `${tr('좌표 지점', 'Lat/long point')} ${point}`;
      else if (/^[A-Z]{2,5}\d[A-Z]$/.test(point)) note = i === firstReal ? `${tr('표준 출발 절차(SID)', 'Standard departure (SID)')} ${point}` : `${tr('표준 도착 절차(STAR)', 'Standard arrival (STAR)')} ${point}`;
      else if (AWY_RX.test(point) && i > 0 && i < rt.length - 1) note = `${tr('항로(Airway)', 'Airway')} ${point} — ${tr('앞 지점부터 다음 지점까지 이 항로로', 'flown from the previous to the next point')}`;
      else if (/^[A-Z]{2,3}$/.test(point)) note = `${tr('항법시설(VOR/NDB)', 'Navaid (VOR/NDB)')} ${point}`;
      else note = `${tr('웨이포인트', 'Waypoint')} ${point}`;
      toks.push(T(point, note));
      if (chg) toks.push(S('/'), T(chg[2] + chg[3], `${tr('여기부터 속도·고도 변경', 'Speed/level change from here')}: ${speedKo(chg[2])} · ${levelKo(chg[3])}`));
    });
    lines.push({ item: '15', title: tr('Item 15 — 순항 속도·고도·경로', 'Item 15 — Cruising speed, level and route'), toks });
  }
  if (f.dest) {
    const toks = [T(f.dest, tr('목적 공항', 'Destination aerodrome')), T(f.eet, `${tr('총 예상 소요시간(EET)', 'Total EET')} ${hhmm(f.eet)}`)];
    (f.altn || []).forEach((a, i) => toks.push(S(' '), T(a, i ? tr('제2 교체공항', '2nd alternate') : tr('교체공항', 'Alternate'))));
    lines.push({ item: '16', title: tr('Item 16 — 목적지·총 EET·교체공항', 'Item 16 — Destination, total EET, alternates'), toks });
  }
  if (f.i18?.length) {
    const toks = [];
    f.i18.forEach(({ k, v }, idx) => {
      if (idx) toks.push(S(' '));
      const head = `${DICTS().ITEM18[k] || k}`;
      if (k === 'PBN') { toks.push(T('PBN/', `${head} — ${tr('아래 코드를 누르면 각각 풀이', 'tap each code for its meaning')}`)); (v.match(/[A-Z]\d/g) || []).forEach((c) => toks.push(T(c, `PBN ${c}: ${DICTS().PBN[c] || tr('사전에 없는 코드', 'code not in dictionary')}`))); }
      else if (k === 'EET') { toks.push(T('EET/', `${head} — ${tr('출발 후 각 FIR 경계까지 걸리는 시간', 'time from departure to each FIR boundary')}`)); (v.match(/[A-Z0-9]{2,5}\d{4}/g) || []).forEach((x, j) => { if (j) toks.push(S(' ')); const nm = x.slice(0, -4); toks.push(T(x, `${nm}${firName(nm) ? '(' + firName(nm) + ')' : ''} ${tr('진입까지', 'boundary at')} +${hhmm(x.slice(-4))}`)); }); }
      else toks.push(T(`${k}/${v}`, `${head} — ${item18Desc(k, v)}`));
    });
    lines.push({ item: '18', title: tr('Item 18 — 기타 정보', 'Item 18 — Other information'), toks });
  }
  if (f.i19?.length) {
    const toks = [];
    f.i19.forEach(({ k, v }, idx) => { if (idx) toks.push(S(' ')); toks.push(T(`${k}/${v}`, item19Desc(k, v))); });
    lines.push({ item: '19', title: tr('Item 19 — 보충 정보(비상 장비)', 'Item 19 — Supplementary (emergency equipment)'), toks });
  }
  return lines;
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
  caps.push(eq.includes('W') ? { cls: 'ok', text: tr('RVSM 승인 (W)', 'RVSM approved (W)') } : { cls: 'no', text: tr('RVSM 미승인', 'Not RVSM approved') });
  caps.push(eq.includes('R') ? { cls: 'ok', text: `${tr('PBN 승인 (R)', 'PBN approved (R)')}${pbn.length ? ' · ' + pbn.join(' ') : ''}` } : { cls: 'no', text: tr('PBN 미승인', 'No PBN approval') });
  caps.push(eq.includes('Y') ? { cls: 'ok', text: '8.33kHz (Y)' } : { cls: 'warn', text: tr('8.33kHz 없음', 'No 8.33 kHz') });
  const cpdlc = eq.filter((c) => /^J\d$/.test(c)); caps.push(cpdlc.length ? { cls: 'ok', text: `CPDLC ${cpdlc.join(' ')}` } : { cls: 'no', text: tr('CPDLC 없음', 'No CPDLC') });
  const sat = eq.filter((c) => /^M\d$/.test(c)); if (sat.length) caps.push({ cls: 'ok', text: `SATVOICE ${sat.join(' ')}` });
  caps.push(sv.some((c) => /^B[12]$/.test(c)) ? { cls: 'ok', text: `ADS-B OUT${/260B/.test(g18('SUR') || '') ? ' · DO-260B' : ''}` } : { cls: 'no', text: tr('ADS-B 없음', 'No ADS-B') });
  caps.push(sv.some((c) => /^[DG]1$/.test(c)) ? { cls: 'ok', text: `ADS-C${/RSP\d+/.test(g18('SUR') || '') ? ' · ' + (g18('SUR').match(/RSP\d+/) || [])[0] : ''}` } : { cls: 'no', text: tr('ADS-C 없음', 'No ADS-C') });
  const modeS = sv.find((c) => /^[EHILPSX]$/.test(c)); if (modeS) caps.push({ cls: 'ok', text: `Transponder ${modeS} · ${DICTS().SURV[modeS]}` });
  if (/TCAS/i.test(g18('RMK') || '')) caps.push({ cls: 'ok', text: 'TCAS II' });
  const sts = g18('STS'); if (sts) caps.push({ cls: 'warn', text: `STS/${sts} — ${sts.split(/\s+/).map((s) => DICTS().STS[s] || s).join(', ')}` });

  const sections = [];
  sections.push({ title: tr('Item 7·8·9 — 식별·규칙·기종', 'Item 7·8·9 — ID, rules, type'), mono: `${f.id || ''}-${(f.rules || '') + (f.ftype || '')} · ${f.type || ''}/${f.wake || ''}`, rows: [
    [f.id || '', tr('콜사인', 'Callsign')], [f.rules || '', RULES[f.rules] || ''], [f.ftype || '', DICTS().FTYPE[f.ftype] || ''], [f.type || '', tr('기종 ICAO 코드', 'ICAO type designator')], [f.wake || '', tr('후류 등급 ', 'Wake category ') + (WAKE[f.wake] || '')],
  ].filter((r) => r[0]) });
  sections.push({ title: tr('Item 10a — 무선·항법·진입 장비', 'Item 10a — COM/NAV/approach equipment'), mono: f.equip || '', chips: eq.map((c) => ({ code: c, desc: DICTS().EQUIP[c] || tr('알 수 없는 코드', 'unknown code') })) });
  sections.push({ title: tr('Item 10b — 감시 장비', 'Item 10b — Surveillance equipment'), mono: f.surv || '', chips: sv.map((c) => ({ code: c, desc: DICTS().SURV[c] || tr('알 수 없는 코드', 'unknown code') })) });
  if (f.dep) sections.push({ title: tr('Item 13 — 출발', 'Item 13 — Departure'), mono: f.dep + f.eobt, rows: [[f.dep, tr('출발 공항', 'Departure aerodrome')], [f.eobt, `EOBT ${hhmm(f.eobt)}Z`]] });
  if (f.spd) {
    const toks = f.route.split(/\s+/);
    const chg = toks.filter((t) => /\/[NKM]\d{3,4}[FSAM]\d{3,4}/.test(t));
    const rows = [[f.spd, speedKo(f.spd)], [f.lvl, tr('요청 순항고도 ', 'Requested level ') + levelKo(f.lvl)]];
    chg.forEach((t) => { const [fx, sl] = t.split('/'); const sm = sl.match(/([NKM]\d{3,4})([FSAM]\d{3,4})/); if (sm) rows.push([fx, `${tr('여기부터', 'From here')} ${speedKo(sm[1])} · ${levelKo(sm[2])}`]); });
    sections.push({ title: tr('Item 15 — 순항 속도·고도·경로', 'Item 15 — Speed, level, route'), mono: f.spd + f.lvl, rows, route: f.route });
  }
  if (f.dest) sections.push({ title: tr('Item 16 — 목적지·EET·교체', 'Item 16 — Destination, EET, alternates'), mono: `${f.dest}${f.eet} ${(f.altn || []).join(' ')}`, rows: [[f.dest, tr('목적 공항', 'Destination')], [f.eet, `${tr('총 예상 소요시간', 'Total EET')} ${hhmm(f.eet)}`], ...(f.altn || []).map((a, i) => [a, (i ? tr('제2 교체공항', '2nd alternate') : tr('교체공항', 'Alternate'))])] });
  if (i18.length) sections.push({ title: tr('Item 18 — 기타 정보', 'Item 18 — Other information'), rows: i18.map(({ k, v }) => [k + '/', `${DICTS().ITEM18[k] ? DICTS().ITEM18[k] + ' — ' : ''}${item18Desc(k, v)}`]) });
  if (i19.length) sections.push({ title: tr('Item 19 — 보충 정보(비상 장비)', 'Item 19 — Supplementary information'), rows: i19.map(({ k, v }) => [k + '/', item19Desc(k, v)]) });
  return { caps, sections };
}
