/*
 * Gestore offline per le risorse CDN
 * Scarica e salva le librerie critiche in IndexedDB per un accesso offline affidabile.
 */

(function() {
    const OFFLINE_ASSETS_DB = 'offline-assets';
    const OFFLINE_ASSETS_STORE = 'keyval';

    const CRITICAL_CDN_ASSETS = [
        'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
        'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2',
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
    ];

    // Inizializza il database IndexedDB
    function openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(OFFLINE_ASSETS_DB, 1);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(OFFLINE_ASSETS_STORE)) {
                    db.createObjectStore(OFFLINE_ASSETS_STORE);
                }
            };

            request.onsuccess = (event) => {
                resolve(event.target.result);
            };

            request.onerror = (event) => {
                reject('Errore IndexedDB: ' + event.target.errorCode);
            };
        });
    }

    // Salva un file nel database
    function saveToDB(db, key, value) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([OFFLINE_ASSETS_STORE], 'readwrite');
            const store = transaction.objectStore(OFFLINE_ASSETS_STORE);
            const request = store.put(value, key);

            request.onsuccess = () => resolve();
            request.onerror = (event) => reject('Errore salvataggio: ' + event.target.error);
        });
    }

    // Carica un file dal database
    function loadFromDB(db, key) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([OFFLINE_ASSETS_STORE], 'readonly');
            const store = transaction.objectStore(OFFLINE_ASSETS_STORE);
            const request = store.get(key);

            request.onsuccess = (event) => {
                resolve(event.target.result);
            };

            request.onerror = (event) => {
                reject('Errore caricamento: ' + event.target.error);
            };
        });
    }

    // Scarica e salva le risorse
    async function downloadAndStoreAssets() {
        console.log('[OfflineManager] Avvio download risorse offline...');
        const db = await openDatabase();

        for (const url of CRITICAL_CDN_ASSETS) {
            try {
                // Controlla se la risorsa è già in cache
                const existingAsset = await loadFromDB(db, url);
                if (existingAsset) {
                    console.log('[OfflineManager] Risorsa già presente in cache:', url);
                    continue;
                }

                // Scarica la risorsa
                const response = await fetch(url, { mode: 'cors' });
                if (!response.ok) {
                    throw new Error('Risposta non valida dal server');
                }

                const blob = await response.blob();

                // Salva la risorsa in IndexedDB
                await saveToDB(db, url, blob);
                console.log('[OfflineManager] Risorsa salvata in cache:', url);

            } catch (error) {
                console.error('[OfflineManager] Errore durante il download di', url, error);
            }
        }

        console.log('[OfflineManager] Download risorse offline completato.');
    }

    // Avvia il processo al caricamento della pagina
    window.addEventListener('load', () => {
        if ('indexedDB' in window) {
            downloadAndStoreAssets();
        } else {
            console.warn('[OfflineManager] IndexedDB non supportato, la modalità offline potrebbe non essere affidabile.');
        }
    });

})();
