// Closari Service Worker — network-first (aman, tidak nyimpan JS Next.js basi).
// Hanya cache ikon/manifest sebagai fallback offline. Bump CACHE saat update.
const CACHE = 'closari-v1'
const PRECACHE = ['/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // Network-first. Untuk aset statis di PRECACHE, simpan salinan buat fallback offline.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (PRECACHE.includes(url.pathname)) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
        }
        return res
      })
      .catch(() => caches.match(req))
  )
})
