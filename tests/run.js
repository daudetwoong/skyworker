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
ok(m.navlog?.length === 6, '항법로그 6행(TOC~TOD+도착 공항)', m.navlog?.length);
const mDest = m.navlog?.at(-1);
ok(mDest?.point === 'VHHH' && Math.abs(mDest.lat - 22.3083) < 0.01 && Math.abs(mDest.lon - 113.915) < 0.01 && mDest.accMin === 220 && mDest.accFuel === 150 && mDest.dist === 118, 'APMS 도착 공항 행(TAXI/ELEV 2줄)', JSON.stringify(mDest));
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
ok(dm.navlog?.length === 6 && dm.navlog[0].point === 'BULTI' && dm.navlog[0].accMin === 12 && dm.navlog[0].comp === 0 && dm.navlog.at(-1).point === 'RKPC' && dm.navlog.at(-1).accMin === 42, '1줄 항법로그(출발행 제외, 도착행 포함=TRIP 대조용)', JSON.stringify(dm.navlog?.map((r) => [r.point, r.accMin])));
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

// ── v0.7: 공항 기상 요약 · FPL 원문 주석 ──
console.log('[wx] 한 줄 요약·활주로 요약');
const { metarShort, bestRunways } = await import('../src/wx.js');
const ms = metarShort({ wdir: 290, wspd: 7, visib: '6+', rawOb: 'METAR RKSI 301830Z 29007KT 8000 FEW035 14/12 Q1017 NOSIG', clouds: [{ cover: 'FEW', base: 3500 }], temp: 14, dewp: 12, altim: 1017 });
ok(ms === '290° 7kt · 8km · FEW 3,500ft · 14/12°C · Q1017 · NOSIG', 'METAR 한 줄', ms);
ok(metarShort({ wdir: 200, wspd: 4, rawOb: 'METAR RKSS 010000Z 20004KT CAVOK 17/09 Q1015', clouds: [], temp: 17, dewp: 9, altim: 1015 }).startsWith('200° 4kt · CAVOK · 17/9°C'), 'CAVOK는 짧게');
const br = bestRunways([{ rwy: '33R', head: 6, cross: 4, side: 'L' }, { rwy: '33L', head: 6, cross: 4, side: 'L' }, { rwy: '15L', head: -6, cross: 4, side: 'R' }, { rwy: '34R', head: 5, cross: 5, side: 'L' }]);
ok(br.length === 2 && br[0].rwys.join('·') === '33R·33L' && br[1].rwys[0] === '34R', '평행 활주로 묶고 정풍 큰 순서 2개', JSON.stringify(br));
console.log('[fpl] 원문 주석');
const { annotateFpl } = await import('../src/fpl.js');
const an = annotateFpl(OFP_CFP_SAMPLE, { wpt: (n) => (n === 'OLMEN' ? 'T+0:20 · FL351' : null) });
ok(an?.map((l) => l.item).join(',') === '7·8,9·10,13,15,16,18', '항목 줄 구성', an?.map((l) => l.item));
const tok = (item, text) => an.find((l) => l.item === item)?.toks.find((x) => x.text === text);
ok(/RVSM/.test(tok('9·10', 'W')?.note) && /CPDLC/.test(tok('9·10', 'J3')?.note), '장비 코드 하나씩 풀이', tok('9·10', 'W')?.note);
ok(/T\+0:20/.test(tok('15', 'OLMEN')?.note) && /항로/.test(tok('15', 'Y722')?.note) && /직항/.test(tok('15', 'DCT')?.note), '경로: 웨이포인트(항법로그 연동)·항로·DCT', JSON.stringify([tok('15', 'OLMEN')?.note, tok('15', 'Y722')?.note]));
ok(/RNAV 10/.test(tok('18', 'A1')?.note) && /홍콩/.test(tok('18', 'VHHK0205')?.note) && /TCAS/.test(tok('18', 'RMK/TCAS II EQUIPPED')?.note), 'Item 18: PBN 코드별·EET FIR별·RMK', JSON.stringify([tok('18', 'A1')?.note, tok('18', 'VHHK0205')?.note]));
const joined = an.map((l) => l.toks.map((x) => x.text).join('')).join('\n');
ok(joined.includes('A21N/M-SDE2E3FGHIJ3J7M3P2RWXYZ/LB1D1'), '토큰을 이어 붙이면 원문 그대로', joined.split('\n')[1]);
const dmA = annotateFpl(OFP_DOM_SAMPLE);
ok(dmA?.find((l) => l.item === '16')?.toks.some((x) => x.text === 'RKJJ' && /교체/.test(x.note)), '국내선 FPL도 주석', dmA?.map((l) => l.item));

