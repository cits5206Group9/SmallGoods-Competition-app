/**
 * Service Worker for Offline Support
 * Handles caching strategies and offline functionality
 */

const CACHE_NAME = 'small-goods-competition-v1';
const CACHE_VERSION = '1.0.0';

// Files to cache immediately (critical resources)
const CRITICAL_CACHE = [
    '/',
    '/admin',
    '/ref',
    '/tc',
    '/athlete',
    '/display',
    '/network',
    '/static/css/base.css',
    '/static/css/layout.css',
    '/static/css/components.css',
    '/static/js/app.js',
    '/static/js/modules/state-manager.js',
    '/static/js/modules/storage.js',
    '/static/js/modules/ui.js',
    '/static/manifest.json'
];

// Files to cache on first access (non-critical resources)
const RUNTIME_CACHE = [
    '/static/css/pages/',
    '/static/js/pages/',
    '/static/js/components/',
    '/static/images/'
];

// API endpoints that should be cached
const API_CACHE = [
    '/api/athletes',
    '/api/queue',
    '/api/leaderboard',
    '/api/competition'
];

// Maximum age for cached data (in milliseconds)
const CACHE_MAX_AGE = {
    static: 7 * 24 * 60 * 60 * 1000,    // 7 days
    api: 30 * 60 * 1000,                 // 30 minutes
    html: 24 * 60 * 60 * 1000            // 24 hours
};

// Install event - cache critical resources
self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Caching critical resources...');
                return cache.addAll(CRITICAL_CACHE);
            })
            .then(() => {
                console.log('Critical resources cached successfully');
                // Force the waiting service worker to become the active service worker
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Failed to cache critical resources:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker activated');
                // Take control of all pages immediately
                return self.clients.claim();
            })
    );
});

// Fetch event - handle all network requests
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests and chrome-extension requests
    if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
        return;
    }
    
    // Handle different types of requests
    if (url.pathname.startsWith('/api/')) {
        // API requests - network first, cache fallback
        event.respondWith(handleAPIRequest(request));
    } else if (url.pathname.startsWith('/static/')) {
        // Static resources - cache first, network fallback
        event.respondWith(handleStaticResource(request));
    } else {
        // HTML pages - network first, cache fallback
        event.respondWith(handlePageRequest(request));
    }
});

/**
 * Handle API requests with network-first strategy
 */
async function handleAPIRequest(request) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    try {
        // Try network first
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // Cache successful responses
            const responseClone = networkResponse.clone();
            await cache.put(request, responseClone);
            
            // Add timestamp for cache invalidation
            const timestampResponse = new Response(
                JSON.stringify({
                    ...await networkResponse.clone().json(),
                    _cached_at: Date.now()
                }),
                {
                    status: networkResponse.status,
                    statusText: networkResponse.statusText,
                    headers: networkResponse.headers
                }
            );
            
            await cache.put(request, timestampResponse.clone());
            return networkResponse;
        }
        
        // If network response is not ok, fall back to cache
        throw new Error(`Network response not ok: ${networkResponse.status}`);
        
    } catch (error) {
        console.log('Network request failed, trying cache:', error.message);
        
        if (cachedResponse) {
            // Check if cached data is still valid
            const cachedData = await cachedResponse.json();
            const cachedAt = cachedData._cached_at;
            const now = Date.now();
            
            if (cachedAt && (now - cachedAt < CACHE_MAX_AGE.api)) {
                console.log('Serving fresh cached API response');
                return cachedResponse;
            } else {
                console.log('Cached API response is stale, serving anyway (offline)');
                return cachedResponse;
            }
        }
        
        // No cache available, return offline response
        return createOfflineResponse('API data not available offline');
    }
}

/**
 * Handle static resources with cache-first strategy
 */
async function handleStaticResource(request) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
        // Serve from cache immediately
        console.log('Serving cached static resource:', request.url);
        
        // Update cache in background if online
        if (navigator.onLine) {
            updateCacheInBackground(request, cache);
        }
        
        return cachedResponse;
    }
    
    try {
        // Not in cache, try network
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // Cache the response
            const responseClone = networkResponse.clone();
            await cache.put(request, responseClone);
            console.log('Cached new static resource:', request.url);
        }
        
        return networkResponse;
        
    } catch (error) {
        console.error('Failed to fetch static resource:', error);
        
        // Return offline fallback for images
        if (request.destination === 'image') {
            return createOfflineFallbackImage();
        }
        
        return createOfflineResponse('Resource not available offline');
    }
}

/**
 * Handle page requests with network-first strategy
 */
