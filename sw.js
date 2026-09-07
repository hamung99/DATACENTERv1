// ====================================================================
//  sw.js — Service Worker sederhana untuk DATACENTER-antiAmbigu
//  Strategi: NETWORK-FIRST untuk SEMUA request (app shell milik sendiri
//  maupun resource eksternal seperti CDN XLSX). Selalu coba ambil versi
//  terbaru dari server dulu selama online; cache cuma dipakai sebagai
//  fallback kalau offline / request ke server gagal.
//
//  Kenapa diganti dari cache-first: dengan cache-first, browser bisa
//  "nyangkut" di file lama setelah kode di-update (index.html/js baru
//  tidak otomatis kepakai, bahkan bisa kecampur versi lama+baru yang
//  saling tidak cocok). Dengan network-first, masalah itu hilang total
//  tanpa perlu ingat menaikkan CACHE_NAME tiap kali deploy.
// ====================================================================

const CACHE_NAME = 'datacenter-shell-v2';

// Daftar file yang di-precache saat install, supaya app tetap bisa
// dibuka walau lagi offline (fallback saja — bukan sumber utama lagi).
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
        caches.keys()
            .then((keys) => Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;

    // Hanya tangani GET; biarkan request lain (POST, dsb) lewat apa adanya.
    if (req.method !== 'GET') return;

    // Network-first untuk semua request: coba ambil dari server dulu,
    // simpan salinannya ke cache kalau berhasil, dan baru jatuh ke cache
    // (kalau ada) saat fetch gagal — misal karena sedang offline.
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
});