console.log('[v0.7 리뷰 반영]');
const usM = metarShort({ wdir: 310, wspd: 12, visib: '10+', rawOb: 'METAR KJFK 311851Z 31012KT 10SM FEW250 12/M02 A3005', clouds: [{ cover: 'FEW', base: 25000 }], temp: 12, dewp: -2, altim: 1017.6 });
ok(usM.endsWith('A30.05') && !usM.includes('Q1018'), '미국식 기압은 A 표기 그대로', usM);
ok(!metarShort({ rawOb: 'METAR RKSI 010000Z /////KT 9999 NSC', visib: '6+', clouds: [] }).includes('undefined'), '바람 결측이면 생략', metarShort({ rawOb: 'METAR RKSI 010000Z /////KT 9999 NSC', visib: '6+', clouds: [] }));
ok(bestRunways([{ rwy: '09', head: 10, cross: 30, side: 'L' }, { rwy: '15', head: 9, cross: 3, side: 'R' }])[0].rwy === '15', '측풍 큰 활주로는 뒤로');
const an2 = annotateFpl('(FPL-AAR1-IS\n-2A320/M-SDFGRWY/LB1\n-RKSI0100\n-N0450F350 DCT SIDAA1A ABC A1 WP900/N0300VFR DCT\n-RJBB0130 RJGG\n-DEP/TEST RFP/Q1 RMK/X)');
const t2 = (item, text) => an2.find((l) => l.item === item)?.toks.find((x) => x.text === text);
ok(t2('9·10', '2') && /2대/.test(t2('9·10', '2').note), '항공기 대수 유지');
ok(/SID/.test(t2('15', 'SIDAA1A')?.note) && /VFR/.test(t2('15', 'N0300VFR')?.note), 'DCT 뒤 첫 절차=SID, VFR 전환', JSON.stringify([t2('15', 'SIDAA1A')?.note, t2('15', 'N0300VFR')?.note]));
ok(an2.find((l) => l.item === '18').toks.map((x) => x.text).join('') === 'DEP/TEST RFP/Q1 RMK/X', 'Item 18 DEP/RFP 원문 보존', an2.find((l) => l.item === '18').toks.map((x) => x.text).join(''));

console.log('[verify] OFP 자체 검산');
const { verifyModel } = await import('../src/verify.js');
const { countNotamHeaders } = await import('../src/notam.js');
const vk = (list, key) => list.find((c) => c.key === key);
const vc = verifyModel(m, OFP_SAMPLE);
ok(vk(vc, 'navEnd')?.ok && vk(vc, 'fuelRqrd')?.ok && vk(vc, 'fuelTkof')?.ok && vk(vc, 'eetTrip')?.ok && vk(vc, 'navCoords')?.ok, '가공 APMS: 항법로그 끝=TRIP·연료합·EET·좌표 일치', JSON.stringify(vc.map((c) => [c.key, c.ok, c.a, c.b])));
const vd = verifyModel(dm, OFP_DOM_SAMPLE);
ok(vk(vd, 'fuelRqrd')?.ok && vk(vd, 'fuelTkof')?.ok && vk(vd, 'fuelRamp')?.ok && vk(vd, 'navEnd')?.ok && vk(vd, 'eetTrip')?.ok && vk(vd, 'fplRoute')?.ok, '국내선: 연료합·항법로그 끝·EET·출도착 일치', JSON.stringify(vd.map((c) => [c.key, c.ok, c.a, c.b])));
ok(!vk(vd, 'navCoords'), '국내선은 좌표 검산 생략');
const broken = parseOFP(OFP_DOM_SAMPLE.replace(' CONT        0011  00.10', ' C0NT        0011  00.10'));
ok(vk(verifyModel(broken, ''), 'fuelRqrd')?.ok === false, 'CONT를 못 읽으면 연료 합계 ⚠', JSON.stringify(vk(verifyModel(broken, ''), 'fuelRqrd')));
const lidoModel = { _notam: parseNotamPackage(NOTAM_LIDO_SAMPLE) };
ok(countNotamHeaders(NOTAM_LIDO_SAMPLE) === 8 && vk(verifyModel(lidoModel, NOTAM_LIDO_SAMPLE), 'notamCount')?.ok, 'LIDO 노탐: 원문 머리 8 = 파싱 8 (CREW ALERT 제외)', countNotamHeaders(NOTAM_LIDO_SAMPLE));
ok(vk(verifyModel({ _notam: { items: [] } }, NOTAM_LIDO_SAMPLE), 'notamCount')?.ok === false, '노탐을 하나도 못 읽으면 ⚠');
ok(countNotamHeaders(OFP_DOM_SAMPLE) === null, '노탐 없는 OFP는 노탐 검산 생략');
const apmsCont = parseOFP(OFP_SAMPLE.replace(/^CONT\s/m, 'CONT/RKPC '));
ok(apmsCont.fuel?.cont?.v === m.fuel?.cont?.v, 'CONT/공항 꼴도 보정연료로 읽음', JSON.stringify([apmsCont.fuel?.cont, m.fuel?.cont]));

