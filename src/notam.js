// 브리핑 PDF 안의 NOTAM 패키지 파서 + 한국어 해설(약어 사전·한줄 요약·유효시간 판정·좌표 추출). 전부 기기 안 처리(R4)
const MON = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };

export function notamTs(s) {
  const m = String(s || '').match(/(\d{2})([A-Z]{3})(\d{2})\s+(\d{2}):(\d{2})/);
  if (!m || MON[m[2]] == null) return null;
  return Date.UTC(2000 + +m[3], MON[m[2]], +m[1], +m[4], +m[5]);
}

// ── 패키지 파싱 ─────────────────────────────────────────
export function parseNotamPackage(text) {
  const lines = text.replace(/\r/g, '').split('\n');
  let start = lines.findIndex((l) => /^\s*NOTAM\s+PACKAGE\s*\d/.test(l));
  if (start < 0) return null;
  const sections = [];
  let sec = null, cat = null, cur = null;
  const flush = () => { if (cur) { finalize(cur); sec.items.push(cur); cur = null; } };
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { if (cur) cur.lines.push(''); continue; }
    if (/^\s*Page\s+\d+\s*$/.test(line) || /^\s*Page\s*-\s*\d+\s+of\s+\d+/.test(line) || /PRINTED AT/.test(line) || /^\s*NOTAM\s+PACKAGE\s*\d/.test(line) || /^\s*END OF NOTAM\s+PACKAGE/.test(line) || /^\s*DEP:\s*[A-Z]{4}\s+DEST:/.test(line) || /^\s*FIR:\s*[A-Z]{4}/.test(line)) continue;
    const secM = line.match(/^\s*\[(DEP|DEST|ALTN|ERA|FIR)\]\s*([A-Z]{4})\/?\s*(.*)$/);
    if (secM) {
      flush();
      sec = { kind: secM[1], icao: secM[2], name: secM[3].replace(/^\s*[A-Z]{3}\/\s*/, '').trim(), info: [], items: [] };
      sections.push(sec);
      cat = null;
      continue;
    }
    if (!sec) continue;
    const catM = line.match(/^\s*◼\s*(.+?)\s*$/);
    if (catM) { flush(); cat = catM[1]; continue; }
    const hdr = line.match(/^\s*(?:\d+\.\s*)?(\d{2}[A-Z]{3}\d{2}\s+\d{2}:\d{2})\s*-\s*(\d{2}[A-Z]{3}\d{2}\s+\d{2}:\d{2}|UFN|PERM|EST)\s+([A-Z]{4})\s+(\S+)\s*$/);
    if (hdr) {
      flush();
      cur = { kind: sec.kind, airport: sec.icao, category: cat || 'OTHER', from: hdr[1], to: hdr[2], icao: hdr[3], id: hdr[4], lines: [] };
      continue;
    }
    if (cur) cur.lines.push(line);
    else if (!cat) sec.info.push(line.trim());
  }
  flush();
  const items = sections.flatMap((s) => s.items);
  return items.length ? { sections, items } : null;
}

function finalize(n) {
  const body = n.lines.join('\n').trim();
  n.raw = body;
  const d = body.match(/(?:^|\n)\s*D\)\s*([^\n]+)/); n.schedule = d ? d[1].trim() : null;
  const e = body.match(/(?:^|\n)\s*E\)\s*([\s\S]*?)(?=\n\s*COMMENT\)|\n\s*[A-G]\)|$)/); n.etext = (e ? e[1] : body).replace(/\s+/g, ' ').trim();
  const c = body.match(/COMMENT\)\s*([^\n]+(?:\n(?!\s*[A-Z]\)).*)*)/); n.comment = c ? c[1].replace(/\s+/g, ' ').trim() : null;
  n.fromMs = notamTs(n.from);
  n.toMs = /UFN|PERM|EST/.test(n.to) ? Infinity : notamTs(n.to);
  n.coords = extractCoords(n.etext);
  delete n.lines;
}

export function extractCoords(text) {
  const out = [];
  const s = String(text || '');
  for (const m of s.matchAll(/(\d{2})(\d{2})(\d{2}(?:\.\d+)?)([NS])\s?(\d{3})(\d{2})(\d{2}(?:\.\d+)?)([EW])/g)) {
    out.push({ lat: (m[4] === 'S' ? -1 : 1) * (+m[1] + +m[2] / 60 + parseFloat(m[3]) / 3600), lon: (m[8] === 'W' ? -1 : 1) * (+m[5] + +m[6] / 60 + parseFloat(m[7]) / 3600) });
  }
  for (const m of s.matchAll(/(?<!\d)(\d{2})(\d{2})([NS])\s?(\d{3})(\d{2})([EW])(?!\d)/g)) {
    out.push({ lat: (m[3] === 'S' ? -1 : 1) * (+m[1] + +m[2] / 60), lon: (m[6] === 'W' ? -1 : 1) * (+m[4] + +m[5] / 60) });
  }
  return out.filter((p) => Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180);
}

