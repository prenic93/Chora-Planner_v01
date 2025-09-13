const DB_NAME = 'CanzoniereDB';
const DB_VERSION = 2;
const PDF_STORE = 'pdfs';
const EVENT_STORE = 'events';
const ANNOTATION_STORE = 'annotations';
const INDEX_STORE = 'pdf_index';

let db;

export function initDB() {
    return new Promise((resolve, reject) => {
        if (db) {
            return resolve(db);
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const tempDb = event.target.result;
            if (!tempDb.objectStoreNames.contains(PDF_STORE)) {
                tempDb.createObjectStore(PDF_STORE, { keyPath: 'id', autoIncrement: true });
            }
            if (!tempDb.objectStoreNames.contains(EVENT_STORE)) {
                const eventStore = tempDb.createObjectStore(EVENT_STORE, { keyPath: 'id', autoIncrement: true });
                eventStore.createIndex('name', 'name', { unique: false });
            }
            if (!tempDb.objectStoreNames.contains(ANNOTATION_STORE)) {
                const annotationStore = tempDb.createObjectStore(ANNOTATION_STORE, { keyPath: 'id', autoIncrement: true });
                annotationStore.createIndex('pdfId', 'pdfId', { unique: false });
            }
            if (!tempDb.objectStoreNames.contains(INDEX_STORE)) {
                const indexStore = tempDb.createObjectStore(INDEX_STORE, { keyPath: 'pdfId' });
                indexStore.createIndex('content', 'content', { multiEntry: true });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('Database initialized successfully');
            resolve(db);
        };

        request.onerror = (event) => {
            console.error('Database initialization failed:', event.target.error);
            reject(event.target.error);
        };
    });
}

export function getDB() {
    if (!db) throw new Error('DB not initialized');
    return db;
}
