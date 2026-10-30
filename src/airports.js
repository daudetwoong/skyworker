// 시작 공항 DB + 사용자 목록 관리 — 활주로 번호는 자방위(번호×10), var는 자편차(동+/서-), 확신 없는 공항은 활주로 비움 (R7)
export const DB = {
  RKSI: { name: '인천', lat: 37.469, lon: 126.451, var: -8, rwys: ['15L', '33R', '15R', '33L', '16L', '34R', '16R', '34L'] },
  RKSS: { name: '김포', lat: 37.558, lon: 126.791, var: -8, rwys: ['14L', '32R', '14R', '32L'] },
  RKPC: { name: '제주', lat: 33.511, lon: 126.493, var: -8, rwys: ['07', '25'] },
  RKPK: { name: '김해', lat: 35.179, lon: 128.938, var: -8, rwys: ['18L', '36R', '18R', '36L'] },
  RKTN: { name: '대구', lat: 35.894, lon: 128.659, var: -8, rwys: [] },
  VHHH: { name: '홍콩', lat: 22.309, lon: 113.915, var: -3, rwys: ['07L', '25R', '07C', '25C', '07R', '25L'] },
  RJBB: { name: '간사이', lat: 34.427, lon: 135.244, var: -7, rwys: ['06L', '24R', '06R', '24L'] },
  VVDN: { name: '다낭', lat: 16.044, lon: 108.199, var: -1, rwys: ['17L', '35R', '17R', '35L'] },
  VVTS: { name: '호치민', lat: 10.819, lon: 106.652, var: 0, rwys: ['07L', '25R', '07R', '25L'] },
  ZSPD: { name: '푸동', lat: 31.143, lon: 121.805, var: -6, rwys: [] },
};

const KEY = 'ft_airports';
const RWY_KEY = 'ft_rwys';
const DEFAULT_LIST = ['RKSI', 'RKSS', 'RKPC', 'RKPK'];

function storage() {
  try { return window.localStorage; } catch { return null; }
}

export function getList() {
  const s = storage();
  try { const v = JSON.parse(s?.getItem(KEY) || 'null'); if (Array.isArray(v) && v.length) return v; } catch {}
  return [...DEFAULT_LIST];
}
export function saveList(list) { storage()?.setItem(KEY, JSON.stringify(list)); }
export function addAirport(icao) {
  icao = icao.trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(icao)) return null;
  const list = getList();
  if (!list.includes(icao)) { list.push(icao); saveList(list); }
  return icao;
}
export function removeAirport(icao) { saveList(getList().filter((a) => a !== icao)); }

// 사용자가 입력한 활주로 번호 (DB에 없는 공항용)
export function getUserRwys(icao) {
  try { return JSON.parse(storage()?.getItem(RWY_KEY) || '{}')[icao] || null; } catch { return null; }
}
export function saveUserRwys(icao, rwys) {
  const s = storage(); if (!s) return;
  let all = {}; try { all = JSON.parse(s.getItem(RWY_KEY) || '{}'); } catch {}
  all[icao] = rwys; s.setItem(RWY_KEY, JSON.stringify(all));
}
export function airportInfo(icao, apiData) {
  const base = DB[icao] || {};
  const userRwys = getUserRwys(icao);
  return {
    icao,
    name: base.name || apiData?.name?.split(',')[0] || icao,
    lat: base.lat ?? apiData?.lat ?? null,
    lon: base.lon ?? apiData?.lon ?? null,
    var: base.var ?? 0,
    rwys: userRwys || base.rwys || [],
  };
}
