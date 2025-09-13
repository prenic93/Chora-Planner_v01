import { getDB } from './storage.js';
import { showToast, showLoading } from './ui.js';
import { loadAnnotationsForPdf, renderAnnotations } from './annotations.js';

const PDF_STORE = 'pdfs';
const EVENT_STORE = 'events';
const ANNOTATION_STORE = 'annotations';
const INDEX_STORE = 'pdf_index';

let currentPdf = {
    file: null,
    numPages: 0,
    viewer: null,
    scale: 1.5,
    currentPage: 1,
    pdfDoc: null,
    isRendering: false,
    renderPending: false,
    id: null
};

const pdfList = document.getElementById('pdfList');
const pdfViewer = document.getElementById('pdfViewer');
const pdfCanvas = document.getElementById('pdfCanvas');
const pageNum = document.getElementById('pageNum');
const pageCount = document.getElementById('pageCount');
const pdfSlider = document.getElementById('pdfSlider');

export function savePdf(file) {
    const db = getDB();
    const transaction = db.transaction([PDF_STORE], 'readwrite');
    const store = transaction.objectStore(PDF_STORE);
    const pdfData = { name: file.name, data: file, timestamp: new Date() };
    store.add(pdfData);

    transaction.oncomplete = () => {
        showToast(`PDF '${file.name}' salvato con successo.`);
        loadPdfs();
    };
    transaction.onerror = (event) => {
        showToast(`Errore nel salvataggio del PDF: ${event.target.error}`, 'error');
    };
}

export function loadPdfs() {
    const db = getDB();
    const transaction = db.transaction([PDF_STORE], 'readonly');
    const store = transaction.objectStore(PDF_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
        pdfList.innerHTML = '';
        if (request.result.length === 0) {
            pdfList.innerHTML = `<div class="empty-state"><i class="fas fa-file-import"></i><p>Nessun PDF trovato. Caricane uno per iniziare.</p></div>`;
            return;
        }
        request.result.sort((a, b) => a.name.localeCompare(b.name)).forEach(pdf => {
            const div = document.createElement('div');
            div.className = 'event-item';
            div.innerHTML = `
                <div class="event-info">
                    <h3>${pdf.name}</h3>
                    <small>Caricato: ${new Date(pdf.timestamp).toLocaleString()}</small>
                </div>
                <div class="event-actions">
                    <button class="btn btn-primary btn-sm open-pdf-btn" data-id="${pdf.id}"><i class="fas fa-eye"></i> Apri</button>
                    <button class="btn btn-danger btn-sm delete-pdf-btn" data-id="${pdf.id}"><i class="fas fa-trash"></i></button>
                </div>
            `;
            pdfList.appendChild(div);
        });
    };
}

export function deletePdf(id) {
    if (!confirm('Sei sicuro di voler eliminare questo PDF? Verrà rimosso anche da tutti gli eventi.')) return;

    const db = getDB();
    const transaction = db.transaction([PDF_STORE, EVENT_STORE, ANNOTATION_STORE, INDEX_STORE], 'readwrite');
    const pdfStore = transaction.objectStore(PDF_STORE);
    pdfStore.delete(id);

    // Rimuovi PDF dagli eventi
    const eventStore = transaction.objectStore(EVENT_STORE);
    const eventRequest = eventStore.getAll();
    eventRequest.onsuccess = () => {
        eventRequest.result.forEach(event => {
            const updatedPages = event.pages.filter(page => page.pdfId !== id);
            if (updatedPages.length < event.pages.length) {
                event.pages = updatedPages;
                eventStore.put(event);
            }
        });
    };
    
    // Rimuovi annotazioni e indice
    transaction.objectStore(ANNOTATION_STORE).delete(id);
    transaction.objectStore(INDEX_STORE).delete(id);

    transaction.oncomplete = () => {
        showToast('PDF eliminato.', 'secondary');
        loadPdfs();
        // This is a dependency that should be injected
        // loadEvents(); 
    };
}

export async function openPdf(id) {
    showLoading(true);
    const db = getDB();
    const transaction = db.transaction([PDF_STORE], 'readonly');
    const store = transaction.objectStore(PDF_STORE);
    const request = store.get(id);

    request.onsuccess = async () => {
        currentPdf.file = request.result.data;
        currentPdf.id = id;
        document.getElementById('pdfName').textContent = currentPdf.file.name;
        pdfViewer.style.display = 'block';
        
        try {
            const pdfData = await currentPdf.file.arrayBuffer();
            currentPdf.pdfDoc = await pdfjsLib.getDocument({ data: pdfData }).promise;
            currentPdf.numPages = currentPdf.pdfDoc.numPages;
            currentPdf.currentPage = 1;
            pageCount.textContent = currentPdf.numPages;
            pdfSlider.max = currentPdf.numPages;
            renderPage(currentPdf.currentPage);
            loadAnnotationsForPdf(id);
        } catch (error) {
            console.error('Error opening PDF:', error);
            showToast('Impossibile aprire il PDF.', 'error');
            showLoading(false);
        }
    };
}

export function renderPage(num) {
    if (currentPdf.isRendering) {
        currentPdf.renderPending = true;
        return;
    }
    currentPdf.isRendering = true;
    currentPdf.currentPage = num;
    pageNum.textContent = num;
    pdfSlider.value = num;

    currentPdf.pdfDoc.getPage(num).then(page => {
        const viewport = page.getViewport({ scale: currentPdf.scale });
        const context = pdfCanvas.getContext('2d');
        pdfCanvas.height = viewport.height;
        pdfCanvas.width = viewport.width;

        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        const renderTask = page.render(renderContext);
        renderTask.promise.then(() => {
            currentPdf.isRendering = false;
            if (currentPdf.renderPending) {
                currentPdf.renderPending = false;
                renderPage(currentPdf.currentPage);
            }
            showLoading(false);
            renderAnnotations(num);
            renderHyperlinks(page, pdfCanvas.width / viewport.width);
        });
    });
}

export function getCurrentPdf() {
    return currentPdf;
}

function renderHyperlinks(page, scale) {
    // Implement hyperlink rendering if needed
}
