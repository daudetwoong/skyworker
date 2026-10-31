// 순수 로직 테스트 — node tests/run.js (브라우저 없이 검증, 실패 시 exit 1)
import { decodeWxString, fmtVis, fmtWind, renderMetarLines, renderTafPeriods } from '../src/wx.js';
import { runwayWind } from '../src/wind.js';
import { sunTimes } from '../src/sun.js';

let fails = 0;
function ok(cond, name, extra) {
  if (cond) { console.log('  ✓', name); }
  else { fails++; console.error('  ✗', name, extra ?? ''); }
}

console.log('[wx] 코드 해석');
ok(decodeWxString('-SHRA') === '약한 소나기성 비', 'decodeWxString -SHRA', decodeWxString('-SHRA'));
ok(decodeWxString('TSRA') === '뇌우 비', 'decodeWxString TSRA', decodeWxString('TSRA'));
ok(decodeWxString('XX') === 'XX', '모르는 코드는 원문 유지', decodeWxString('XX'));
ok(fmtVis('METAR RKSI 301400Z 21007KT 9999 NOSIG', '6+') === '10km+', 'fmtVis 9999');
ok(fmtVis('METAR RKSI 301400Z 21007KT CAVOK 16/11', '6+').startsWith('CAVOK'), 'fmtVis CAVOK');
ok(fmtVis('METAR RKSI 301400Z 21007KT 1200 FG', null) === '1.2km', 'fmtVis 1200m', fmtVis('METAR RKSI 301400Z 21007KT 1200 FG', null));
ok(fmtWind(210, 7) === '210° 7kt', 'fmtWind 기본', fmtWind(210, 7));
ok(fmtWind('VRB', 3).includes('변동'), 'fmtWind VRB');
ok(fmtWind(0, 0) === '무풍', 'fmtWind calm');

console.log('[wx] METAR 렌더 (RKPC 실데이터 샘플)');
const sampleMetar = { wdir: 210, wspd: 7, visib: '6+', rawOb: 'METAR RKPC 301400Z 21007KT 9999 SCT035 16/11 Q1020 NOSIG', clouds: [{ cover: 'SCT', base: 3500 }], temp: 16, dewp: 11, altim: 1020 };
const lines = renderMetarLines(sampleMetar);
ok(lines.some((l) => l.includes('210° 7kt')), 'METAR 바람 라인', lines);
ok(lines.some((l) => l.includes('10km+')), 'METAR 시정 라인');
ok(lines.some((l) => l.includes('3,500ft')), 'METAR 구름 라인');
ok(lines.some((l) => l.includes('Q') || l.includes('1020')), 'METAR QNH 라인');

console.log('[wx] TAF 렌더');
const sampleTaf = { fcsts: [
  { timeFrom: 1793361600, timeTo: 1793469600, fcstChange: null, wdir: 260, wspd: 8, visib: '6+', clouds: [] },
  { timeFrom: 1793365200, timeTo: 1793372400, fcstChange: 'BECMG', wdir: 320, wspd: 12, visib: '6+', clouds: [{ cover: 'SCT', base: 3000 }] },
] };
const periods = renderTafPeriods(sampleTaf);
ok(periods.length === 2, 'TAF 구간 수', periods.length);
ok(periods[0].text.includes('260° 8kt'), 'TAF 기본 구간', periods[0].text);
ok(periods[1].kind === '점차 변화', 'TAF BECMG 한국어', periods[1].kind);

console.log('[wind] 활주로 성분 — 진풍 210/20kt, 자편차 -8, 제주 07/25');
const rows = runwayWind(['07', '25'], -8, 210, 20);
ok(rows[0].rwy === '25', '정풍 큰 활주로 먼저 (25)', JSON.stringify(rows));
ok(rows[0].head === 17, 'RWY25 정풍 17kt', rows[0].head);
ok(rows[0].cross === 11 && rows[0].side === 'L', 'RWY25 측풍 11kt 좌', `${rows[0].cross}${rows[0].side}`);
ok(rows[1].head === -17, 'RWY07 배풍 17kt', rows[1].head);
ok(runwayWind(['07'], -8, 'VRB', 5) === null, 'VRB는 계산 안 함(null)');