const otherSec = NOTAM_LIDO_SAMPLE.replace('==========\nCREW ALERT\n==========', '==========\nOTHER INFO\n==========\n\nX1/26\n  NOT A NOTAM\n\n==========\nCREW ALERT\n==========');
ok(countNotamHeaders(otherSec) === parseNotamPackage(otherSec).items.length, '노탐이 아닌 섹션의 ID 줄은 세지 않음(파서와 같은 기준)', [countNotamHeaders(otherSec), parseNotamPackage(otherSec).items.length]);
const noTaxi = parseOFP(OFP_DOM_SAMPLE.replace(/^ TAXI        0004\n/m, ''));
ok(!vk(verifyModel(noTaxi, ''), 'fuelRamp'), 'TAXI 줄이 없으면 RAMP 검산 생략');
ok(!vk(verifyModel({ src: 'ICAO-FPL', fpl: { dep: 'RKSI', dest: 'RJBB' }, depIcao: 'RKSI', destIcao: 'RJBB' }, ''), 'fplRoute'), '범용 FPL 폴백이면 출도착 검산 생략(자기 자신과 비교)');

const indentStart = NOTAM_LIDO_SAMPLE.replace('==========\nCREW ALERT\n==========', '====================================\nAREA ENROUTE DEPARTURE - DESTINATION\n====================================\n            R105/JIKDO\n                                                            Page 22 of 43\n                       OZ 998/23 Apr/ICN-HKG\n----------------------\n1D579/26  VALID: 2604222300 - 2604231300\n  RESTRICTED AREA ACT\n\n==========\nCREW ALERT\n==========');
ok(parseNotamPackage(indentStart).items.length === 9 && countNotamHeaders(indentStart) === 9, '들여쓴 소구역으로 시작+꼬리말 끼인 밑줄도 계수=파싱', [parseNotamPackage(indentStart).items.length, countNotamHeaders(indentStart)]);

