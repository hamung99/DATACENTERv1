// ====================================================================
//  sw.js — Service Worker sederhana untuk DATACENTER-antiAmbigu
//  Strategi: cache-first untuk app shell (file sendiri), network-first
//  untuk request lain (CDN, dll) agar data selalu yang terbaru
//  ketika online, tapi app tetap bisa dibuka saat offline.
// ====================================================================

const CACHE_NAME = 'datacenter-shell-v1';

// Ganti angka versi di atas (v1 -> v2, dst) setiap kali file-file app
// shell di bawah ini diubah, supaya browser mau mengambil versi baru.
const APP_SHELL = [
    './',
    './index.html',
    './manifest.json',
    './js/utils.js',
    './js/db.js',
    './js/excelParser.js',
    './icon-192.png',
    './icon-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_SHELL))
            .catch((err) => console.warn('SW: gagal precache app shell', err))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const req = event.request;

    // Hanya tangani GET; biarkan request lain (POST, dsb) lewat apa adanya.
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    const isSameOrigin = url.origin === self.location.origin;

    if (isSameOrigin) {
        // App shell sendiri: cache-first, lalu update cache di background.
        event.respondWith(
            caches.match(req).then((cached) => {
                const fetchPromise = fetch(req)
                    .then((networkRes) => {
                        if (networkRes && networkRes.ok) {
                            const clone = networkRes.clone();
                            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
                        }
                        return networkRes;
                    })
                    .catch(() => cached);
                return cached || fetchPromise;
            })
        );
    } else {
        // Resource eksternal (CDN XLSX, dll): network-first,
        // fallback ke cache kalau offline dan pernah tersimpan.
        event.respondWith(
            fetch(req)
                .then((networkRes) => {
                    if (networkRes && networkRes.ok) {
                        const clone = networkRes.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
                    }
                    return networkRes;
                })
                .catch(() => caches.match(req))
        );
    }
});