export function isActive(n, atMs) {
  if (n.fromMs == null) return true;
  return n.fromMs <= atMs && (n.toMs === Infinity || n.toMs == null || atMs <= n.toMs);
}
// 비행 시간창(ETD~ETA) 안에 한 번이라도 유효한가
export function activeInWindow(n, fromMs, toMs) {
  if (n.fromMs == null) return true;
  const end = n.toMs === Infinity || n.toMs == null ? Infinity : n.toMs;
  return n.fromMs <= toMs && end >= fromMs;
}

// ── 한국어 해설 ─────────────────────────────────────────
export const CAT_KO = {
  'RUNWAY': '활주로', 'TAXIWAY': '유도로', 'RAMP': '계류장·주기장', 'NAVAID': '항법시설', 'APPROACH': '접근절차', 'GPS': 'GPS',
  'AIRWAY': '항로', 'AIRSPACE': '공역', 'OTHER': '기타', 'COMPANY ADVISORY': '회사 공지', 'RUNWAY LIGHT': '활주로 등화',
  'DEPARTURE AIRPORT TECHNICAL INFORMATION': '출발공항 기술정보', 'LIGHTING': '등화', 'OBSTACLE': '장애물', 'COMMUNICATION': '통신',
  'SID/STAR': 'SID/STAR', 'MILITARY': '군 활동', 'DANGER AREA': '위험구역',
};
export const KIND_KO = { DEP: '출발', DEST: '도착', ALTN: '교체', ERA: '항로 교체(ERA)', FIR: 'FIR' };

