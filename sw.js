const CACHE_NAME = 'calendar-method-tracker-v8';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './offline.html',
  './script.js',
  './styles.css',
  './responsive-fix.css',
  './manifest.json',
  './icon-192x192.png',
  './icon-512x512.png'
];

const FONT_CACHE_NAME = 'fonts-v1';
const FONTS_TO_CACHE = [
  'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmSU5fBBc4.woff2',
  'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.woff2'
];

// Install event - cache all static assets and fonts
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => {
        return caches.open(FONT_CACHE_NAME)
          .then((cache) => {
            return cache.addAll(FONTS_TO_CACHE);
          });
      })
  );
  
  // Activate the new service worker immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// Fetch event - serve from cache, falling back to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and non-http(s) requests
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  // Handle favicon.ico requests
  if (event.request.url.endsWith('/favicon.ico')) {
    return event.respondWith(
      caches.match('./icon-192x192.png')
        .then(response => response || new Response(null, { status: 204 }))
    );
  }
  
  // Handle font requests with cache then network strategy
  if (event.request.url.includes('fonts.gstatic.com')) {
    return event.respondWith(
      caches.match(event.request, { cacheName: FONT_CACHE_NAME })
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // If not in cache, fetch from network and cache it
          return fetch(event.request).then((response) => {
            // Don't cache invalid responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response before putting it in cache
            const responseToCache = response.clone();
            
            caches.open(FONT_CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
            
            return response;
          });
        })
    );
  }

  // Handle navigation requests (for SPA)
  if (event.request.mode === 'navigate') {
    return event.respondWith(
      caches.match('./index.html')
        .then(response => response || fetch(event.request))
        .catch(() => caches.match('./offline.html'))
    );
  }

  // For all other requests, try cache first, then network
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached response if found
        if (response) {
          return response;
        }
        
        // Clone the request
        const fetchRequest = event.request.clone();
        
        // Make network request
        return fetch(fetchRequest).then(
          (response) => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            // Cache the response
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
  );
});
