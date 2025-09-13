import { getDB } from './storage.js';
import { showToast, openModal, closeModal } from './ui.js';
import { openPdf, renderPage } from './pdf.js';

const EVENT_STORE = 'events';
const PDF_STORE = 'pdfs';

let currentEvent = null;
let isReordering = false;
let selectedPagesForReorder = [];

const eventList = document.getElementById('eventList');

export function saveEvent(eventData) {
    const db = getDB();
    const transaction = db.transaction([EVENT_STORE], 'readwrite');
    const store = transaction.objectStore(EVENT_STORE);
    const request = eventData.id ? store.put(eventData) : store.add(eventData);

    request.onsuccess = () => {
        showToast(eventData.id ? 'Evento aggiornato.' : 'Evento creato.');
        loadEvents();
        closeModal('eventModal');
    };
    request.onerror = (event) => {
        showToast(`Errore: ${event.target.error}`, 'error');
    };
}

export function loadEvents() {
    const db = getDB();
    const transaction = db.transaction([EVENT_STORE], 'readonly');
    const store = transaction.objectStore(EVENT_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
        eventList.innerHTML = '';
        if (request.result.length === 0) {
            eventList.innerHTML = `<div class="empty-state"><i class="fas fa-calendar-plus"></i><p>Nessun evento. Creane uno per iniziare.</p></div>`;
            return;
        }
        request.result.sort((a, b) => a.name.localeCompare(b.name)).forEach(event => {
            const div = document.createElement('div');
            div.className = 'event-item';
            div.innerHTML = `
                <div class="event-info">
                    <h3>${event.name}</h3>
                    <p>${event.description || 'Nessuna descrizione'}</p>
                    <small>Pagine: ${event.pages.length}</small>
                </div>
                <div class="event-actions">
                    <button class="btn btn-primary btn-sm open-event-btn" data-id="${event.id}"><i class="fas fa-folder-open"></i> Apri</button>
                    <button class="btn btn-secondary btn-sm edit-event-btn" data-id="${event.id}"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger btn-sm delete-event-btn" data-id="${event.id}"><i class="fas fa-trash"></i></button>
                </div>
            `;
            eventList.appendChild(div);
        });
    };
}

export function deleteEvent(id) {
    if (!confirm('Sei sicuro di voler eliminare questo evento?')) return;

    const db = getDB();
    const transaction = db.transaction([EVENT_STORE], 'readwrite');
    const store = transaction.objectStore(EVENT_STORE);
    store.delete(id);

    transaction.oncomplete = () => {
        showToast('Evento eliminato.', 'secondary');
        loadEvents();
    };
}

export function openEvent(id) {
    const db = getDB();
    const transaction = db.transaction([EVENT_STORE, PDF_STORE], 'readonly');
    const eventStore = transaction.objectStore(EVENT_STORE);
    const pdfStore = transaction.objectStore(PDF_STORE);
    const request = eventStore.get(id);

    request.onsuccess = () => {
        currentEvent = request.result;
        document.getElementById('eventDetailName').textContent = currentEvent.name;
        document.getElementById('eventDetailDescription').textContent = currentEvent.description || '';
        
        const pageList = document.getElementById('eventPagesList');
        pageList.innerHTML = '';
        isReordering = false;
        updateReorderControls();

        if (currentEvent.pages.length === 0) {
            pageList.innerHTML = `<div class="empty-state"><i class="fas fa-file-medical"></i><p>Nessuna pagina in questo evento.</p></div>`;
        } else {
            currentEvent.pages.forEach((page, index) => {
                const pdfReq = pdfStore.get(page.pdfId);
                pdfReq.onsuccess = () => {
                    const pdf = pdfReq.result;
                    const div = document.createElement('div');
                    div.className = 'event-item';
                    div.dataset.index = index;
                    div.innerHTML = `
                        <div class="reorder-controls">
                            <div class="reorder-checkbox" data-index="${index}" onclick="toggleReorderSelection(this)"></div>
                        </div>
                        <span class="event-item-number">${index + 1}</span>
                        <div class="event-info">
                            <h3>Pag. ${page.pageNumber} - ${pdf ? pdf.name : 'PDF non trovato'}</h3>
                        </div>
                        <div class="event-actions">
                            <button class="btn btn-primary btn-sm view-page-btn" data-pdf-id="${page.pdfId}" data-page="${page.pageNumber}"><i class="fas fa-eye"></i></button>
                            <button class="btn btn-danger btn-sm remove-page-btn" data-index="${index}"><i class="fas fa-times"></i></button>
                        </div>
                    `;
                    pageList.appendChild(div);
                };
            });
        }
        openModal('eventDetailModal');
    };
}