const ABBR = {
  'CLSD': '폐쇄', 'CLOSED': '폐쇄', 'U/S': '사용 불가(고장)', 'UNSERVICEABLE': '사용 불가', 'AVBL': '사용 가능', 'NOT AVBL': '사용 불가', 'UNAVBL': '사용 불가',
  'OPR': '운영', 'OPS': '운영', 'ACT': '활성', 'ACTIVE': '활성', 'INOP': '작동 불가', 'WIP': '공사 중', 'RESTRICTED': '제한', 'PROHIBITED': '금지',
  'CANCELLED': '취소', 'CNL': '취소', 'CHG': '변경', 'CHANGED': '변경됨', 'REVISED': '개정', 'SUSPENDED': '중단', 'RESUMED': '재개', 'AMENDED': '개정됨',
  'UNRELIABLE': '신뢰 불가', 'INTERFERENCE': '전파 간섭', 'JAMMING': '전파 방해', 'OUTAGE': '장애', 'LIMITATION': '제한사항', 'LIMITED': '제한됨', 'LTD': '제한됨',
  'REQ': '요청', 'RQRD': '필요', 'REQUIRED': '필요', 'APPROVED': '승인', 'PPR': '사전 허가 필요', 'PERMIT': '허가', 'PERMISSION': '허가',
  'EXC': '제외', 'EXCEPT': '제외', 'BTN': '사이', 'BTW': '사이', 'WI': '이내', 'WITHIN': '이내', 'BEYOND': '너머', 'ABV': '이상', 'BLW': '이하',
  'AGL': '지면 기준', 'AMSL': '해수면 기준', 'SFC': '지표면', 'GND': '지면', 'UNL': '고도 제한 없음', 'NM': '해리', 'RADIUS': '반경', 'CENTERED': '중심', 'PSN': '위치',
  'DLY': '매일', 'DAILY': '매일', 'H24': '24시간', 'HJ': '주간', 'HN': '야간', 'PERM': '영구', 'UFN': '추후 통보 시까지', 'TIL': '까지', 'FM': '부터',
  'RWY': '활주로', 'TWY': '유도로', 'TWYS': '유도로들', 'APN': '계류장', 'APRON': '계류장', 'THR': '시단', 'DTHR': '이설 시단', 'TORA': '이륙활주가능거리', 'TODA': '이륙가능거리', 'ASDA': '가속정지가능거리', 'LDA': '착륙가능거리',
  'AD': '비행장', 'STAND': '주기장', 'STANDS': '주기장', 'ACFT': '항공기', 'MAINT': '정비', 'CONST': '공사', 'WORK': '작업', 'IN PROGRESS': '진행 중',
  'PAPI': 'PAPI', 'ALS': '접근등', 'LGT': '등화', 'LIGHTING': '등화', 'EDGE': '가장자리', 'CL': '중심선', 'FRICTION': '마찰', 'BRAKING': '제동',
  'VOR': 'VOR', 'DME': 'DME', 'NDB': 'NDB', 'ILS': 'ILS', 'LOC': 'LOC', 'GP': '활공각', 'GNSS': '위성항법', 'RAIM': 'RAIM', 'RNAV': 'RNAV', 'RNP': 'RNP',
  'IAP': '계기접근절차', 'APCH': '접근', 'SID': 'SID', 'STAR': 'STAR', 'DEP': '출발', 'ARR': '도착', 'MISSED': '복행', 'FREQ': '주파수', 'COM': '통신',
  'CPDLC': 'CPDLC', 'ADS-B': 'ADS-B', 'ADS-C': 'ADS-C', 'SELCAL': 'SELCAL', 'ATIS': 'ATIS', 'RDR': '레이더', 'RADAR': '레이더',
  'ATS': '항공교통업무', 'ATC': '관제', 'ACC': '지역관제소', 'APP': '접근관제', 'TWR': '관제탑', 'FIR': 'FIR', 'CTA': '관제구역', 'TMA': '터미널관제구역',
  'AWY': '항로', 'RTE': '항로', 'ROUTE': '항로', 'DCT': '직항', 'WPT': '웨이포인트', 'FL': 'FL', 'LVL': '고도', 'ALT': '고도', 'RVSM': 'RVSM',
  'TRA': '임시 제한공역', 'TSA': '임시 분리공역', 'DANGER': '위험', 'CTN': '주의', 'CAUTION': '주의', 'ADZ': '권고', 'ADVISED': '권고됨', 'AVOID': '회피',
  'EXPECT': '예상', 'DELAY': '지연', 'REROUTE': '경로 변경', 'TFC': '교통', 'TRAFFIC': '교통', 'FLOW': '교통량 조절', 'ATFM': '교통흐름관리',
  'MIL': '군', 'MILITARY': '군', 'EXER': '훈련', 'EXERCISE': '훈련', 'FRNG': '사격', 'FIRING': '사격', 'MISSILE': '미사일', 'ROCKET': '로켓', 'LAUNCH': '발사',
  'UAS': '무인기', 'UAV': '무인기', 'DRONE': '드론', 'BALLOON': '풍선', 'OBST': '장애물', 'CRANE': '크레인', 'LASER': '레이저', 'VOLCANIC': '화산', 'ASH': '화산재',
  'INFO': '정보', 'REF': '참조', 'DUE TO': '사유:', 'DUE': '사유:', 'AND': '및', 'OR': '또는', 'IAW': '~에 따라', 'TEMPO': '일시', 'TEMPORARY': '임시',
  'NEW': '신규', 'WX': '기상', 'SVC': '업무', 'HR': '시간', 'HRS': '시간', 'MIN': '분', 'COORD': '좌표', 'CONTACT': '교신', 'MAX': '최대', 'MNM': '최저',
  'NML': '정상', 'NORMAL': '정상', 'EMERG': '비상', 'EMERGENCY': '비상', 'ENTRY': '진입', 'EXIT': '이탈', 'CROSSING': '횡단', 'BOUNDARY': '경계',
  'FLW': '다음', 'AS FLW': '다음과 같이', 'DEG': '도', 'RADIAL': '래디얼', 'RADIALS': '래디얼', 'CLOCKWISE': '시계방향', 'SEGMENT': '구간', 'OF': '의',
  'WING SPAN': '날개폭', 'PARKING': '주기', 'NR': '번', 'NO.': '번', 'CODE': '코드', 'N/A': '해당 없음', 'TODC': '이륙성능 계산',
};
const ABBR_KEYS = Object.keys(ABBR).sort((a, b) => b.length - a.length);
const ABBR_RX = new RegExp('(?<![A-Z0-9/])(' + ABBR_KEYS.map((k) => k.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&')).join('|') + ')(?![A-Z0-9/])', 'g');

export function headline(n) {
  const u = String(n.etext || '').toUpperCase();
  const has = (rx) => rx.test(u);
  const bits = [];
  if (has(/\bRWY[^.]{0,40}\bCLSD\b/)) bits.push('활주로 폐쇄');
  else if (has(/\bTWY[^.]{0,60}\bCLSD\b/)) bits.push('유도로 폐쇄');
  else if (has(/\b(STAND|STANDS|PARKING)\b[^.]{0,40}\bCLSD\b/)) bits.push('주기장 폐쇄');
  else if (has(/\bCLSD\b|\bCLOSED\b/)) bits.push('폐쇄');
  if (has(/\b(ILS|LOC|GP)\b[^.]{0,40}(U\/S|NOT AVBL|UNSERVICEABLE|UNAVBL)/)) bits.push('ILS 사용 불가');
  else if (has(/\b(VOR|DME|NDB|TACAN|VORTAC)\b[^.]{0,60}(U\/S|NOT AVBL|UNSERVICEABLE|UNAVBL|LIMITATION)/)) bits.push('항법시설 제한');
  if (has(/GPS|GNSS/) && has(/UNRELIABLE|NOT AVBL|INTERFERENCE|JAMM|UNAVBL|OUTAGE/)) bits.push('GPS 불안정');
  if (has(/\bOBST\b|\bCRANE\b/)) bits.push('장애물');
  if (has(/\bPROHIBITED\b/)) bits.push('금지구역');
  else if (has(/\bRESTRICTED\b|\bDANGER AREA\b/)) bits.push('제한·위험구역');
  if (has(/\bMIL\b|FRNG|FIRING|EXER/)) bits.push('군 훈련/사격');
  if (has(/ROCKET|LAUNCH|SPACE|DEBRIS/)) bits.push('로켓/우주 활동');
  if (has(/\bUAS\b|DRONE|UNMANNED|RPAS/)) bits.push('무인기');
  if (has(/VOLCAN|\bASH\b/)) bits.push('화산');
  if (has(/\b(AWY|ATS RTE|RTE|ROUTE|SEGMENT)\b/) && has(/CLSD|NOT AVBL|SUSPENDED/)) bits.push('항로 사용 제한');
  if (has(/CPDLC|ADS-?C|ADS-?B/) && has(/NOT AVBL|U\/S|OUTAGE|UNAVBL/)) bits.push('데이터링크 장애');
  if (has(/\b(SID|STAR|IAP|APCH)\b/) && has(/NOT AVBL|AMENDED|SUSPENDED|CHG|CHANGED/)) bits.push('출도착·접근절차 변경');
  if (has(/\bFREQ\b[^.]{0,30}(U\/S|NOT AVBL|UNAVBL|CHG)/)) bits.push('주파수 변경/장애');
  if (has(/SIMILAR CALL ?SIGN/)) bits.push('유사 콜사인 주의');
  if (!bits.length) bits.push(CAT_KO[n.category] ? CAT_KO[n.category] + ' 정보' : '일반 정보');
  return [...new Set(bits)].slice(0, 3).join(' · ');
}

export function literalKo(text) {
  return String(text || '').toUpperCase().replace(/\s+/g, ' ').trim().replace(ABBR_RX, (w) => (ABBR[w] && ABBR[w] !== w ? `[${ABBR[w]}]` : w));
}
export function glossary(text) {
  const u = String(text || '').toUpperCase();
  const found = new Map();
  (u.match(ABBR_RX) || []).forEach((w) => { if (!/^(AND|OR|OF|FL|VOR|DME|NDB|ILS|GPS|NM|SID|STAR|FIR|CL)$/.test(w) && ABBR[w] && ABBR[w] !== w) found.set(w, ABBR[w]); });
  return [...found.entries()].slice(0, 14);
}
export function scheduleKo(s) {
  if (!s) return '';
  return String(s).toUpperCase()
    .replace(/\bH24\b/g, '24시간').replace(/\b(DAILY|DLY)\b/g, '매일').replace(/\bEXC\b/g, '제외').replace(/\bSR\b/g, '일출').replace(/\bSS\b/g, '일몰')
    .replace(/\b(MON|TUE|WED|THU|FRI|SAT|SUN)\b/g, (d) => ({ MON: '월', TUE: '화', WED: '수', THU: '목', FRI: '금', SAT: '토', SUN: '일' })[d] + '요일')
    .replace(/\b(\d{2})(\d{2})-(\d{2})(\d{2})\b/g, '$1:$2~$3:$4Z');
}

// 경로와의 거리(해리) — FIR/ERA 노탐 관련도
export function gcDistNm(a, b) {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 3440.065 * Math.asin(Math.sqrt(h));
}
export function routeRelation(n, route) {
  if (!n.coords?.length || !route?.length) return null;
  let best = Infinity;
  for (const p of n.coords) for (const w of route) { const d = gcDistNm(p, w); if (d < best) best = d; }
  return best <= 30 ? 'direct' : best <= 120 ? 'near' : 'far';
}
