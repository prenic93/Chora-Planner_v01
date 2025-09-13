// Service Worker per Chora Planner PWA - Versione Offline Completa
const CACHE_NAME = 'chora-planner-v2.1';
const STATIC_CACHE = 'chora-static-v2.1';
const DYNAMIC_CACHE = 'chora-dynamic-v2.1';
const OFFLINE_CACHE = 'chora-offline-v2.1';

// File statici da cachare immediatamente
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icon-32.png',
    './icon-192.png',
    './icon-512.png',
    './assets/css/styles.css',
    './assets/js/app.js',
    './assets/js/modules/storage.js',
    './assets/js/modules/ui.js',
    './assets/js/modules/pdf.js',
    './assets/js/modules/events.js',
    './assets/js/modules/annotations.js',
    './assets/js/modules/pwa.js',
    './assets/js/offline-manager.js' // Nuovo file per la gestione offline
];

// Risorse CDN critiche (ora gestite tramite offline-manager.js)
const CRITICAL_CDN_ASSETS = [
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
];

// Installazione del Service Worker
self.addEventListener('install', event => {
    console.log('[SW] Installazione...');
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('[SW] Caching assets statici...');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[SW] Installazione completata.');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('[SW] Errore durante l'installazione:', error);
            })
    );
});

// Attivazione del Service Worker
self.addEventListener('activate', event => {
    console.log('[SW] Attivazione...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE && cacheName !== OFFLINE_CACHE) {
                        console.log('[SW] Eliminazione cache obsoleta:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[SW] Attivazione completata.');
            return self.clients.claim();
        })
    );
});

// Gestione delle richieste di rete (Fetch)
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Ignora richieste non-GET
    if (request.method !== 'GET') {
        return;
    }

    // Strategia "Cache First" per gli asset statici locali
    if (STATIC_ASSETS.some(asset => url.pathname.endsWith(asset.replace('./', '/')))) {
        event.respondWith(
            caches.match(request).then(cachedResponse => {
                return cachedResponse || fetch(request);
            })
        );
        return;
    }

    // Strategia "Cache First" per le risorse CDN (messe in cache da offline-manager)
    if (CRITICAL_CDN_ASSETS.some(asset => request.url.startsWith(asset))) {
        event.respondWith(
            caches.open(OFFLINE_CACHE).then(cache => {
                return cache.match(request).then(cachedResponse => {
                    return cachedResponse || fetch(request).then(networkResponse => {
                        cache.put(request, networkResponse.clone());
                        return networkResponse;
                    });
                });
            })
        );
        return;
    }

    // Strategia "Network First" per tutte le altre richieste
    event.respondWith(
        fetch(request)
            .then(networkResponse => {
                // Se la richiesta ha successo, mettila in cache dinamica
                const cache = caches.open(DYNAMIC_CACHE);
                cache.then(c => c.put(request, networkResponse.clone()));
                return networkResponse;
            })
            .catch(() => {
                // Se la rete fallisce, cerca nella cache
                return caches.match(request).then(cachedResponse => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // Se non è in cache, restituisci una pagina di fallback (se applicabile)
                    if (request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                    return new Response('Contenuto non disponibile offline', {
                        status: 404,
                        statusText: 'Not Found'
                    });
                });
            })
    );
});

// Gestione messaggi dall'app
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
