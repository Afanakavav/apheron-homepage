// APHERON Service Worker
const CACHE_NAME = 'apheron-v2';
const urlsToCache = [
  'https://afanakavav.github.io/apheron-homepage/',
  'https://afanakavav.github.io/apheron-homepage/index.html',
  'https://afanakavav.github.io/apheron-homepage/styles.css',
  'https://afanakavav.github.io/apheron-homepage/script.js',
  'https://afanakavav.github.io/apheron-homepage/manifest.json',
  'https://afanakavav.github.io/apheron-homepage/logo.svg',
  'https://afanakavav.github.io/apheron-homepage/icon-192-android.png',
  'https://afanakavav.github.io/apheron-homepage/icon-512-android.png',
  'https://afanakavav.github.io/apheron-homepage/apple-touch-icon-180.png',
  'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Manrope:wght@300;400;500;600&display=swap'
];

// Install event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).catch(() => {
          // Return cached index.html for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('https://afanakavav.github.io/apheron-homepage/index.html');
          }
        });
      })
  );
});

// Activate event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