console.log('[sun] 인천 일출·일몰');
const s = sunTimes(new Date(), 37.469, 126.451);
ok(s && s.rise instanceof Date && s.set instanceof Date, '일출·일몰 계산됨');
if (s) {
  const dayLenH = (s.set - s.rise) / 3600000;
  ok(dayLenH > 8 && dayLenH < 16, `낮 길이 상식 범위 (${dayLenH.toFixed(1)}h)`);
}

// ── OFP 파서 + FL 트레이드 (가공 픽스처) ──
const { parseOFP } = await import('../src/ofp.js');
const { flTrade } = await import('../src/fltrade.js');
const { OFP_SAMPLE } = await import('./fixtures/ofp_sample.js');

console.log('[ofp] 가공 OZ OFP 파싱');
const m = parseOFP(OFP_SAMPLE);
ok(m.ok && m.src === 'OZ-APMS', '파싱 성공 + OZ 판정', m.src);
ok(m.fltNo === 'OZ998' && m.depIcao === 'RKSI' && m.destIcao === 'VHHH', '편명·구간', `${m.fltNo} ${m.depIcao}-${m.destIcao}`);
ok(m.reg === 'HL7000' && m.actype === 'A321-251NX', '기체·기종', `${m.reg} ${m.actype}`);
ok(m.dep?.tzMin === 540 && m.dest?.tzMin === 480, '공항 로컬 오프셋', `${m.dep?.tzMin}/${m.dest?.tzMin}`);
ok(m.dep?.etd === '01.00' && m.dest?.eta === '04.40', 'ETD/ETA', `${m.dep?.etd}/${m.dest?.eta}`);
ok(m.fuel?.trip?.v === 150 && m.fuel?.extra?.extra === 'TFC', '연료 TRIP/EXTRA RSN', JSON.stringify(m.fuel?.extra));
ok(m.remarks?.[0]?.includes('VHHH TFC'), 'DISP REMARK', m.remarks);
ok(m.altnSummary?.length === 2 && m.altnSummary[0].icao === 'VMMC', 'ALTN SUMMARY 2행', JSON.stringify(m.altnSummary?.map(a=>a.icao)));
ok(m.altn?.includes('VMMC') && m.altn?.includes('VHHX'), 'FPL 교체공항 2개', m.altn);
ok(m.plannedFL === 351, '계획 FL(FPL 마지막 레벨)', m.plannedFL);
ok(m.navlog?.length === 5, '항법로그 5행(TOC~TOD)', m.navlog?.length);
ok(m.navlog?.find(r=>r.point==='TOD')?.accMin === 102, 'TOD 누적시간 1:42', m.navlog?.find(r=>r.point==='TOD')?.accMin);
ok(m.windMatrix?.levels?.length === 6 && m.windMatrix?.rows?.length === 5, '바람 매트릭스 6레벨×5행', `${m.windMatrix?.levels?.length}/${m.windMatrix?.rows?.length}`);
ok(m.eet?.[0]?.fir === 'VHHK' && m.eet?.[0]?.min === 58, 'EET FIR', JSON.stringify(m.eet));
ok(m.etdDate?.toISOString() === '2026-01-01T01:00:00.000Z', 'ETD Date 합성', m.etdDate?.toISOString());

