// 서비스워커 — 앱 셸 캐시(오프라인 구동). 화면 바뀌는 배포마다 CACHE_VERSION을 올릴 것
const CACHE_VERSION = 'ft-v0.1.0';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'src/style.css', 'src/app.js', 'src/i18n.js', 'src/airports.js', 'src/wx.js', 'src/wind.js', 'src/sun.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // 기상 API는 앱 코드(localStorage 스냅샷)가 오프라인 처리
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE_VERSION).then((c) => c.put(e.request, copy));
      return res;
    }))
  );
});
