// OFP 자체 검산 — OFP 안의 숫자끼리 맞는지 대조해 "파서가 제대로 읽었나"를 카드별 ✓/⚠로 알린다 (외부 자료 없이, R2·R4)
import { countNotamHeaders } from './notam.js';

const hm = (s) => { const m = String(s || '').match(/(\d{1,2})[.:](\d{2})/); return m ? +m[1] * 60 + +m[2] : null; };
// 반환: [{ card, key, ok: true|false, a, b, unit }] — a=계산값, b=OFP 기재값. 대조 재료가 없으면 항목 자체를 넣지 않는다
export function verifyModel(m, raw) {
  const out = [];
  const add = (card, key, a, b, tol, unit) => { if (a == null || b == null || Number.isNaN(a) || Number.isNaN(b)) return; out.push({ card, key, a, b, unit, ok: Math.abs(a - b) <= tol }); };
  const F = m.fuel || {}, v = (k) => F[k]?.v, W = m.weights || {};
  // 연료표: 100lbs 단위 반올림이라 4항 합은 ±2, 2항 합은 ±1 허용
  if (v('trip') != null && v('frsv') != null && v('rqrd') != null) add('fuel', 'fuelRqrd', v('trip') + (v('cont') || 0) + (v('altn') || 0) + v('frsv'), v('rqrd'), 2, 'lbs100');
  if (v('rqrd') != null && v('tkof') != null) add('fuel', 'fuelTkof', v('rqrd') + (v('extra') || 0), v('tkof'), 1, 'lbs100');
  if (v('tkof') != null && v('ramp') != null && v('taxi') != null) add('fuel', 'fuelRamp', v('tkof') + v('taxi'), v('ramp'), 1, 'lbs100'); // TAXI 줄이 없는 양식이면 생략
  if (W.zfw != null && v('tkof') != null) add('fuel', 'wtTow', W.zfw + v('tkof'), W.tow, 2, 'lbs100');
  if (W.tow != null && v('trip') != null) add('fuel', 'wtLdw', W.tow - v('trip'), W.ldw, 2, 'lbs100');
  // 시간: FPL 총 EET = TRIP 시간, 항법로그 마지막 누적시간 = TRIP 시간
  const trip = hm(F.trip?.time);
  if (m.eetTotal != null) add('summary', 'eetTrip', m.eetTotal, trip, 2, 'min');
  const nl = m.navlog || [];
  const last = [...nl].reverse().find((r) => r.accMin != null);
  if (last && trip != null) add('timeline', 'navEnd', last.accMin, trip, 3, 'min');
  if (m.etdDate && m.etaDate && trip != null) { const blk = Math.round((m.etaDate - m.etdDate) / 60000); out.push({ card: 'summary', key: 'blockTrip', a: blk, b: trip, unit: 'min', ok: blk >= trip - 2 && blk <= trip + 60 }); }
  // 출도착: OFP 머리 ↔ ATC FPL
  if (m.fpl?.dep && m.depIcao && m.src !== 'ICAO-FPL') out.push({ card: 'summary', key: 'fplRoute', a: `${m.fpl.dep}-${m.fpl.dest}`, b: `${m.depIcao}-${m.destIcao}`, ok: m.fpl.dep === m.depIcao && m.fpl.dest === m.destIcao });
  // 지도: 좌표가 있는 양식이면 모든 지점에 좌표가 있어야
  if (nl.length && m.src !== 'OZ-DOM') add('map', 'navCoords', nl.filter((r) => r.lat != null && r.lon != null).length, nl.length, 0, 'n');
  // 노탐: 원문 머리 줄 수 = 파싱된 아이템 수
  const hdr = countNotamHeaders(raw);
  if (hdr) add('notam', 'notamCount', m._notam?.items.length ?? 0, hdr, 0, 'n');
  return out;
}
