// 전역 시간 표시(Z/L) — L은 공항 로컬(OFP 오프셋 > DB tz > 기기), 모든 시각 표기는 이 모듈을 거친다
let pref = 'Z'; // 'Z' | 'L'
try { pref = localStorage.getItem('sw_timefmt') === 'L' ? 'L' : 'Z'; } catch {}

export function timePref() { return pref; }
export function toggleTimePref() {
  pref = pref === 'Z' ? 'L' : 'Z';
  try { localStorage.setItem('sw_timefmt', pref); } catch {}
  return pref;
}

const p2 = (n) => String(n).padStart(2, '0');

// IANA tz → 특정 시각의 UTC 오프셋(분)
export function tzOffsetMin(tz, date = new Date()) {
  try {
    const s = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
      .formatToParts(date).find((x) => x.type === 'timeZoneName')?.value || '';
    const m = s.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (!m) return 0;
    return (m[1] === '-' ? -1 : 1) * (parseInt(m[2], 10) * 60 + (m[3] ? parseInt(m[3], 10) : 0));
  } catch { return null; }
}

// Date → "HH:MM" (pref 반영). offsetMin: 공항 로컬 오프셋(분), null이면 기기 로컬
export function fmtTime(date, offsetMin) {
  if (!(date instanceof Date) || isNaN(date)) return '—';
  if (pref === 'Z') return `${p2(date.getUTCHours())}:${p2(date.getUTCMinutes())}Z`;
  if (offsetMin == null) return `${p2(date.getHours())}:${p2(date.getMinutes())}L`;
  const d = new Date(date.getTime() + offsetMin * 60000);
  return `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}L`;
}

// "HH.MM"(Z 기준, OFP 표기) → 표시 문자열
export function fmtHmZ(hm, offsetMin, baseDate) {
  if (!hm) return '—';
  const m = String(hm).match(/^(\d{1,2})[.:](\d{2})$/);
  if (!m) return String(hm);
  let h = parseInt(m[1], 10), mi = parseInt(m[2], 10);
  if (pref === 'L' && offsetMin != null) {
    const tot = ((h * 60 + mi + offsetMin) % 1440 + 1440) % 1440;
    h = Math.floor(tot / 60); mi = tot % 60;
    return `${p2(h)}:${p2(mi)}L`;
  }
  return `${p2(h)}:${p2(mi)}Z`;
}

// 날짜 포함 표기 (타임라인용)
export function fmtDayTime(date, offsetMin) {
  if (!(date instanceof Date) || isNaN(date)) return '—';
  if (pref === 'Z') return `${p2(date.getUTCDate())}일 ${p2(date.getUTCHours())}:${p2(date.getUTCMinutes())}Z`;
  const off = offsetMin == null ? -date.getTimezoneOffset() : offsetMin;
  const d = new Date(date.getTime() + off * 60000);
  return `${p2(d.getUTCDate())}일 ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}L`;
}