async function handlePageRequest(request) {
    const cache = await caches.open(CACHE_NAME);
    
    try {
        // Try network first
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // Cache successful HTML responses
            const responseClone = networkResponse.clone();
            await cache.put(request, responseClone);
            console.log('Cached page response:', request.url);
        }
        
        return networkResponse;
        
    } catch (error) {
        console.log('Network request failed for page, trying cache:', error.message);
        
        // Try to serve from cache
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
            console.log('Serving cached page:', request.url);
            return cachedResponse;
        }
        
        // No cached version, try to serve a generic offline page
        const offlinePage = await cache.match('/');
        if (offlinePage) {
            console.log('Serving offline fallback page');
            return offlinePage;
        }
        
        return createOfflineResponse('Page not available offline');
    }
}

/**
 * Update cache in background without blocking the response
 */
async function updateCacheInBackground(request, cache) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            await cache.put(request, networkResponse);
            console.log('Background cache update completed for:', request.url);
        }
    } catch (error) {
        console.log('Background cache update failed:', error.message);
    }
}

/**
 * Create offline response
 */
function createOfflineResponse(message) {
    return new Response(
        JSON.stringify({
            error: 'Offline',
            message: message,
            offline: true,
            timestamp: new Date().toISOString()
        }),
        {
            status: 503,
            statusText: 'Service Unavailable',
            headers: {
                'Content-Type': 'application/json'
            }
        }
    );
}

/**
 * Create offline fallback image (1x1 transparent pixel)
 */
function createOfflineFallbackImage() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1">
        <rect width="1" height="1" fill="transparent"/>
    </svg>`;
    
    return new Response(svg, {
        headers: {
            'Content-Type': 'image/svg+xml',
            'Cache-Control': 'no-cache'
        }
    });
}

// Message handling for cache management
self.addEventListener('message', (event) => {
    const { action, data } = event.data;
    
    switch (action) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
            
        case 'CACHE_DATA':
            // Cache specific data from the client
            cacheClientData(data).then(() => {
                event.ports[0].postMessage({ success: true });
            }).catch((error) => {
                event.ports[0].postMessage({ success: false, error: error.message });
            });
            break;
            
        case 'CLEAR_CACHE':
            // Clear all caches
            clearAllCaches().then(() => {
                event.ports[0].postMessage({ success: true });
            }).catch((error) => {
                event.ports[0].postMessage({ success: false, error: error.message });
            });
            break;
            
        case 'GET_CACHE_STATUS':
            getCacheStatus().then((status) => {
                event.ports[0].postMessage({ success: true, data: status });
            }).catch((error) => {
                event.ports[0].postMessage({ success: false, error: error.message });
            });
            break;
    }
});

/**
 * Cache data sent from client
 */
async function cacheClientData(data) {
    const cache = await caches.open(CACHE_NAME);
    const response = new Response(JSON.stringify(data), {
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'max-age=3600' // 1 hour
        }
    });
    
    await cache.put('/offline-data', response);
    console.log('Client data cached successfully');
}

/**
 * Clear all caches
 */
async function clearAllCaches() {
    const cacheNames = await caches.keys();
    await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
    );
    console.log('All caches cleared');
}

/**
 * Get cache status information
 */
async function getCacheStatus() {
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    
    const status = {
        cacheName: CACHE_NAME,
        version: CACHE_VERSION,
        totalCachedItems: requests.length,
        cachedUrls: requests.map(req => req.url),
        lastUpdated: new Date().toISOString()
    };
    
    return status;
}

// Periodic cache cleanup (runs when service worker starts)
self.addEventListener('activate', () => {
    // Clean up old cache entries
    cleanupOldCacheEntries();
});

/**
 * Clean up old cache entries to prevent storage bloat
 */
async function cleanupOldCacheEntries() {
    try {
        const cache = await caches.open(CACHE_NAME);
        const requests = await cache.keys();
        
        const now = Date.now();
        const cleanupPromises = [];
        
        for (const request of requests) {
            const response = await cache.match(request);
            if (response) {
                const cachedData = await response.clone().text();
                
                try {
                    const parsed = JSON.parse(cachedData);
                    if (parsed._cached_at) {
                        const age = now - parsed._cached_at;
                        const maxAge = request.url.includes('/api/') ? 
                            CACHE_MAX_AGE.api : CACHE_MAX_AGE.static;
                        
                        if (age > maxAge) {
                            console.log('Removing stale cache entry:', request.url);
                            cleanupPromises.push(cache.delete(request));
                        }
                    }
                } catch (e) {
                    // Not JSON, skip cleanup check
                }
            }
        }
        
        await Promise.all(cleanupPromises);
        console.log(`Cleaned up ${cleanupPromises.length} stale cache entries`);
        
    } catch (error) {
        console.error('Cache cleanup failed:', error);
    }
}

console.log('Service Worker loaded successfully');