export function addPageToEvent(pdfId, pageNumber) {
    if (!currentEvent.pages.some(p => p.pdfId === pdfId && p.pageNumber === pageNumber)) {
        currentEvent.pages.push({ pdfId, pageNumber });
        saveEvent(currentEvent);
        openEvent(currentEvent.id); // Refresh view
        showToast('Pagina aggiunta all\'evento.');
    } else {
        showToast('Pagina già presente nell\'evento.', 'warning');
    }
}

export function removePageFromEvent(index) {
    currentEvent.pages.splice(index, 1);
    saveEvent(currentEvent);
    openEvent(currentEvent.id); // Refresh view
}

export function updateReorderControls() {
    document.getElementById('reorderBtn').classList.toggle('active', isReordering);
    document.getElementById('eventPagesList').classList.toggle('reordering', isReordering);
    document.querySelectorAll('.reorder-controls').forEach(el => el.style.display = isReordering ? 'flex' : 'none');
    document.querySelectorAll('.event-actions').forEach(el => el.style.display = isReordering ? 'none' : 'flex');
    selectedPagesForReorder = [];
    updateMoveButtons();
}

export function toggleReorderSelection(element) {
    const index = parseInt(element.dataset.index);
    const item = element.closest('.event-item');
    if (selectedPagesForReorder.includes(index)) {
        selectedPagesForReorder = selectedPagesForReorder.filter(i => i !== index);
        item.classList.remove('selected');
    } else {
        selectedPagesForReorder.push(index);
        item.classList.add('selected');
    }
    updateMoveButtons();
}

export function updateMoveButtons() {
    const btnUp = document.getElementById('moveUpBtn');
    const btnDown = document.getElementById('moveDownBtn');
    if (selectedPagesForReorder.length === 0) {
        btnUp.disabled = true;
        btnDown.disabled = true;
        return;
    }
    btnUp.disabled = selectedPagesForReorder.some(i => i === 0);
    btnDown.disabled = selectedPagesForReorder.some(i => i === currentEvent.pages.length - 1);
}

export function moveSelectedPages(direction) {
    const pages = currentEvent.pages;
    const selection = selectedPagesForReorder.sort((a, b) => a - b);
    if (direction === -1) { // Move Up
        for (const i of selection) {
            if (i > 0) {
                [pages[i], pages[i - 1]] = [pages[i - 1], pages[i]];
            }
        }
        selectedPagesForReorder = selectedPagesForReorder.map(i => i > 0 ? i - 1 : i);
    } else { // Move Down
        for (const i of selection.reverse()) {
            if (i < pages.length - 1) {
                [pages[i], pages[i + 1]] = [pages[i + 1], pages[i]];
            }
        }
        selectedPagesForReorder = selectedPagesForReorder.map(i => i < pages.length - 1 ? i + 1 : i);
    }
    saveEvent(currentEvent);
    openEvent(currentEvent.id);
    // Re-select items after refresh
    setTimeout(() => {
        isReordering = true;
        updateReorderControls();
        selectedPagesForReorder.forEach(i => {
            const el = document.querySelector(`.reorder-checkbox[data-index="${i}"]`);
            if (el) {
                el.closest('.event-item').classList.add('selected');
            }
        });
        updateMoveButtons();
    }, 200);
}

export function getCurrentEvent() {
    return currentEvent;
}

export function setCurrentEvent(event) {
    currentEvent = event;
}

export function setReordering(value) {
    isReordering = value;
}