console.log('[fltrade] 고도별 ETA 비교');
const ft = flTrade(m);
ok(!!ft, '계산 성공');
if (ft) {
  ok(ft.levels.length === 6, '6개 레벨', ft.levels.length);
  const planned = ft.levels.find((x) => x.isPlanned);
  ok(planned && planned.fl === 350 && planned.dMin === 0, '계획 레벨 Δ=0 (FL351→매트릭스 35000)', JSON.stringify(planned));
  ok(ft.levels.every((x) => x.avgComp < 0), '맞바람 노선: 전 레벨 역풍', JSON.stringify(ft.levels.map(x=>x.avgComp)));
  ok(ft.mach > 0.70 && ft.mach < 0.85, '마하 상식 범위', ft.mach);
  const span = Math.max(...ft.levels.map(x=>Math.abs(x.dMin)));
  ok(span < 30, 'Δ시간 상식 범위(<30분)', span);
}

console.log('[ofp] 범용 폴백 (FPL 블록만)');
const g = parseOFP('(FPL-ABC123-IS\n-B738/M-SDE2E3/LB1\n-RJTT0200\n-N0450F370 OLMEN Y51 SOMAR\n-RKSI0210 RKSS\n-PBN/A1B1 DOF/260101\n REG/HL8000)');
ok(g.ok && g.src === 'ICAO-FPL', '폴백 판정', g.src);
ok(g.depIcao === 'RJTT' && g.destIcao === 'RKSI' && g.altn[0] === 'RKSS', '폴백 구간/교체', `${g.depIcao}-${g.destIcao}/${g.altn}`);
ok(g.plannedFL === 370, '폴백 계획FL', g.plannedFL);


console.log('[회귀] 리뷰에서 발견된 엣지케이스');
// 마하 속도 FPL
const mach = parseOFP('(FPL-KAL123-IS\n-B77W/H-SDE2E3/LB1\n-RKSI0100\n-M084F350 OLMEN Y51 SOMAR\n-KSEA0920 KPDX\n-PBN/A1B1 DOF/260101)');
ok(mach.plannedFL === 350, '마하 속도(M084F350)에서 계획FL', mach.plannedFL);
// 중첩 괄호 FPL
const nest = parseOFP('(FPL-ABC12-IS\n-A21N/M-S/L\n-RKSI0100\n-N0450F370 SOMAR\n-RJTT0200 RJAA\n-PBN/A1 RMK/TCAS(II) EQUIPPED)');
ok(nest.ok && nest.destIcao === 'RJTT' && nest.altn[0] === 'RJAA', '중첩 괄호 FPL 블록', `${nest.destIcao}/${nest.altn}`);
// 교체공항 3개
const alt3 = parseOFP('(FPL-ABC12-IS\n-A21N/M-S/L\n-RKSI0100\n-N0450F370 SOMAR\n-VHHH0340 VMMC VHHX ZGSZ\n-PBN/A1 DOF/260101)');
ok(alt3.altn.length === 3 && alt3.altn[2] === 'ZGSZ', '교체공항 3개 전부 캡처', alt3.altn);
// raw 끝 시정
ok(fmtVis('METAR RKSI 301400Z 21007KT 0800', null) === '800m', '문자열 끝 시정 0800', fmtVis('METAR RKSI 301400Z 21007KT 0800', null));

console.log('[time] 시간 표시');
const { fmtHmZ, fmtDayTime, fmtTime } = await import('../src/time.js');
ok(fmtHmZ('08.50', 540) === '08:50Z', 'Z 기본 표시', fmtHmZ('08.50', 540));
ok(fmtTime(new Date('2026-01-01T01:00:00Z'), 540) === '01:00Z', 'fmtTime Z', fmtTime(new Date('2026-01-01T01:00:00Z'), 540));
ok(fmtDayTime(new Date('2026-01-01T01:00:00Z'), null).includes('01:00Z'), 'fmtDayTime Z');


