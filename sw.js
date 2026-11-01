// 서비스워커 — 앱 셸 캐시(오프라인 구동). 화면 바뀌는 배포마다 CACHE_VERSION을 올릴 것
const CACHE_VERSION = 'skyworker-v0.12.0';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png',
  'src/style.css', 'src/app.js', 'src/i18n.js', 'src/airports.js', 'src/wx.js', 'src/wind.js', 'src/sun.js', 'src/time.js', 'src/ofp.js', 'src/fltrade.js', 'src/pdfread.js', 'src/notam.js', 'src/verify.js', 'src/storage.js', 'src/sigmet.js', 'src/generic.js', 'src/fpl.js', 'src/map.js', 'vendor/pdf.min.mjs', 'vendor/pdf.worker.min.mjs', 'vendor/coastline.json', 'vendor/leaflet.js', 'vendor/leaflet.css',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// 페이지의 '오프라인 실행 준비' 점검용: 현재 버전과 셸 목록을 알려준다
self.addEventListener('message', (e) => {
  if (e.data?.type === 'shell' && e.ports?.[0]) e.ports[0].postMessage({ version: CACHE_VERSION, files: SHELL.filter((f) => f !== './') });
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // 기상 API는 앱 코드(localStorage 스냅샷)가 오프라인 처리
  if (e.request.mode === 'navigate') {
    // 첫 화면은 network-first — 배포 즉시 반영, 오프라인이면 캐시
    e.respondWith(
      fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match(e.request).then((hit) => hit || caches.match('./')))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE_VERSION).then((c) => c.put(e.request, copy));
      return res;
    }))
  );
});
