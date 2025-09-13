import { initDB } from './modules/storage.js';
import { showLoading, openModal, closeModal } from './modules/ui.js';
import { savePdf, loadPdfs, deletePdf, openPdf, renderPage, getCurrentPdf } from './modules/pdf.js';
import { saveEvent, loadEvents, deleteEvent, openEvent as openEventDetail, addPageToEvent, removePageFromEvent, updateReorderControls, toggleReorderSelection, moveSelectedPages, getCurrentEvent, setCurrentEvent, setReordering } from './modules/events.js';
import { initAnnotations } from './modules/annotations.js';
import { initPWA } from './modules/pwa.js';

document.addEventListener('DOMContentLoaded', async () => {
    showLoading(true);
    await initDB();
    loadPdfs();
    loadEvents();
    initPWA();
    initAnnotations();
    showLoading(false);

    // Tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelector('.nav-tab.active').classList.remove('active');
            tab.classList.add('active');
            document.querySelector('.tab-content.active').classList.remove('active');
            document.getElementById(`${tab.dataset.tab}-tab`).classList.add('active');
        });
    });

    // PDF Upload
    const uploadArea = document.getElementById('uploadArea');
    const pdfInput = document.getElementById('pdfInput');
    uploadArea.addEventListener('click', () => pdfInput.click());
    uploadArea.addEventListener('dragover', (e) => e.preventDefault());
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && file.type === 'application/pdf') {
            savePdf(file);
        }
    });
    pdfInput.addEventListener('change', () => {
        const file = pdfInput.files[0];
        if (file) savePdf(file);
    });

    // PDF List Actions
    document.getElementById('pdfList').addEventListener('click', (e) => {
        if (e.target.closest('.open-pdf-btn')) {
            openPdf(parseInt(e.target.closest('.open-pdf-btn').dataset.id));
        }
        if (e.target.closest('.delete-pdf-btn')) {
            deletePdf(parseInt(e.target.closest('.delete-pdf-btn').dataset.id));
        }
    });

    // PDF Viewer Controls
    document.getElementById('closePdfBtn').addEventListener('click', () => document.getElementById('pdfViewer').style.display = 'none');
    document.getElementById('prevPage').addEventListener('click', () => {
        const pdf = getCurrentPdf();
        if (pdf.currentPage > 1) renderPage(pdf.currentPage - 1);
    });
    document.getElementById('nextPage').addEventListener('click', () => {
        const pdf = getCurrentPdf();
        if (pdf.currentPage < pdf.numPages) renderPage(pdf.currentPage + 1);
    });
    document.getElementById('pdfSlider').addEventListener('input', () => renderPage(parseInt(document.getElementById('pdfSlider').value)));
    document.getElementById('zoomIn').addEventListener('click', () => {
        const pdf = getCurrentPdf();
        pdf.scale += 0.2;
        renderPage(pdf.currentPage);
    });
    document.getElementById('zoomOut').addEventListener('click', () => {
        const pdf = getCurrentPdf();
        if (pdf.scale > 0.4) {
            pdf.scale -= 0.2;
            renderPage(pdf.currentPage);
        }
    });

    // Event Actions
    document.getElementById('addEventBtn').addEventListener('click', () => {
        document.getElementById('eventForm').reset();
        document.getElementById('eventId').value = '';
        document.getElementById('eventModalTitle').textContent = 'Crea Nuovo Evento';
        setCurrentEvent(null);
        openModal('eventModal');
    });

    document.getElementById('eventForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const currentEvent = getCurrentEvent();
        const eventData = {
            name: document.getElementById('eventName').value,
            description: document.getElementById('eventDescription').value,
            pages: currentEvent ? currentEvent.pages : []
        };
        const id = document.getElementById('eventId').value;
        if (id) eventData.id = parseInt(id);
        saveEvent(eventData);
    });

    document.getElementById('eventList').addEventListener('click', (e) => {
        const editBtn = e.target.closest('.edit-event-btn');
        if (editBtn) {
            const id = parseInt(editBtn.dataset.id);
            const db = getDB();
            const transaction = db.transaction(['events'], 'readonly');
            const request = transaction.objectStore('events').get(id);
            request.onsuccess = () => {
                const event = request.result;
                document.getElementById('eventId').value = event.id;
                document.getElementById('eventName').value = event.name;
                document.getElementById('eventDescription').value = event.description;
                document.getElementById('eventModalTitle').textContent = 'Modifica Evento';
                setCurrentEvent(event);
                openModal('eventModal');
            };
        }
        if (e.target.closest('.delete-event-btn')) {
            deleteEvent(parseInt(e.target.closest('.delete-event-btn').dataset.id));
        }
        if (e.target.closest('.open-event-btn')) {
            openEventDetail(parseInt(e.target.closest('.open-event-btn').dataset.id));
        }
    });

    // Event Detail Modal
    document.getElementById('addPageToEventBtn').addEventListener('click', () => {
        const pdf = getCurrentPdf();
        addPageToEvent(pdf.id, pdf.currentPage);
    });

    document.getElementById('eventPagesList').addEventListener('click', (e) => {
        if (e.target.closest('.view-page-btn')) {
            const btn = e.target.closest('.view-page-btn');
            openPdf(parseInt(btn.dataset.pdfId)).then(() => {
                renderPage(parseInt(btn.dataset.page));
                closeModal('eventDetailModal');
            });
        }
        if (e.target.closest('.remove-page-btn')) {
            const index = parseInt(e.target.closest('.remove-page-btn').dataset.index);
            removePageFromEvent(index);
        }
        if (e.target.closest('.reorder-checkbox')) {
            toggleReorderSelection(e.target.closest('.reorder-checkbox'));
        }
    });

    // Reordering
    document.getElementById('reorderBtn').addEventListener('click', () => {
        setReordering(true);
        updateReorderControls();
    });

    document.getElementById('moveUpBtn').addEventListener('click', () => moveSelectedPages(-1));
    document.getElementById('moveDownBtn').addEventListener('click', () => moveSelectedPages(1));

    // General
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.closest('.modal').id));
    });
    document.getElementById('refreshBtn').addEventListener('click', () => window.location.reload());
    document.getElementById('helpBtn').addEventListener('click', () => openModal('helpModal'));
    document.getElementById('resetAppBtn').addEventListener('click', async () => {
        if (confirm('ATTENZIONE: Questa azione cancellerà TUTTI i dati (PDF, eventi, annotazioni). Sei sicuro?')) {
            await indexedDB.deleteDatabase('CanzoniereDB');
            showToast('Applicazione resettata. Ricarica la pagina.', 'danger');
            setTimeout(() => window.location.reload(), 2000);
        }
    });
});
