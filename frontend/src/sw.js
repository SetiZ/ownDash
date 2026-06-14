const CACHE = 'owndash-v1'
const ASSETS = ['/', '/src/style.css', '/src/main.js', '/manifest.json']

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', () => self.clients.claim())

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      const cached = await c.match(e.request)
      const fetched = fetch(e.request)
        .then((r) => { c.put(e.request, r.clone()); return r })
        .catch(() => cached)
      return cached || fetched
    })
  )
})
