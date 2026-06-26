// Closari SW — KILL SWITCH.
// Tujuan: buang service worker & cache lama yang bikin browser nyajiin versi basi
// (penyebab umum "udah deploy tapi masih keliatan loading/versi lama").
// SW ini TIDAK nge-cache apa pun & TIDAK intercept request.
self.addEventListener('install', () => { self.skipWaiting() })
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    } catch (e) {}
    await self.clients.claim()
    try { await self.registration.unregister() } catch (e) {}
    const clients = await self.clients.matchAll({ type: 'window' })
    for (const c of clients) { try { c.navigate(c.url) } catch (e) {} }
  })())
})
