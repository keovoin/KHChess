/* KHChess PWA service worker: app-shell + static asset caching.
 * Network-first for navigation (offline fallback to cached shell),
 * cache-first for static assets. Never touches /api or /ws. */
const CACHE = 'khchess-v1'
const SHELL = ['/', '/index.html', '/manifest.webmanifest']

const STATIC_PREFIXES = [
  '/assets/',
  '/pwa-',
  '/apple-touch-icon',
  '/chess/',
  '/avatars/',
  '/sounds/',
  '/login/',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws')) return

  // Navigation: network-first, fall back to cached app shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('/index.html', copy))
          return res
        })
        .catch(() => caches.match('/index.html'))
    )
    return
  }

  // Static assets: cache-first, backfill on miss.
  const isStatic = STATIC_PREFIXES.some((p) => url.pathname.startsWith(p))
  if (!isStatic) return

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(request, copy))
          }
          return res
        })
    )
  )
})
