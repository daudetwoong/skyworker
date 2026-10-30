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

if (fails) { console.error(`\n${fails}개 실패`); process.exit(1); }
console.log('\n모든 테스트 통과');