console.log('[sigmet] 경로 SIGMET 분류');
const { normSigmet, classifySigmet, routeCells, pirepCells, inPoly, nearPireps } = await import('../src/sigmet.js');
// 가공 경로: (35,125) → (35,130) 동쪽으로, FL350 순항, 60분
const rt = [{ point: 'AAA', lat: 35, lon: 125, accMin: 0, fl: 350 }, { point: 'BBB', lat: 35, lon: 127.5, accMin: 30, fl: 350 }, { point: 'CCC', lat: 35, lon: 130, accMin: 60, fl: 350 }];
const etd = Date.UTC(2026, 9, 31, 0, 0);
const box = (la0, lo0, la1, lo1) => [{ lat: la0, lon: lo0 }, { lat: la0, lon: lo1 }, { lat: la1, lon: lo1 }, { lat: la1, lon: lo0 }, { lat: la0, lon: lo0 }];
const mk = (o) => normSigmet({ firId: 'RKRR', seriesId: '1', hazard: 'TURB', qualifier: 'SEV', validTimeFrom: (etd - 3600000) / 1000, validTimeTo: (etd + 4 * 3600000) / 1000, base: 30000, top: 40000, coords: box(34, 126.5, 36, 128.5), rawSigmet: 'RKRR SIGMET 1 ...', ...o });
const plan = { etdMs: etd, cruiseFt: 35000, nowMs: etd };
const c1 = classifySigmet(mk({}), rt, plan);
ok(c1.cls === 'red' && c1.enterMin === 18 && c1.exitMin === 42 && c1.timeOk && c1.altOk, '경로 통과+시각+고도 → 빨강, 진입·이탈 분(18~42)', JSON.stringify(c1));
ok(classifySigmet(mk({ base: 0, top: 20000 }), rt, plan).cls === 'amber', '고도 밖(FL200 이하) → 주황');
ok(classifySigmet(mk({ validTimeFrom: (etd + 5 * 3600000) / 1000, validTimeTo: (etd + 8 * 3600000) / 1000 }), rt, plan).cls === 'amber', '통과 시각 밖 → 주황');
const far = classifySigmet(mk({ coords: box(36, 126, 36.8, 127) }), rt, plan);
ok(far.cls === 'yellow' && far.dNm > 0 && far.dNm <= 100, '경로 밖 100NM 이내 → 노랑', JSON.stringify(far));
ok(classifySigmet(mk({ coords: box(40, 126, 41, 127) }), rt, plan).cls === null, '멀면 무관');
const nowFar = etd + 10 * 86400000;
const skipped = classifySigmet(mk({ validTimeFrom: (nowFar - 3600000) / 1000, validTimeTo: (nowFar + 3600000) / 1000 }), rt, { ...plan, nowMs: nowFar });
ok(skipped.cls === 'red' && skipped.timeJudge === false && skipped.timeSkip === 'far' && skipped.timeOk === null, '지난 OFP(36시간 넘게 떨어짐)는 시각 판정 생략', JSON.stringify(skipped));
ok(classifySigmet(mk({}), rt, { ...plan, nowMs: nowFar }).expired === true, '시각 판정을 생략할 땐 이미 끝난 SIGMET은 뺌');
ok(classifySigmet(mk({ validTimeFrom: (nowFar - 3600000) / 1000, validTimeTo: (nowFar + 3600000) / 1000 }), rt, { cruiseFt: 35000, etdMs: null, nowMs: nowFar }).timeSkip === 'noEtd', 'ETD 없으면 생략 사유 noEtd');
ok(classifySigmet(mk({ base: null, top: null }), rt, plan).cls === 'red', '고도 정보 없으면 걸치는 것으로');
// 고도 추정: 상승은 출발→TOC 직선, 강하는 TOD→도착 직선
const prof = [{ point: 'DEP', lat: 35, lon: 125, accMin: 0, fl: 'CL' }, { point: 'TOC', lat: 35, lon: 126, accMin: 20, fl: 350 }, { point: 'TOD', lat: 35, lon: 129, accMin: 50, fl: 350 }, { point: 'ARR', lat: 35, lon: 130, accMin: 70, fl: 'DSC' }];
ok(classifySigmet(mk({ base: 0, top: 10000, coords: box(34, 125.05, 36, 125.3) }), prof, plan).cls === 'red', '상승 초반(저고도) 구간의 FL100 이하 SIGMET → 빨강');
ok(classifySigmet(mk({ base: 0, top: 10000, coords: box(34, 125.75, 36, 125.95) }), prof, plan).cls === 'amber', '상승 막바지(고고도) 구간의 FL100 이하 SIGMET → 주황(예전엔 빨강 과대)');
// 리뷰 반영: 여러 구역(AREAS)·점 SIGMET·날짜변경선·큰 구역 경계 거리·가는 띠
const areas = normSigmet({ hazard: 'TS', coords: [box(10, 10, 11, 11), box(34.5, 127, 35.5, 128)] });
ok(areas.polys.length === 2 && classifySigmet(areas, rt, plan).cls === 'red', "geom 'AREAS'(고리 여러 개)도 판정", JSON.stringify(areas.polys.map((r) => r.length)));
const pt = normSigmet({ hazard: 'VA', coords: [{ lat: 35.2, lon: 127 }] });
ok(pt.points.length === 1 && classifySigmet(pt, rt, plan).cls === 'red', '좌표 1개(화산 위치) SIGMET은 반경 30NM 원');
ok(classifySigmet(normSigmet({ hazard: 'TS', coords: [] }), rt, plan).unplaced === true, '좌표 없는 SIGMET은 그리지 못함으로 따로 셈');
const dl = normSigmet({ hazard: 'TURB', coords: [{ lat: 55, lon: 175 }, { lat: 65, lon: 175 }, { lat: 65, lon: -175 }, { lat: 55, lon: -175 }, { lat: 55, lon: 175 }] });
const westOf = [{ point: 'W1', lat: 60, lon: 150, accMin: 0, fl: 350 }, { point: 'W2', lat: 60, lon: 165, accMin: 60, fl: 350 }];
const across = [{ point: 'E1', lat: 60, lon: 170, accMin: 0, fl: 350 }, { point: 'E2', lat: 60, lon: -170, accMin: 60, fl: 350 }];
ok(classifySigmet(dl, westOf, plan).cls !== 'red' && classifySigmet(dl, across, plan).cls === 'red', '날짜변경선 걸친 구역: 서쪽 경로는 비통과, 횡단 경로는 통과', JSON.stringify([classifySigmet(dl, westOf, plan).cls, classifySigmet(dl, across, plan)]));
ok(inPoly({ lat: 60, lon: -178 }, dl.polys[0]) && !inPoly({ lat: 60, lon: 160 }, dl.polys[0]), '날짜변경선 고리 안/밖');
const big = classifySigmet(mk({ coords: box(36, 120, 46, 140) }), rt, plan);
ok(big.cls === 'yellow' && big.dNm >= 55 && big.dNm <= 65, '큰 구역은 꼭짓점이 아니라 경계선까지 거리(60NM)', JSON.stringify(big));
ok(classifySigmet(mk({ coords: box(34, 127.01, 36, 127.05) }), rt, plan).cls === 'red', '폭 2NM 남짓 가는 띠도 통과로 잡음');
ok(inPoly({ lat: 35, lon: 127 }, box(34, 126.5, 36, 128.5)) && !inPoly({ lat: 37, lon: 127 }, box(34, 126.5, 36, 128.5)), '다각형 안/밖');
// 요청 칸: 장거리(인천→프랑크푸르트)·날짜변경선 경로도
const icnFra = [{ lat: 37.5, lon: 126.4 }, { lat: 55, lon: 90 }, { lat: 60, lon: 40 }, { lat: 50.0, lon: 8.6 }];
const cFra = routeCells(icnFra);
ok(cFra && cFra.length <= 60 && cFra.includes('30_120') && cFra.includes('50_0'), '장거리 경로도 10° 칸으로(ICN→FRA)', cFra?.length);
const cPac = routeCells([{ lat: 37.5, lon: 126.4 }, { lat: 45, lon: 179 }, { lat: 45, lon: -170 }, { lat: 34, lon: -118 }]);
ok(cPac && cPac.includes('40_170') && cPac.includes('40_-180'), '태평양 횡단(날짜변경선) 칸', cPac?.slice(0, 6));
ok(pirepCells(cFra).length === Math.min(16, cFra.length), 'PIREP 칸은 16개 이하');
ok(JSON.stringify(routeCells(rt)) === JSON.stringify(['30_120', '30_130']), '짧은 경로 칸', JSON.stringify(routeCells(rt)));
const pr = nearPireps([{ lat: 35.3, lon: 127, fltLvl: 340, tbInt1: 'MOD', tbType1: 'CAT', obsTime: 1, rawOb: 'X' }, { lat: 35.3, lon: 127, fltLvl: 340, tbInt1: 'NEG', icgInt1: 'NEG' }, { lat: 35.3, lon: 127, tbInt1: 'NEG', icgInt1: 'LGT', icgType1: 'RIME' }, { lat: 45, lon: 127, tbInt1: 'SEV' }], rt);
ok(pr.length === 2 && pr[0].tb === 'MOD CAT' && pr[1].tb === '' && pr[1].ic === 'LGT RIME', "PIREP: 경로 100NM 이내만, 'NEG'(없음)는 위험 아님", JSON.stringify(pr));
ok(normSigmet({ dir: '-', spd: '0', coords: [] }).mov === 'STNR' && normSigmet({ dir: 'E', spd: '20', coords: [] }).mov === 'E 20KT' && normSigmet({ coords: [] }).mov === '', 'SIGMET 이동: 정체/방향속도(KT)/없음');
console.log('[generic] 타사 양식 범용 해석');
const { OFP_GENERIC_KG, OFP_GENERIC_LB } = await import('./fixtures/ofp_generic_samples.js');
const { coordsInLine, routeTokens, formatSignature, detectFuelUnit } = await import('../src/generic.js');
const gk = parseOFP(OFP_GENERIC_KG);
ok(gk.ok && gk.src === 'ICAO-FPL' && gk.generic?.fuel && gk.fuelUnit === 'kg', '유럽식(kg): 범용 판정·연료표·단위', JSON.stringify([gk.src, gk.generic, gk.fuelUnit]));
ok(gk.fuel.trip.v === 4520 && gk.fuel.cont.v === 230 && gk.fuel.altn.v === 1180 && gk.fuel.frsv.v === 1050 && gk.fuel.rqrd.v === 6980 && gk.fuel.extra.v === 500 && gk.fuel.tkof.v === 7480 && gk.fuel.taxi.v === 200 && gk.fuel.ramp.v === 7680 && gk.fuel.trip.time === '01.52', '연료 라벨 9종(CONTINGENCY·FINAL RES·MIN T/O·BLOCK)', JSON.stringify(gk.fuel));
ok(gk.navlogEst && gk.navlog.map((r) => r.point).join(',') === 'RKSI,BOPTA,BEDES,ELPOS,MANGI,RJFF' && gk.generic.navlog.resolved === 4 && gk.generic.navlog.total === 4, '추정 항법로그: FPL 지점+본문 좌표(SID·항로 제외)', gk.navlog.map((r) => r.point).join(','));
ok(Math.abs(gk.navlog[1].lat - 36.735) < 0.01 && Math.abs(gk.navlog[5].lon - 130.4517) < 0.01 && gk.navlog.at(-1).accMin === 112 && gk.navlog[0].accMin === 0, '좌표·총 EET 거리 비례 시각', JSON.stringify([gk.navlog[1], gk.navlog.at(-1).accMin]));
ok(gk.etdDate?.toISOString() === '2026-11-15T01:00:00.000Z' && gk.etaDate?.toISOString() === '2026-11-15T02:52:00.000Z' && gk.generic.times, '시각: DOF+EOBT, ETA=+EET', `${gk.etdDate?.toISOString()} ${gk.etaDate?.toISOString()}`);
const vgk = verifyModel(gk, OFP_GENERIC_KG);
ok(vgk.every((c) => c.ok) && vk(vgk, 'eetTrip')?.ok && vk(vgk, 'routeFound')?.ok && !vk(vgk, 'navEnd') && !vk(vgk, 'blockTrip'), '범용 검산: 연료합·EET·경로 좌표 찾음 ✓, 추정에서 나온 항법로그 끝·블록 시간 대조는 생략', JSON.stringify(vgk.map((c) => [c.key, c.ok])));
const gl = parseOFP(OFP_GENERIC_LB);
ok(gl.ok && gl.fuelUnit === 'lb' && gl.fuel.trip.v === 28400 && gl.fuel.ramp.v === 38100 && gl.fuel.altn.v === 3100, '미국식(lbs): BURN·TOTAL FUEL·단위', JSON.stringify([gl.fuelUnit, gl.fuel]));
ok(gl.navlog.map((r) => r.point).join(',') === 'KSFO,PIRAT,BEBOP,3500N14000W,CLUTS,PHNL', '붙여 쓴 좌표·도분 짧은 꼴·경로 안 좌표 토큰', gl.navlog.map((r) => r.point).join(','));
ok(Math.abs(gl.navlog[0].lon - -122.375) < 0.01 && Math.abs(gl.navlog[2].lat - 35.4833) < 0.01 && gl.navlog[3].lat === 35 && gl.navlog[3].lon === -140, '서경(W)·남북 부호', JSON.stringify(gl.navlog.slice(0, 4).map((r) => [r.lat, r.lon])));
ok(gl.etdDate?.toISOString() === '2026-12-02T18:00:00.000Z' && gl.etaDate?.toISOString() === '2026-12-02T22:58:00.000Z', '미국식 시각', gl.etaDate?.toISOString());
const noCoord = parseOFP(OFP_GENERIC_KG.replace(/N3727\.8\s+E12626\.4/, '').replace(/N3335\.1\s+E13027\.1/, ''));
ok(noCoord.generic.navlog.missing.join(',') === 'RKSI,RJFF' && !noCoord.navlog.length, '공항 좌표가 없으면 비워 두고 이유 기록');
const withApt = parseOFP(OFP_GENERIC_KG.replace(/N3727\.8\s+E12626\.4/, '').replace(/N3335\.1\s+E13027\.1/, ''), { airportCoord: (i) => ({ RKSI: { lat: 37.46, lon: 126.44 }, RJFF: { lat: 33.58, lon: 130.45 } })[i] || null });
ok(withApt.navlog.length === 6 && withApt.navlog[0].point === 'RKSI', '공항 좌표는 앱의 공항 조회(METAR 좌표)로 보충');
ok(coordsInLine('X N3727.8 E12626.4 Y').length === 1 && coordsInLine('372912N1272248E').length === 1 && coordsInLine('N37 29.2 E127 22.8').length === 1 && coordsInLine('N372912E1272248').length === 1 && coordsInLine('3729.2N 12722.8E').length === 1, '좌표 표기 5종');
ok(coordsInLine('FL350 0230 N/A 12345').length === 0, '숫자만 있는 줄은 좌표 아님');
ok(JSON.stringify(routeTokens('BOPTA2Y BOPTA Z51 BEDES DCT MANGI1A').map((x) => x.name)) === '["BOPTA","BEDES"]', '경로 토큰: SID/STAR·항로·DCT 제외');
const sigTxt = formatSignature(OFP_GENERIC_KG).join('\n');
ok(/TRIP 9 9:9/.test(sigTxt) && !/BOPTA|XYZ|4520|HL0000|RKSI/.test(sigTxt), '진단 서명: 라벨은 남고 이름·숫자는 빠짐', sigTxt.split('\n').slice(0, 5));
ok(detectFuelUnit('UNIT:100LBS') === '100lb' && detectFuelUnit('ALL WEIGHTS IN KG') === 'kg' && detectFuelUnit('FUEL LBS') === 'lb' && detectFuelUnit('nothing') === null, '연료 단위 감지');
ok(m.fuelUnit === '100lb' && parseOFP(OFP_CFP_SAMPLE).fuelUnit === '100lb' && dm.fuelUnit === '100lb', '아시아나 양식 3종은 100LBS 유지');

