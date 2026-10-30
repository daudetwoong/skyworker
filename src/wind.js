// 활주로별 정풍/배풍·측풍 성분 계산 — METAR 바람은 진방위, 활주로 번호는 자방위이므로 자편차(var)로 변환
export function runwayWind(rwys, magVar, wdirTrue, wspd, wgst) {
  if (wdirTrue == null || wdirTrue === 'VRB' || !wspd) return null;
  const spd = wgst || wspd;
  return rwys.map((rwy) => {
    const num = parseInt(rwy, 10);
    if (!num) return null;
    const magHdg = (num % 36) * 10 || 360;
    const trueHdg = ((magHdg + magVar) % 360 + 360) % 360;
    const diff = ((wdirTrue - trueHdg) % 360 + 360) % 360;
    const rad = (diff * Math.PI) / 180;
    const head = Math.round(spd * Math.cos(rad));
    const cross = Math.round(spd * Math.sin(rad));
    return {
      rwy,
      head,                       // +정풍 / -배풍
      cross: Math.abs(cross),     // 측풍 크기
      side: cross > 0 ? 'R' : cross < 0 ? 'L' : '',  // 바람이 오는 쪽
      steady: { head: Math.round(wspd * Math.cos(rad)), cross: Math.abs(Math.round(wspd * Math.sin(rad))) },
    };
  }).filter(Boolean).sort((a, b) => b.head - a.head);
}