console.log('[cfp] 가공 CFP OFP 파싱 (실 브리핑 PDF 양식)');
const { OFP_CFP_SAMPLE } = await import('./fixtures/ofp_cfp_sample.js');
const c = parseOFP(OFP_CFP_SAMPLE);
ok(c.ok && c.src === 'OZ-CFP', 'CFP 판정', c.src);
ok(c.fltNo === 'OZ900' && c.depIcao === 'RKSI' && c.destIcao === 'VHHH', 'CFP 편명·구간', `${c.fltNo} ${c.depIcao}-${c.destIcao}`);
ok(c.reg === 'HL7000' && c.actype === 'A21N', 'CFP 기체(FPL 보강)', `${c.reg} ${c.actype}`);
ok(c.dep?.etd === '01.00' && c.dest?.eta === '04.40' && c.dest?.tzMin === 480, 'CFP ETD/ETA/도착tz', JSON.stringify(c.dest));
ok(c.fuel?.trip?.v === 150 && c.fuel?.fod?.v === 112 && c.fuel?.tkof?.v === 292, 'CFP 연료 매핑(TRIP/FOD/PLN TKOF)', JSON.stringify({t:c.fuel?.trip?.v,f:c.fuel?.fod?.v,k:c.fuel?.tkof?.v}));
ok(c.dist?.gnd === 1150, 'CFP 거리', JSON.stringify(c.dist));
ok(c.altnSummary?.length === 1 && c.altnSummary[0].icao === 'VMMC' && c.altnSummary[0].rte.includes('SIERA'), 'CFP ALTN 요약+경로', JSON.stringify(c.altnSummary));
ok(c.plannedFL === 351, 'CFP 계획FL(항법로그 최빈값)', c.plannedFL);
ok(c.navlog?.length === 6 && c.navlog.find(r=>r.point==='TOD')?.accMin === 138, 'CFP 항법로그 6행·TOD 2:18', `${c.navlog?.length}/${c.navlog?.find(r=>r.point==='TOD')?.accMin}`);
ok(c.navlog?.find(r=>r.point==='ALPHA')?.comp === -18, 'CFP 행 바람성분 M018', c.navlog?.find(r=>r.point==='ALPHA')?.comp);
ok(c.windMatrix?.type === 'cfp' && c.windMatrix.levels.length === 5, 'CFP 매트릭스 5레벨', c.windMatrix?.levels);
ok(c.dispatcher === 'TEST_DISPATCHER' && !!c.validity, 'CFP 디스패처·유효시한', `${c.dispatcher}/${c.validity}`);

console.log('[cfp] FL 트레이드 (성분 직접 합산)');
const cft = flTrade(c);
ok(!!cft && cft.levels.length === 5, 'CFP 트레이드 5레벨', cft?.levels?.length);
if (cft) {
  const pl = cft.levels.find(x=>x.isPlanned);
  ok(pl?.fl === 351 && pl?.dMin === 0, 'CFP 계획 레벨 Δ0', JSON.stringify(pl));
  ok(cft.levels.every(x=>x.avgComp < 0), 'CFP 맞바람 전 레벨 음수', JSON.stringify(cft.levels.map(x=>x.avgComp)));
  const low = cft.levels.find(x=>x.fl===311);
  ok(low && low.dMin < 0, 'CFP 낮은 고도가 유리(바람 약함)', low?.dMin);
}