const gkBad = parseOFP(OFP_GENERIC_KG.replace('-RJFF0152 RJOA', '-RJFF0130 RJOA'));
ok(vk(verifyModel(gkBad, ''), 'eetTrip')?.ok === false, 'FPL EET와 TRIP 시간이 어긋나면 ⚠ (가공 OFP의 실제 실수를 잡았던 경우)');
console.log('[generic] 리뷰 반영 — 조용한 오독 방지');
const mixU = 'FUEL LBS\nTRIP 28400\nCARGO 12000 KG\nPAX BAGS 3000 KG\nMAIL 200 KG\nCOMAT 100 KGS';
ok(detectFuelUnit(mixU) === 'lb' && detectFuelUnit('TOW 70000 KG\nZFW 60000 KGS\nFUEL 8000') === null && detectFuelUnit('ALL WEIGHTS IN KG') === 'kg', '단위: 연료 근거만(화물 KG에 안 속음), 근거 없으면 모름', [detectFuelUnit(mixU), detectFuelUnit('TOW 70000 KG\nZFW 60000 KGS\nFUEL 8000')]);
const { parseGenericFuel } = await import('../src/generic.js');
const comma = parseGenericFuel('TRIP 4,520 01:52\nFINAL RES 1,050 00:30\nALTN 1,180 00:28\nTAXI 200\nBLOCK FUEL 7,680');
ok(comma?.trip.v === 4520 && comma.ramp.v === 7680 && comma.frsv.v === 1050, '천 단위 쉼표', JSON.stringify(comma));
const hh = parseGenericFuel('TRIP 0152 4520\nALTN 0028 1180\nFINAL RES 0030 1050\nBLOCK FUEL 7680');
ok(hh?.trip.v === 4520 && hh.trip.time === '01.52' && hh.frsv.time === '00.30', '시각이 먼저 오는 HHMM 줄', JSON.stringify(hh));
const noisy = 'ALTN RJOA 031200Z 01005KT\nALTN RJOA 345 NM FL340 0.45 2100\nFINAL APPROACH FIX 12000 FT\nTAXI 1500 METERS\nEXTRA FUEL REQUESTED BY CAPT 100\n' + OFP_GENERIC_KG;
const nz = parseOFP(noisy).fuel;
ok(nz.altn.v === 1180 && nz.frsv.v === 1050 && nz.taxi.v === 200 && nz.extra.v === 500, '기상·요약·문장 줄의 ALTN/FINAL/TAXI/EXTRA는 연료로 안 읽음', JSON.stringify([nz.altn, nz.frsv, nz.taxi, nz.extra]));
const two = parseOFP(OFP_GENERIC_KG.replace('BEDES    Z51      350   N3520.4    E12657.9', 'BEDES    Z51 BOPTA   N3644.1    E12637.0'));
ok(!two.navlog.some((r) => r.point === 'BEDES' && Math.abs(r.lat - 36.735) < 0.01), '한 줄에 이름 둘 + 좌표 하나 → 앞 이름에 남의 좌표 안 줌');
const ntm = parseOFP('E) RWY 15L CLSD CRANE RKSI APCH N3000.0 E12000.0\n' + OFP_GENERIC_KG, { airportCoord: () => null });
ok(Math.abs(ntm.navlog[0].lat - 37.463) < 0.01, '노탐 문장 속 좌표는 공항 좌표로 안 씀(표 줄만)', JSON.stringify(ntm.navlog[0]));
const flip = parseOFP(OFP_GENERIC_KG.replace('E12657.9', 'W12657.9'));
ok(!flip.navlog.some((r) => r.point === 'BEDES') && flip.generic.navlog.rejected === 1 && flip.dist.gnd < 600 && flip.dist.est, '좌표 오독(동경→서경)으로 크게 우회하는 지점은 뺌', JSON.stringify([flip.generic.navlog, flip.dist]));
ok(coordsInLine('WINDS S 1234 W 123 45 KT').length === 0 && coordsInLine('SLOTS 1234 E 100 30').length === 0 && coordsInLine('N3799.9 E12699.9').length === 0, '단어 끝 N/S·분 60 이상은 좌표 아님');
const two2 = parseOFP('KSFO ETD LBS 1234\nWIND W 12345\n' + OFP_GENERIC_LB);
ok(Math.abs(two2.navlog[0].lat - 37.6167) < 0.01, '2줄 좌표 오인 방지(KSFO 위치 그대로)', JSON.stringify(two2.navlog[0]));
const cAll = [['X N3727.8 E12626.4 Y', 37.4633, 126.44], ['372912N1272248E', 37.4867, 127.38], ['N37 29.2 E127 22.8', 37.4867, 127.38], ['N372912E1272248', 37.4867, 127.38], ['3729.2N 12722.8E', 37.4867, 127.38]];
ok(cAll.every(([l, la, lo]) => { const c = coordsInLine(l)[0]; return c && Math.abs(c.lat - la) < 0.001 && Math.abs(c.lon - lo) < 0.001; }), '좌표 표기 5종 값까지', JSON.stringify(cAll.map(([l]) => coordsInLine(l)[0])));
ok(!/김철수|MÜLLER|Ü/.test(formatSignature('CAPT 김철수 MÜLLER J.\nTRIP 4520').join('\n')), '진단 서명: 한글·악센트 이름도 빠짐', formatSignature('CAPT 김철수 MÜLLER J.'));
const midn = parseOFP(OFP_GENERIC_KG.replace('-RKSI0100', '-RKSI2330'));
ok(midn.etaDate?.toISOString() === '2026-11-16T01:22:00.000Z', '범용 시각 자정 넘김', midn.etaDate?.toISOString());
const softChk = verifyModel(parseOFP(OFP_GENERIC_KG.replace('MIN T/O FUEL   6980', 'MIN T/O FUEL   7300')), '');
ok(vk(softChk, 'fuelRqrd')?.ok === false && vk(softChk, 'fuelRqrd')?.soft === true, '범용 양식 연료 합계 불일치는 참고(soft)로');

