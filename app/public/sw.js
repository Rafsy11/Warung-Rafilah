const CACHE_NAME = 'warung-pos-v2';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('warung-pos-') && key !== CACHE_NAME).map(key => caches.delete(key)))));
  self.clients.claim();
});
// Internet outages are supported by the local server. No offline payment queue:
// checkout must be acknowledged by the server or recovered using its stable ID.