console.log('[notam] 패키지 파싱·해설 (가공 픽스처)');
const { parseNotamPackage, isActive, activeInWindow, headline, extractCoords, routeRelation } = await import('../src/notam.js');
const np = parseNotamPackage(OFP_CFP_SAMPLE);
ok(np && np.items.length === 4, 'NOTAM 4건 파싱', np?.items?.length);
ok(np.sections.map(s=>s.kind).join(',') === 'DEP,DEST,FIR', '섹션 DEP/DEST/FIR', np.sections.map(s=>s.kind));
const rw = np.items.find(n=>n.id==='A0001/26');
ok(rw.category === 'RUNWAY' && rw.schedule === '1800-2200 DAILY' && rw.etext === 'RWY15L/33R CLSD DUE TO MAINT.', 'RUNWAY 항목 필드', JSON.stringify({c:rw.category,s:rw.schedule,e:rw.etext}));
ok(headline(rw) === '활주로 폐쇄', '헤드라인 활주로 폐쇄', headline(rw));
ok(isActive(rw, Date.UTC(2026,0,1,1,0)) && !isActive(np.items.find(n=>n.id==='A0002/26'), Date.UTC(2026,0,1,1,0)), 'ETD 기준 유효 판정', '');
const ils = np.items.find(n=>n.id==='A0100/25');
ok(ils.toMs === Infinity && headline(ils) === 'ILS 사용 불가', 'UFN=무기한 + ILS 헤드라인', headline(ils));
const fir = np.items.find(n=>n.id==='A0200/26');
ok(fir.coords.length === 1 && Math.abs(fir.coords[0].lat - 28) < 0.01 && Math.abs(fir.coords[0].lon - 119.5) < 0.01, 'FIR 노탐 좌표 추출(2800N11930E)', JSON.stringify(fir.coords));
ok(activeInWindow(fir, Date.UTC(2026,0,1,1,0), Date.UTC(2026,0,1,4,40)), 'PERM 노탐 비행창 유효');
ok(extractCoords('NEW PSN : 333051.8N1262938.8E').length === 1, 'DDMMSS.s 좌표 추출');
const rel = routeRelation(fir, [{lat:31,lon:122},{lat:28.2,lon:119.6},{lat:26,lon:118}]);
ok(rel === 'direct', '경로 교차 판정(direct)', rel);

console.log('[fpl] FPL 풀이');
const { explainFpl } = await import('../src/fpl.js');
const fx = explainFpl(OFP_CFP_SAMPLE);
ok(fx && fx.caps.some(c=>/RVSM 승인/.test(c.text)) && fx.caps.some(c=>/CPDLC J3 J7/.test(c.text)), 'FPL 능력 요약(RVSM·CPDLC)', fx?.caps?.map(c=>c.text).join('|'));
ok(fx.sections.length >= 7, 'FPL 섹션 7+', fx?.sections?.length);

console.log('[nav] 좌표·SR·FIR 추출');
const cfpM = parseOFP(OFP_CFP_SAMPLE);
ok(cfpM.navlog.every(r=>r.lat!=null && r.lon!=null), 'CFP 전 행 좌표');
ok(Math.abs(cfpM.navlog.find(r=>r.point==='ALPHA').lat - 34) < 0.01 && Math.abs(cfpM.navlog.find(r=>r.point==='ALPHA').lon - 124.5) < 0.01, 'ALPHA 좌표 N34 00.0 E124 30.0');
ok(cfpM.navlog.find(r=>r.point==='ALPHA').sr === 2, 'CFP SR 컬럼', cfpM.navlog.find(r=>r.point==='ALPHA').sr);
const apmsM = parseOFP(OFP_SAMPLE);
ok(apmsM.navlog.find(r=>r.point==='ALPHA')?.sr === 2 && apmsM.navlog.find(r=>r.point==='ALPHA')?.lat != null, 'APMS SR·좌표', JSON.stringify({sr:apmsM.navlog.find(r=>r.point==='ALPHA')?.sr, lat:apmsM.navlog.find(r=>r.point==='ALPHA')?.lat}));