console.log('[i18n] 영어 모드');
const { setLang } = await import('../src/i18n.js');
const { headline: hlF, literalKo: litF, glossary: glF, scheduleKo: schF, catName, kindName } = await import('../src/notam.js');
const { annotateFpl: anF, explainFpl: exF, firName } = await import('../src/fpl.js');
const { airportInfo } = await import('../src/airports.js');
setLang('en');
try {
  ok(decodeWxString('-SHRA') === 'light rain showers' && decodeWxString('TSRA') === 'thunderstorm with rain' && decodeWxString('FZDZ') === 'freezing drizzle' && decodeWxString('VCSH') === 'showers in the vicinity' && decodeWxString('XX') === 'XX', '기상 현상 영어(어순)', [decodeWxString('-SHRA'), decodeWxString('TSRA')]);
  const nEn = { etext: 'ILS RWY 15R/33L U/S DUE TO WIP', category: 'APPROACH PROCEDURE' };
  ok(hlF(nEn) === 'ILS unavailable' && hlF({ etext: 'NIL', category: 'RUNWAY' }) === 'Runway info' && catName('AIP SUPPLEMENT') === 'AIP supplement (SUP)' && kindName('DEST') === 'Destination', 'NOTAM 요약·분류 영어', [hlF(nEn), hlF({ etext: 'NIL', category: 'RUNWAY' })]);
  ok(litF('TEMP OBST ERECTED BTN RWY 15R/33L AND TWY C') === 'temporary obstacle ERECTED between runway 15R/33L AND taxiway C' /* 한국 AIS의 TEMP=임시 */, 'NOTAM 쉬운 영어 풀이(약어만 풀기)', litF('TEMP OBST ERECTED BTN RWY 15R/33L AND TWY C'));
  ok(glF('RWY CLSD').every(([, v]) => !/[가-힣]/.test(v)) && schF('DLY 0000-0900 EXC SUN') === 'daily 00:00–09:00Z except Sun', 'NOTAM 약어 목록·운용시간 영어', schF('DLY 0000-0900 EXC SUN'));
  const enAll = JSON.stringify([anF(OFP_CFP_SAMPLE), exF(OFP_CFP_SAMPLE)]);
  ok(!/[가-힣]/.test(enAll) && exF(OFP_CFP_SAMPLE).caps[0].text === 'RVSM approved (W)' && firName('RKRR') === 'Incheon', 'FPL 풀이 전부 영어', (enAll.match(/[가-힣]+/g) || []).slice(0, 5));
  ok(airportInfo('RKSI').name === 'Incheon' && airportInfo('ZZZZ').name === 'ZZZZ', '공항 이름 영어');
} finally { setLang('ko'); }
ok(decodeWxString('-SHRA') === '약한 소나기성 비' && airportInfo('RKSI').name === '인천' && hlF({ etext: 'ILS RWY 15R U/S', category: 'X' }) === 'ILS 사용 불가', '한국어로 되돌리면 그대로');

