// Service Worker per Chora Planner PWA - Versione Offline Completa
const CACHE_NAME = 'chora-planner-v2.2';
const STATIC_CACHE = 'chora-static-v2.2';
const DYNAMIC_CACHE = 'chora-dynamic-v2.2';
const OFFLINE_CACHE = 'chora-offline-v2.2';

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

// Risorse CDN critiche
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
                // Aggiunge tutte le risorse statiche alla cache
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[SW] Installazione completata.');
                return self.skipWaiting(); // Forza l'attivazione
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
                    // Pulisce le cache obsolete
                    if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE && cacheName !== OFFLINE_CACHE) {
                        console.log('[SW] Eliminazione cache obsoleta:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[SW] Attivazione completata.');
            return self.clients.claim(); // Prende il controllo immediato della pagina
        })
    );
});

// Gestione delle richieste di rete (Fetch)
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Ignora richieste che non sono di tipo GET
    if (request.method !== 'GET') {
        return;
    }

    // Per le risorse CDN, usa una strategia Cache-First
    if (CRITICAL_CDN_ASSETS.some(asset => request.url.startsWith(asset))) {
        event.respondWith(cacheFirst(request, OFFLINE_CACHE));
        return;
    }

    // Per tutte le altre richieste, usa una strategia Network-First
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
});

// Strategia Cache-First: prima controlla la cache, poi la rete
async function cacheFirst(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
        return cachedResponse; // Restituisce la risposta dalla cache se presente
    }

    // Altrimenti, scarica dalla rete
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
        // Salva la nuova risposta in cache per usi futuri
        await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
}

// Strategia Network-First: prima prova la rete, poi la cache come fallback
async function networkFirst(request, cacheName) {
    try {
        // Prova a ottenere la risorsa dalla rete
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            // Se la richiesta ha successo, aggiorna la cache dinamica
            const cache = await caches.open(cacheName);
            await cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        // Se la rete fallisce, cerca una corrispondenza nella cache
        console.log('[SW] Rete fallita, tentativo di fallback dalla cache...');
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        // Se la richiesta è per una pagina di navigazione, restituisci index.html
        if (request.mode === 'navigate') {
            return await caches.match('./index.html');
        }

        // Se non c'è nulla, restituisci un errore
        return new Response('Contenuto non disponibile offline.', { status: 404, statusText: 'Not Found' });
    }
}

// Gestione messaggi dall'app
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