console.log('[notam] 구역·FMS·유사 콜사인·누적연료');
const { fmsCoord, similarCallsigns } = await import('../src/notam.js');
const npc = parseNotamPackage(OFP_CFP_SAMPLE);
const firA = npc.items.find(n=>n.id==='A0200/26');
ok(firA.area?.type === 'circle' && Math.abs(firA.area.rNm - 10) < 0.01, '반경 10NM 원 구역', JSON.stringify(firA.area));
const polyN = { etext: 'AREA BOUNDED BY 301332N0820722E-361720N0870710E-325212N0915551E', coords: extractCoords('301332N0820722E-361720N0870710E-325212N0915551E') };
ok(polyN.coords.length === 3, 'DDMMSS 좌표 3개 추출', polyN.coords.length);
ok(fmsCoord({ lat: 32, lon: 119.5 }) === '3200.0N/11930.0E', 'FMS 좌표 형식', fmsCoord({ lat: 32, lon: 119.5 }));
ok(fmsCoord({ lat: -33.95, lon: -58.5 }) === '3357.0S/05830.0W', 'FMS 남/서 좌표', fmsCoord({ lat: -33.95, lon: -58.5 }));
const simTxt = '[ SIMILAR CALL SIGNS]\n- OZ335 AND OZ3355 IN SEOUL APPROACH\n- OZ324 AND OZ342 DURING DEPARTURE';
ok(similarCallsigns(simTxt, 'AAR324').includes('OZ342'), '유사 콜사인(자리 바꿈) 감지', similarCallsigns(simTxt, 'AAR324'));
ok(similarCallsigns(simTxt, 'AAR999').length === 0, '해당 없으면 빈 목록');
const cfpRows = parseOFP(OFP_CFP_SAMPLE).navlog;
ok(cfpRows.find(r=>r.point==='ALPHA')?.accFuel === 60 && cfpRows.find(r=>r.point==='TOD')?.accFuel === 150, 'CFP 누적연료(ACBO) 파싱', JSON.stringify(cfpRows.map(r=>r.point+':'+r.accFuel)));
const apmsRows = parseOFP(OFP_SAMPLE).navlog;
ok(apmsRows.find(r=>r.point==='ALPHA')?.accFuel === 40, 'APMS 누적연료(ACTF) 파싱', apmsRows.find(r=>r.point==='ALPHA')?.accFuel);


console.log('[notam] 구역 분류 우선순위');
const { areaOf } = await import('../src/notam.js');
const three = [{lat:30,lon:100},{lat:31,lon:101},{lat:32,lon:102}];
ok(areaOf('WITHIN 10NM RADIUS CENTERED 3000N10000E', three)?.type === 'circle', '반경 있으면 좌표 3개여도 원');
ok(areaOf('AREA BOUNDED BY', three)?.type === 'polygon', '반경 없고 3좌표면 다각형');
ok(areaOf('PSN 3000N10000E', three.slice(0,1))?.type === 'point', '좌표 1개면 점');

// ── LIDO-NOTAM-BULLETIN 파서 (APMS 브리핑에 붙는 양식) ──
console.log('[notam] LIDO 게시 양식');

