// FL 트레이드 — OFP 바람 매트릭스로 고도별 순항시간·ETA 차이 계산 (시간만, 연료는 추세·참고용 R3)
const A_SOUND = 38.967; // kt per sqrt(K)

function tailComp(windDir, windSpd, track) {
  return -windSpd * Math.cos(((windDir - track) * Math.PI) / 180);
}

// model: parseOFP 결과. 반환: {levels:[{fl,timeMin,dMin,avgComp,avgTemp,isPlanned}], mach, cruiseDist, plannedLevelFl, computedPlannedMin}
export function flTrade(model) {
  if (model?.windMatrix?.type === 'cfp') return flTradeCfp(model);
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

// CFP 매트릭스: FL별 바람성분·온도가 웨이포인트마다 미리 계산돼 있음 → 직접 합산
function flTradeCfp(model) {
  const { navlog, windMatrix, plannedFL } = model;
  if (!navlog?.length || !windMatrix?.byPoint?.size) return null;
  const tocIdx = navlog.findIndex((r) => r.point === 'TOC');
  const todIdx = navlog.findIndex((r) => r.point === 'TOD');
  if (tocIdx < 0 || todIdx <= tocIdx) return null;
  const segs = navlog.slice(tocIdx + 1, todIdx + 1).filter((r) => r.dist > 0);
  if (!segs.length) return null;

  // 순항 구간에서 실제로 데이터가 있는 레벨만 (ALTN/2차플랜 매트릭스 혼입 차단)
  const cover = {};
  for (const lv of windMatrix.levels) {
    cover[lv] = segs.filter((s) => windMatrix.byPoint.get(s.point)?.[lv]).length;
  }
  const need = Math.max(3, Math.floor(segs.length * 0.5));
  const levels = windMatrix.levels.filter((lv) => cover[lv] >= need);
  if (!levels.length) return null;

  // 마하: TAS 있는 구간의 계획 FL 온도로 역산한 값들의 중앙값 (추출 글리치 행 내성)
  const pLv = levels.reduce((a, b) => Math.abs(b - (plannedFL || 350)) < Math.abs(a - (plannedFL || 350)) ? b : a);
  const machs = [];
  for (const s of segs) {
    const e = windMatrix.byPoint.get(s.point)?.[pLv];
    if (s.tas && s.tas > 350 && s.tas < 520 && e) machs.push(s.tas / (A_SOUND * Math.sqrt(273.15 + e.temp)));
  }
  if (!machs.length) return null;
  machs.sort((a, b) => a - b);
  const mach = machs[Math.floor(machs.length / 2)];

  const cruiseDist = segs.reduce((a, s) => a + s.dist, 0);
  const rows = levels.map((lv) => {
    let tMin = 0, compSum = 0, tempSum = 0, bad = false;
    let last = null;
    for (const s of segs) {
      const e = windMatrix.byPoint.get(s.point)?.[lv] || last;
      if (!e) { bad = true; break; }
      last = e;
      const tas = mach * A_SOUND * Math.sqrt(273.15 + e.temp);
      const gs = tas + e.comp;
      if (gs < 60) { bad = true; break; }
      tMin += (s.dist / gs) * 60;
      compSum += e.comp * s.dist;
      tempSum += e.temp * s.dist;
    }
    return bad ? null : {
      fl: lv, timeMin: tMin,
      avgComp: Math.round(compSum / cruiseDist),
      avgTemp: Math.round(tempSum / cruiseDist),
      isPlanned: lv === pLv,
    };
  }).filter(Boolean);
  const planned = rows.find((x) => x.isPlanned);
  if (!planned) return null;
  rows.forEach((x) => { x.dMin = Math.round(x.timeMin - planned.timeMin); });
  return { levels: rows, mach: Math.round(mach * 1000) / 1000, cruiseDist, plannedLevelFl: planned.fl, computedPlannedMin: Math.round(planned.timeMin) };
}
