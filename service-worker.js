/**
 * THE MENTOR - Service Worker
 * Enables offline functionality and caching
 */

const CACHE_NAME = 'the-mentor-v2.0.0';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/css/style.css',
    '/css/themes.css',
    '/css/components/sidebar.css',
    '/css/components/viewer.css',
    '/css/components/results.css',
    '/js/app.js',
    '/js/brain-analyzer.js',
    '/js/nifti-viewer.js',
    '/js/model-loader.js',
    '/js/ui-controller.js',
    '/js/utils/file-handler.js',
    '/js/utils/nifti-parser.js',
    '/js/utils/tensor-utils.js',
    '/manifest.json'
];

// External CDN resources to cache
const CDN_ASSETS = [
    'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
    'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.15.0/dist/tf.min.js',
    'https://cdn.jsdelivr.net/npm/nifti-reader-js@0.6.8/release/nifti-reader.min.js',
    'https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching app assets');
                // Cache local assets
                return cache.addAll(ASSETS_TO_CACHE)
                    .catch(err => {
                        console.warn('[SW] Some assets failed to cache:', err);
                    });
            })
            .then(() => {
                // Cache CDN assets separately (may fail due to CORS)
                return caches.open(CACHE_NAME + '-cdn')
                    .then(cache => {
                        return Promise.allSettled(
                            CDN_ASSETS.map(url => 
                                fetch(url, { mode: 'cors' })
                                    .then(response => {
                                        if (response.ok) {
                                            cache.put(url, response);
                                        }
                                    })
                                    .catch(() => {
                                        console.warn('[SW] Could not cache:', url);
                                    })
                            )
                        );
                    });
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((cacheName) => {
                            return cacheName.startsWith('the-mentor-') && 
                                   cacheName !== CACHE_NAME &&
                                   cacheName !== CACHE_NAME + '-cdn';
                        })
                        .map((cacheName) => {
                            console.log('[SW] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }
    
    // Skip Chrome extension requests
    if (url.protocol === 'chrome-extension:') {
        return;
    }
    
    // Handle same-origin requests
    if (url.origin === location.origin) {
        event.respondWith(
            caches.match(event.request)
                .then((cachedResponse) => {
                    if (cachedResponse) {
                        // Return cached response and update cache in background
                        fetchAndCache(event.request);
                        return cachedResponse;
                    }
                    
                    // Not in cache, fetch from network
                    return fetchAndCache(event.request);
                })
                .catch(() => {
                    // Return offline page for navigation requests
                    if (event.request.mode === 'navigate') {
                        return caches.match('/index.html');
                    }
                    return new Response('Offline', { status: 503 });
                })
        );
        return;
    }
    
    // Handle CDN requests - cache first, then network
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                
                return fetch(event.request)
                    .then((response) => {
                        // Cache successful responses
                        if (response.ok) {
                            const responseToCache = response.clone();
                            caches.open(CACHE_NAME + '-cdn')
                                .then((cache) => {
                                    cache.put(event.request, responseToCache);
                                });
                        }
                        return response;
                    });
            })
            .catch(() => {
                console.warn('[SW] Failed to fetch:', event.request.url);
                return new Response('Resource unavailable', { status: 503 });
            })
    );
});

// Helper function to fetch and cache
async function fetchAndCache(request) {
    try {
        const response = await fetch(request);
        
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        
        return response;
    } catch (error) {
        throw error;
    }
}

// Handle messages from main thread
self.addEventListener('message', (event) => {
    if (event.data.action === 'skipWaiting') {
        self.skipWaiting();
    }
    
    if (event.data.action === 'clearCache') {
        caches.keys().then((names) => {
            names.forEach((name) => {
                if (name.startsWith('the-mentor-')) {
                    caches.delete(name);
                }
            });
        });
    }
});

console.log('[SW] Service Worker loaded');