const { NOTAM_LIDO_SAMPLE } = await import('./fixtures/notam_lido_sample.js');
const lido = parseNotamPackage(NOTAM_LIDO_SAMPLE);
ok(lido && lido.items.length === 8, '아이템 8건 (CREW ALERT 제외)', lido?.items.map((n) => n.id));
ok(lido?.sections.map((s) => s.kind + ':' + s.icao).join(',') === 'DEP:RKSI,DEST:VHHH,FIR:RKRR', '섹션 종류·영역', lido?.sections.map((s) => s.kind + ':' + s.icao));
const l1 = lido?.items.find((n) => n.id === '1A001/26');
ok(l1?.category === 'APPROACH PROCEDURE' && l1?.from === '22APR26 00:00' && l1?.to === '23APR26 09:00' && l1?.schedule === '0000-0900', 'VALID→유효기간, 첫 줄 운용시간→스케줄', JSON.stringify([l1?.category, l1?.from, l1?.to, l1?.schedule]));
ok(l1?.etext === 'ILS RWY 15R/33L U/S DUE TO WIP', '본문', l1?.etext);
const co = lido?.items.find((n) => n.id === 'CO1001/20');
ok(co?.category === 'COMPANY ADVISORY' && /CONTACT POINT/.test(co?.etext) && /SIMILAR CALL SIGNS/.test(co?.etext) && !/\+\+\+\+/.test(co?.etext), '회사 공지: 들여쓴 구분선 안에서 본문 안 끊김·장식 제거', co?.etext?.slice(0, 120));
const sx = lido?.items.find((n) => n.id === 'SX18/26');
ok(sx?.category === 'AIP SUPPLEMENT' && sx?.from === '05FEB26 15:00' && sx?.to === '31JUL26 22:00' && /MAX HEIGHT/.test(sx?.etext) && !/Page 10/.test(sx?.etext), 'AIP SUP: VALIDITY 파싱 + 페이지 꼬리말 건너뜀', JSON.stringify([sx?.from, sx?.to, sx?.etext?.slice(-30)]));
const d8 = lido?.items.find((n) => n.id === '1D836/26');
ok(d8?.kind === 'FIR' && d8?.sub === 'R108B/ANHEUNG AREA' && d8?.schedule === '2300-1000' && d8?.from == null && /^R108B/.test(d8?.etext), 'FIR 소구역(꼬리말 사이) + VALID 없음=상시', JSON.stringify([d8?.sub, d8?.schedule, d8?.etext?.slice(0, 40)]));
const e18 = lido?.items.find((n) => n.id === '1E1807/26');
ok(e18?.schedule === '23 0730-0930, 24 0230-0430' && e18?.area?.type === 'circle' && Math.abs(e18.area.rNm - 7) < 0.01, 'FIR 날짜별 스케줄 + 원 구역', JSON.stringify([e18?.schedule, e18?.area]));
ok(similarCallsigns(NOTAM_LIDO_SAMPLE, 'AAR998').includes('OZ9988'), '유사 콜사인: 한 자리 끼어든 꼴(998↔9988)', similarCallsigns(NOTAM_LIDO_SAMPLE, 'AAR998'));
const footerSplit = NOTAM_LIDO_SAMPLE.replace('===================\nDESTINATION AIRPORT\n===================', '===================\nDESTINATION AIRPORT\n                                                            Page 11 of 32\n                       OZ 998/23 Apr/ICN-HKG\n===================');
const lf = parseNotamPackage(footerSplit);
ok(lf?.items.find((n) => n.id === '1E4065/25')?.kind === 'DEST', '섹션 제목과 닫는 === 사이 꼬리말이 끼어도 DEST 유지', lf?.items.find((n) => n.id === '1E4065/25')?.kind);
const badMon = parseNotamPackage(NOTAM_LIDO_SAMPLE.replace('1A001/26  VALID: 2604220000', '1A001/26  VALID: 2600220000'));
ok(badMon?.items.find((n) => n.id === '1A001/26')?.from === '2600220000', '월이 이상한 VALID는 원문 유지(JAN으로 바꾸지 않음)', badMon?.items.find((n) => n.id === '1A001/26')?.from);

