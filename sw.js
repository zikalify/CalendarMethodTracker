const CACHE_NAME = 'calendar-method-tracker-v10';
const FONT_CACHE_NAME = 'fonts-v2';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './script.js',
  './styles.css',
  './responsive-fix.css',
  './manifest.json',
  './icon-192x192.png',
  './icon-512x512.png'
];

const FONTS_TO_CACHE = [
  'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap',
  'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmSU5fBBc4.woff2',
  'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.woff2'
];

// Install event - cache all assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    Promise.all([
      // Cache main assets
      caches.open(CACHE_NAME).then((cache) => {
        console.log('[SW] Caching app assets');
        return cache.addAll(ASSETS_TO_CACHE);
      }),
      // Cache fonts
      caches.open(FONT_CACHE_NAME).then((cache) => {
        console.log('[SW] Caching fonts');
        return cache.addAll(FONTS_TO_CACHE).catch(err => {
          console.warn('[SW] Some fonts failed to cache:', err);
          // Don't fail installation if fonts fail
          return Promise.resolve();
        });
      })
    ]).then(() => {
      console.log('[SW] Installation complete');
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME && cache !== FONT_CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Activation complete');
      return self.clients.claim();
    })
  );
});

// Fetch event - offline-first strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip non-http(s) requests
  if (!request.url.startsWith('http')) {
    return;
  }

  // Handle favicon requests
  if (request.url.endsWith('/favicon.ico')) {
    event.respondWith(
      caches.match('./icon-192x192.png')
        .then(response => response || new Response(null, { status: 204 }))
    );
    return;
  }

  // Handle font requests - cache first, then network
  if (request.url.includes('fonts.googleapis.com') || request.url.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(request, { cacheName: FONT_CACHE_NAME })
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          return fetch(request).then((response) => {
            if (response && response.status === 200) {
              const responseToCache = response.clone();
              caches.open(FONT_CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
            return response;
          }).catch(() => {
            // Return empty response if offline and not cached
            return new Response('', { status: 200, statusText: 'OK' });
          });
        })
    );
    return;
  }

  // Handle navigation requests (for the app itself)
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html')
        .then(response => {
          if (response) {
            return response;
          }
          return fetch(request).catch(() => {
            return caches.match('./index.html');
          });
        })
    );
    return;
  }

  // For all other requests: Cache first, fall back to network, then fail gracefully
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached version and update cache in background
          fetch(request).then((response) => {
            if (response && response.status === 200 && response.type === 'basic') {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
          }).catch(() => {
            // Network failed, but we already have cached version
          });
          
          return cachedResponse;
        }
        
        // Not in cache, try network
        return fetch(request).then((response) => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Cache the new response
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });

          return response;
        });
      })
      .catch(() => {
        // Both cache and network failed
        console.log('[SW] Failed to fetch:', request.url);
        return new Response('Offline', { 
          status: 503, 
          statusText: 'Service Unavailable' 
        });
      })
  );
});