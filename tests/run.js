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

if (fails) { console.error(`\n${fails}개 실패`); process.exit(1); }
console.log('\n모든 테스트 통과');
