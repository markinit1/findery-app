// Firebase Messaging lives in this same service worker (rather than a
// separate firebase-messaging-sw.js) so there's only one SW controlling the
// page — no conflict between offline caching and background push handling.
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyA2q3pgL0w4pzzbSG36VV9p-uE_WDnlBEI",
  authDomain: "findery-app.firebaseapp.com",
  projectId: "findery-app",
  storageBucket: "findery-app.firebasestorage.app",
  messagingSenderId: "131613744643",
  appId: "1:131613744643:web:186db4c75ced7199e33836"
});

// No onBackgroundMessage handler here on purpose — messages sent with a
// "notification" payload (which is what the Cloud Function sends) are
// displayed automatically by FCM. Adding a manual handler here as well
// would show every price-drop alert twice.
firebase.messaging();

const CACHE_NAME = 'findery-shell-v17';
const APP_SHELL = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/splash.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first everywhere: always try to get the freshest file when online,
// and only fall back to the cached copy if the network request fails
// (offline, or a flaky connection). This avoids serving stale app files
// after a deploy — the tradeoff is it relies on the network when available,
// but for an app that's actively being updated that's the right tradeoff.
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request))
  );
});
