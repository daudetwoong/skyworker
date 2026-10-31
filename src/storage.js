// 기기 저장 지키기 — 영구 저장 요청과 상태 점검(홈 화면 설치·오프라인 앱 파일·저장 가능 여부). 서버로 아무것도 보내지 않는다(R4)

export function isStandalone() {
  try { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch { return false; }
}
export function isIOS() {
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1); // iPadOS는 맥으로 위장
}
export function localStorageWritable() {
  try { const k = '__sw_probe'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; } catch { return false; }
}

// 영구 저장 요청: true=허용, false=거절(브라우저가 지울 수 있음), null=지원 안 함
// Firefox는 이 호출에 허락 창을 띄우므로 사용자 동작(PDF 올리기) 뒤에만 부른다
export async function requestPersist() {
  if (!navigator.storage?.persist) return null;
  try { return (await navigator.storage.persisted()) || (await navigator.storage.persist()); } catch { return null; }
}
export async function persistedNow() {
  if (!navigator.storage?.persisted) return null;
  try { return await navigator.storage.persisted(); } catch { return null; }
}

// 오프라인 준비: 지금 이 페이지를 제어하는 서비스워커에게 버전과 셸 파일 목록을 물어, 그 캐시에 전부 있는지 확인
function askShell(timeoutMs = 2000) {
  const ctl = navigator.serviceWorker?.controller;
  if (!ctl) return Promise.resolve(null);
  return new Promise((resolve) => {
    const ch = new MessageChannel();
    const timer = setTimeout(() => resolve(null), timeoutMs);
    ch.port1.onmessage = (e) => { clearTimeout(timer); resolve(e.data); };
    ctl.postMessage({ type: 'shell' }, [ch.port2]);
  });
}
export async function offlineStatus() {
  if (!('caches' in window) || !('serviceWorker' in navigator)) return { ok: null };
  try {
    const info = await askShell();
    if (!info?.version || !info.files?.length) return { ok: false, version: null, missing: null }; // 아직 SW가 이 페이지를 제어하지 않음 → 새로고침 필요
    const c = await caches.open(info.version);
    const base = new URL('./', location.href);
    let missing = 0;
    for (const f of info.files) if (!(await c.match(new URL(f, base).href))) missing++;
    return { ok: missing === 0, version: info.version.replace(/^skyworker-/, ''), missing };
  } catch { return { ok: null }; }
}

export async function storageStatus() {
  const [persisted, offline] = await Promise.all([persistedNow(), offlineStatus()]);
  return { persisted, offline, standalone: isStandalone(), ios: isIOS(), writable: localStorageWritable() };
}
