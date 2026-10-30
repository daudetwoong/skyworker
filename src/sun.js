// NOAA 근사식으로 일출·일몰 UTC 계산 (참고용, ±수 분 오차)
function toJulian(date) { return date.getTime() / 86400000 + 2440587.5; }

export function sunTimes(date, lat, lon) {
  const rad = Math.PI / 180;
  const J = Math.ceil(toJulian(date) - 2451545 - 0.0009 - lon / 360);
  const solarNoonApprox = 2451545 + 0.0009 + J - lon / 360;
  const M = (357.5291 + 0.98560028 * (solarNoonApprox - 2451545)) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const L = (M + C + 180 + 102.9372) % 360;
  const solarNoon = solarNoonApprox + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * L * rad);
  const dec = Math.asin(Math.sin(L * rad) * Math.sin(23.44 * rad));
  const cosH = (Math.sin(-0.83 * rad) - Math.sin(lat * rad) * Math.sin(dec)) / (Math.cos(lat * rad) * Math.cos(dec));
  if (cosH > 1 || cosH < -1) return null; // 백야/극야
  const H = Math.acos(cosH) / rad;
  const jSet = solarNoon + H / 360;
  const jRise = solarNoon - H / 360;
  const fromJ = (j) => new Date((j - 2440587.5) * 86400000);
  return { rise: fromJ(jRise), set: fromJ(jSet) };
}

export function fmtUtcKst(d) {
  const p = (n) => String(n).padStart(2, '0');
  const utc = `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}Z`;
  const k = new Date(d.getTime() + 9 * 3600 * 1000);
  return `${utc} (${p(k.getUTCHours())}:${p(k.getUTCMinutes())} KST)`;
}