setLang('en');
try {
  const W = (x) => decodeWxString(x);
  ok(W('+FC') === 'tornado or waterspout' && W('FC') === 'funnel cloud' && W('+TS') === 'heavy thunderstorm' && W('-SH') === 'light showers' && W('+TSRA') === 'heavy thunderstorm with rain' && W('-TSRA') === 'light thunderstorm with rain' && W('TSSHRA') === 'thunderstorm with rain showers' && W('RERA') === 'recent rain' && W('BCFG') === 'patches of fog' && W('-RA  BR') === 'light rain, mist', '기상 영어: +FC 토네이도·강도는 묶음 전체·최근·빈 칸', ['+FC', '+TS', '-SH', '+TSRA', 'RERA', '-RA  BR'].map(W));
  ok(litF('TEMP -5C AT SFC') === 'temperature -5C AT surface' && litF('OPR: ABC AIRLINES') === 'operator: ABC AIRLINES' && litF('RWY 15 TORA 3000M') === 'runway 15 takeoff run available 3000M', 'NOTAM 영어 문맥: TEMP 숫자=기온, OPR:=운항사, TORA', [litF('TEMP -5C AT SFC'), litF('OPR: ABC AIRLINES')]);
  ok(JSON.stringify(glF('RWY CLSD DUE WIP')) === JSON.stringify([['RWY', 'runway'], ['CLSD', 'closed'], ['WIP', 'work in progress']]), '영어 약어 목록 내용', glF('RWY CLSD DUE WIP'));
  const fplRich = '(FPL-AAR1-IS\n-A21N/M-SDE2E3FGHIJ3J7M3P2RWXYZ/LB1D1\n-RKSI0100\n-N0450F350 DCT\n-VHHH0340 VMMC\n-PBN/A1B1 STS/HOSP MEDEVAC SUR/RSP180 260B CODE/71C371 SEL/QRBM PER/C RMK/TCAS II EQUIPPED\n-E/0500 P/TBN R/UVE S/PM J/LF D/2 20 C YELLOW A/WHITE N/NIL C/KIM)';
  const richEn = JSON.stringify([anF(fplRich), exF(fplRich)]);
  ok(!/[가-힣]/.test(richEn) && /Medical flight/.test(richEn) && /Endurance 05 h 00 min/.test(richEn) && /Dinghies 2 · capacity 20 · covered/.test(richEn) && /ADS-C report 180 s/.test(richEn), 'FPL Item 18/19 전 갈래 영어', (richEn.match(/[가-힣]+/g) || []).slice(0, 5));
} finally { setLang('ko'); }
ok(decodeWxString('+FC') === '토네이도·용오름' && decodeWxString('FC') === '깔때기구름', '한국어 +FC도 토네이도');

if (fails) { console.error(`\n${fails}개 실패`); process.exit(1); }
console.log('\n모든 테스트 통과');
