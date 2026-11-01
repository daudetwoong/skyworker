// OFP 자체 검산 — OFP 안의 숫자끼리 맞는지 대조해 "파서가 제대로 읽었나"를 카드별 ✓/⚠로 알린다 (외부 자료 없이, R2·R4)
import { countNotamHeaders } from './notam.js';

const hm = (s) => { const m = String(s || '').match(/(\d{1,2})[.:](\d{2})/); return m ? +m[1] * 60 + +m[2] : null; };
// 반환: [{ card, key, ok: true|false, a, b, unit }] — a=계산값, b=OFP 기재값. 대조 재료가 없으면 항목 자체를 넣지 않는다
export function verifyModel(m, raw) {
  const out = [];
  const big = m.fuelUnit === 'kg' || m.fuelUnit === 'lb'; // 100lb 반올림이 아닌 양식: 0.5% 또는 ±tol 중 큰 쪽
  // 범용 양식의 연료 합계식(TRIP+CONT+ALTN+FINAL=MIN T/O 등)은 회사마다 달라 '참고(soft)' — 어긋나도 경고로 세지 않는다
  const soft = (unit) => unit === 'fuel' && !!m.generic?.fuel;
  const add = (card, key, a, b, tol, unit) => { if (a == null || b == null || Number.isNaN(a) || Number.isNaN(b)) return; const tl = unit === 'fuel' && big ? Math.max(tol, Math.abs(b) * 0.005) : tol; out.push({ card, key, a, b, unit, ok: Math.abs(a - b) <= tl, soft: soft(unit) }); };
  const F = m.fuel || {}, v = (k) => F[k]?.v, W = m.weights || {};
  // 연료표: 100lbs 단위 반올림이라 4항 합은 ±2, 2항 합은 ±1 허용
  if (v('trip') != null && v('frsv') != null && v('rqrd') != null) add('fuel', 'fuelRqrd', v('trip') + (v('cont') || 0) + (v('altn') || 0) + v('frsv'), v('rqrd'), 2, 'fuel');
  if (v('rqrd') != null && v('tkof') != null) add('fuel', 'fuelTkof', v('rqrd') + (v('extra') || 0), v('tkof'), 1, 'fuel');
  if (v('tkof') != null && v('ramp') != null && v('taxi') != null) add('fuel', 'fuelRamp', v('tkof') + v('taxi'), v('ramp'), 1, 'fuel'); // TAXI 줄이 없는 양식이면 생략
  if (W.zfw != null && v('tkof') != null) add('fuel', 'wtTow', W.zfw + v('tkof'), W.tow, 2, 'fuel');
  if (W.tow != null && v('trip') != null) add('fuel', 'wtLdw', W.tow - v('trip'), W.ldw, 2, 'fuel');
  // 시간: FPL 총 EET = TRIP 시간, 항법로그 마지막 누적시간 = TRIP 시간
  const trip = hm(F.trip?.time);
  if (m.eetTotal != null) add('summary', 'eetTrip', m.eetTotal, trip, 2, 'min');
  const nl = m.navlog || [];
  const last = [...nl].reverse().find((r) => r.accMin != null);
  if (last && trip != null && !m.navlogEst) add('timeline', 'navEnd', last.accMin, trip, 3, 'min'); // 추정 항법로그는 EET를 나눈 것이라 대조 의미 없음
  // 범용 양식은 ETA를 EOBT+EET로 만든 것이라 블록 시간 대조는 같은 대조의 반복 → 생략
  if (m.etdDate && m.etaDate && trip != null && !m.generic?.times) { const blk = Math.round((m.etaDate - m.etdDate) / 60000); out.push({ card: 'summary', key: 'blockTrip', a: blk, b: trip, unit: 'min', ok: blk >= trip - 2 && blk <= trip + 60 }); }
  // 출도착: OFP 머리 ↔ ATC FPL
  if (m.fpl?.dep && m.depIcao && m.src !== 'ICAO-FPL') out.push({ card: 'summary', key: 'fplRoute', a: `${m.fpl.dep}-${m.fpl.dest}`, b: `${m.depIcao}-${m.destIcao}`, ok: m.fpl.dep === m.depIcao && m.fpl.dest === m.destIcao });
  // 지도: 좌표가 있는 양식이면 모든 지점에 좌표가 있어야
  if (nl.length && m.src !== 'OZ-DOM' && !m.navlogEst) add('map', 'navCoords', nl.filter((r) => r.lat != null && r.lon != null).length, nl.length, 0, 'n');
  if (m.generic?.navlog?.total) add('map', 'routeFound', m.generic.navlog.resolved, m.generic.navlog.total, 0, 'n'); // 범용: FPL 경로 지점 중 본문에서 좌표를 찾은 수
  // 노탐: 원문 머리 줄 수 = 파싱된 아이템 수
  const hdr = countNotamHeaders(raw);
  if (hdr) add('notam', 'notamCount', m._notam?.items.length ?? 0, hdr, 0, 'n');
  return out;
}