// ── 국내선 DOM FLT PLAN 파서 ──
console.log('[ofp] 국내선 DOM FLT PLAN');
const { OFP_DOM_SAMPLE } = await import('./fixtures/ofp_dom_sample.js');
const dm = parseOFP(OFP_DOM_SAMPLE);
ok(dm.ok && dm.src === 'OZ-DOM', '파싱 성공 + DOM 판정', dm.src);
ok(dm.fltNo === 'OZ8999' && dm.depIcao === 'RKSS' && dm.destIcao === 'RKPC' && dm.reg === 'HL7000' && dm.actype === 'A321-231', '편명·구간·기체', `${dm.fltNo} ${dm.depIcao}-${dm.destIcao} ${dm.reg} ${dm.actype}`);
ok(dm.dep?.etd === '07.20' && dm.dest?.eta === '08.30' && dm.dep?.tzMin === 540, 'STD/STA L표기 → UTC (ETD 비면 STD)', `${dm.dep?.etd}/${dm.dest?.eta}`);
ok(dm.etdDate?.toISOString() === '2026-04-17T07:20:00.000Z' && dm.etaDate?.toISOString() === '2026-04-17T08:30:00.000Z', 'ETD/ETA Date', `${dm.etdDate?.toISOString()} ${dm.etaDate?.toISOString()}`);
ok(dm.plannedFL === 240 && dm.dist?.gnd === 248 && dm.ci === 55, 'FL·거리·CI', `${dm.plannedFL} ${dm.dist?.gnd} ${dm.ci}`);
ok(dm.fuel?.trip?.v === 55 && dm.fuel?.extra?.extra === 'TKG' && dm.fuel?.ramp?.v === 244 && dm.weights?.tow === 1654, '연료·중량', JSON.stringify([dm.fuel?.trip, dm.fuel?.ramp, dm.weights]));
ok(dm.remarks?.[0] === '8736 RAMP FUEL 14100LBS', '한 줄 DISP REMARK', dm.remarks);
ok(dm.altnSummary?.length === 1 && dm.altnSummary[0].icao === 'RKJJ' && dm.altnSummary[0].fl === 80 && dm.altnSummary[0].comp === null, 'ALTN SUMMARY(국내선 열 구성)', JSON.stringify(dm.altnSummary));
ok(dm.navlog?.length === 5 && dm.navlog[0].point === 'BULTI' && dm.navlog[0].accMin === 12 && dm.navlog[0].comp === 0 && dm.navlog.at(-1).point === 'TEDAN' && dm.navlog.at(-1).accMin === 29, '1줄 항법로그(공항행 제외, 누적시간)', JSON.stringify(dm.navlog?.map((r) => [r.point, r.accMin])));
ok(dm.navlog?.find((r) => r.point === 'BEDES')?.fl === 240 && dm.navlog?.[0].lat == null, 'FL 숫자화·좌표 없음', dm.navlog?.find((r) => r.point === 'BEDES')?.fl);
ok(dm.warnings.includes('noWindMatrix') && dm.warnings.includes('noCoords') && dm.route === 'BULTI Y711 DALSU Y253 TEDAN', '경고·FPL 경로', JSON.stringify([dm.warnings, dm.route]));
ok(flTrade(dm) === null, '바람 매트릭스 없으면 FL 트레이드 없음');

// ── PDF 텍스트 재구성: 글자 단위로 쪼개진 PDF ──
console.log('[pdfread] 글자 단위 아이템 재구성');
const { rebuildPage } = await import('../src/pdfread.js');
const glyphs = (s, x0, y) => [...s].map((ch, i) => ({ str: ch, transform: [1, 0, 0, 1, x0 + i * 6, y], width: ch === ' ' ? 0 : 6 })).filter((g) => g.str !== ' ');
const pageA = rebuildPage([...glyphs('OZ8735 RKSS/RKJY', 10, 700), ...glyphs('TRIP 0055 00.42', 10, 680)]);
ok(pageA.split('\n')[0] === 'OZ8735 RKSS/RKJY' && pageA.split('\n')[1] === 'TRIP 0055 00.42', '글자 하나씩 와도 단어로 붙고 공백은 유지', JSON.stringify(pageA));
const pageB = rebuildPage([{ str: 'TRIP', transform: [1, 0, 0, 1, 10, 700], width: 24 }, { str: '0055', transform: [1, 0, 0, 1, 64, 700], width: 24 }, { str: 'EGOBA', transform: [1, 0, 0, 1, 10, 680], width: 30 }, { str: 'N37 29.2', transform: [1, 0, 0, 1, 100, 680], width: 48 }]);
ok(/^TRIP\s+0055$/.test(pageB.split('\n')[0]) && /^EGOBA\s{5,}N37 29\.2$/.test(pageB.split('\n')[1]), '단어 단위 PDF는 기존처럼 열 위치 보존', JSON.stringify(pageB));

if (fails) { console.error(`\n${fails}개 실패`); process.exit(1); }
console.log('\n모든 테스트 통과');
