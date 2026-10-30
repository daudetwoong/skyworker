// FL 트레이드 — OFP 바람 매트릭스로 고도별 순항시간·ETA 차이 계산 (시간만, 연료는 추세·참고용 R3)
const A_SOUND = 38.967; // kt per sqrt(K)

function tailComp(windDir, windSpd, track) {
  return -windSpd * Math.cos(((windDir - track) * Math.PI) / 180);
}

// model: parseOFP 결과. 반환: {levels:[{fl,timeMin,dMin,avgComp,avgTemp,isPlanned}], mach, cruiseDist, plannedLevelFl, computedPlannedMin}
export function flTrade(model) {
  const { navlog, windMatrix, plannedFL } = model;
  if (!navlog?.length || !windMatrix?.rows?.length) return null;
  const tocIdx = navlog.findIndex((r) => r.point === 'TOC');
  const todIdx = navlog.findIndex((r) => r.point === 'TOD');
  if (tocIdx < 0 || todIdx <= tocIdx) return null;

  const segs = navlog.slice(tocIdx + 1, todIdx + 1).filter((r) => r.dist > 0);
  if (!segs.length) return null;
  const byPoint = new Map(windMatrix.rows.map((r) => [r.point, r.winds]));
  const L = windMatrix.levels;

  // 계획 FL에 가장 가까운 매트릭스 레벨
  const plannedFt = (plannedFL || 310) * 100;
  let pIdx = 0;
  L.forEach((lv, i) => { if (Math.abs(lv - plannedFt) < Math.abs(L[pIdx] - plannedFt)) pIdx = i; });

  // 마하 역산: TAS 있는 구간의 (TAS, 그 지점 계획레벨 온도) 평균
  let mach = 0, n = 0;
  let lastW = byPoint.get('TOC') || windMatrix.rows[0].winds;
  for (const s of segs) {
    if (byPoint.has(s.point)) lastW = byPoint.get(s.point);
    if (s.tas && typeof s.fl === 'number') {
      let li = 0;
      L.forEach((lv, i) => { if (Math.abs(lv - s.fl * 100) < Math.abs(L[li] - s.fl * 100)) li = i; });
      mach += s.tas / (A_SOUND * Math.sqrt(273.15 + lastW[li].temp));
      n++;
    }
  }
  if (!n) return null;
  mach /= n;

  const cruiseDist = segs.reduce((a, s) => a + s.dist, 0);
  const levels = L.map((lv, i) => {
    let tMin = 0, compSum = 0, tempSum = 0, bad = false;
    let w = byPoint.get('TOC') || windMatrix.rows[0].winds;
    for (const s of segs) {
      if (byPoint.has(s.point)) w = byPoint.get(s.point);
      const track = s.tc ?? s.mc;
      const comp = tailComp(w[i].dir, w[i].spd, track);
      const tas = mach * A_SOUND * Math.sqrt(273.15 + w[i].temp);
      const gs = tas + comp;
      if (gs < 60) { bad = true; break; }
      tMin += (s.dist / gs) * 60;
      compSum += comp * s.dist;
      tempSum += w[i].temp * s.dist;
    }
    return bad ? null : {
      fl: Math.round(lv / 100),
      timeMin: tMin,
      avgComp: Math.round(compSum / cruiseDist),
      avgTemp: Math.round(tempSum / cruiseDist),
      isPlanned: i === pIdx,
    };
  }).filter(Boolean);

  const planned = levels.find((x) => x.isPlanned);
  if (!planned) return null;
  levels.forEach((x) => { x.dMin = Math.round(x.timeMin - planned.timeMin); });
  return { levels, mach: Math.round(mach * 1000) / 1000, cruiseDist, plannedLevelFl: planned.fl, computedPlannedMin: Math.round(planned.timeMin) };
}
