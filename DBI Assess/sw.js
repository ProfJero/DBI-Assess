/* DBI Assess service worker: keeps the app working with weak or no internet.
 * Pages: network first (so updates arrive), falling back to the saved copy.
 * Scripts, styles, fonts and images: served from cache, refreshed in the background.
 * API calls to the Worker are never cached. */
const VERSION = 'dbi-assess-v2.0.0';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'shared/ui.css',
  'shared/config.js',
  'shared/core.js',
  'shared/grading.js',
  'shared/exam.css',
  'shared/exam.js',
  'shared/integrity.js',
  'images/DBI-Official-Logo.png',
  'images/emblem.png',
  'images/icon-192.png',
  'student/dashboard.html',
  'student/assessments.html',
  'student/take-assessment.html',
  'student/results.html',
  'student/result-detail.html',
  'student/profile.html',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js',
];
const CDN = /^https:\/\/(www\.gstatic\.com\/firebasejs|fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com|res\.cloudinary\.com)\//;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) =>
      // Cache what we can; one missing file must not stop the rest.
      Promise.all(SHELL.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => null))),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !CDN.test(req.url)) return; // API, Firestore and auth go straight to the network

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html'))),
    );
    return;
  }

  event.respondWith(
    caches.match(req, { ignoreSearch: sameOrigin }).then((hit) => {
      const refresh = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) caches.open(VERSION).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => hit || Response.error());
      return hit || refresh;
    }),
  );
});

// Lets a page ask the worker to try uploading pending exams (Background Sync where supported).
self.addEventListener('sync', (event) => {
  if (event.tag === 'dbi-upload') {
    event.waitUntil(self.clients.matchAll().then((clients) => clients.forEach((c) => c.postMessage({ type: 'dbi-upload' }))));
  }
});
