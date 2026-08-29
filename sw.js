// サービスワーカー: AquaTimer Pro v2
const CACHE_NAME = 'aquatimer-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './css/timer.css',
  './css/history.css',
  './js/app.js',
  './js/timer-engine.js',
  './js/lane-manager.js',
  './js/storage.js',
  './js/exporter.js',
  './js/audio.js'
];

// インストール時に即座にアクティブ化
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// アクティベーション時に古い全キャッシュ（v1等）を完全破棄
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ネットワーク優先（Network First）
// 開発中や更新時は常に最新のファイルをサーバーから取得し、オフライン時のみキャッシュを利用
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
