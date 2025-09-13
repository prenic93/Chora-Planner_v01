
document.addEventListener('DOMContentLoaded', () => {
    const DB_NAME = 'CanzoniereDB';
    const DB_VERSION = 1;
    let db;

    function initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('pdfs')) {
                    db.createObjectStore('pdfs', { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains('events')) {
                    db.createObjectStore('events', { keyPath: 'id', autoIncrement: true });
                }
            };

            request.onsuccess = (event) => {
                db = event.target.result;
                resolve(db);
            };

            request.onerror = (event) => {
                console.error('Database error:', event.target.errorCode);
                reject(event.target.errorCode);
            };
        });
    }

    function savePdf(file) {
        const transaction = db.transaction(['pdfs'], 'readwrite');
        const store = transaction.objectStore('pdfs');
        const pdf = {
            name: file.name,
            data: file,
            createdAt: new Date()
        };
        const request = store.add(pdf);

        request.onsuccess = () => {
            showToast('PDF caricato con successo!');
            loadPdfs();
        };

        request.onerror = (event) => {
            showToast('Errore nel caricamento del PDF.', 'error');
            console.error('Error saving PDF:', event.target.error);
        };
    }

    function loadPdfs() {
        const transaction = db.transaction(['pdfs'], 'readonly');
        const store = transaction.objectStore('pdfs');
        const request = store.getAll();

        request.onsuccess = () => {
            const pdfs = request.result;
            const pdfList = document.getElementById('pdfList');
            pdfList.innerHTML = '';

            if (pdfs.length === 0) {
                pdfList.innerHTML = '<p class="empty-state"><i class="fas fa-file-import"></i> Nessun PDF caricato. Inizia caricando un file!</p>';
                return;
            }

            pdfs.sort((a, b) => b.createdAt - a.createdAt);

            pdfs.forEach(pdf => {
                const item = document.createElement('div');
                item.className = 'event-item';
                item.innerHTML = `
                    <div class="event-info">
                        <h3><i class="fas fa-file-pdf"></i> ${pdf.name}</h3>
                        <small>Caricato il: ${new Date(pdf.createdAt).toLocaleString()}</small>
                    </div>
                    <div class="event-actions">
                        <button class="btn btn-primary btn-sm open-pdf-btn" data-id="${pdf.id}"><i class="fas fa-eye"></i> Apri</button>
                        <button class="btn btn-danger btn-sm delete-pdf-btn" data-id="${pdf.id}"><i class="fas fa-trash"></i></button>
                    </div>
                `;
                pdfList.appendChild(item);
            });
        };
    }

    function deletePdf(id) {
        if (!confirm('Sei sicuro di voler eliminare questo PDF?')) return;

        const transaction = db.transaction(['pdfs'], 'readwrite');
        const request = transaction.objectStore('pdfs').delete(id);

        request.onsuccess = () => {
            showToast('PDF eliminato.');
            loadPdfs();
        };
    }

    let currentPdf = {
        file: null,
        doc: null,
        currentPage: 1,
        numPages: 0,
        scale: 1.5,
        id: null
    };

    function openPdf(id) {
        const transaction = db.transaction(['pdfs'], 'readonly');
        const request = transaction.objectStore('pdfs').get(id);

        request.onsuccess = () => {
            const pdfData = request.result;
            currentPdf.id = id;
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = e.target.result;
                const loadingTask = pdfjsLib.getDocument({ data });
                loadingTask.promise.then(pdfDoc => {
                    currentPdf.doc = pdfDoc;
                    currentPdf.numPages = pdfDoc.numPages;
                    document.getElementById('pdfViewer').style.display = 'block';
                    renderPage(1);
                });
            };
            reader.readAsArrayBuffer(pdfData.data);
        };
    }

    function renderPage(pageNumber) {
        currentPdf.currentPage = pageNumber;
        currentPdf.doc.getPage(pageNumber).then(page => {
            const canvas = document.getElementById('pdfCanvas');
            const ctx = canvas.getContext('2d');
            const viewport = page.getViewport({ scale: currentPdf.scale });

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
                canvasContext: ctx,
                viewport: viewport
            };
            page.render(renderContext);
        });

        document.getElementById('pageInfo').textContent = `${pageNumber} / ${currentPdf.numPages}`;
        document.getElementById('pdfSlider').max = currentPdf.numPages;
        document.getElementById('pdfSlider').value = pageNumber;
    }

    function saveEvent(eventData) {
        const transaction = db.transaction(['events'], 'readwrite');
        const store = transaction.objectStore('events');
        const request = eventData.id ? store.put(eventData) : store.add(eventData);

        request.onsuccess = () => {
            showToast('Evento salvato!');
            loadEvents();
            closeModal('eventModal');
        };
        request.onerror = (e) => {
            showToast('Errore nel salvataggio dell\'evento.', 'error');
            console.error(e);
        }
    }

    function loadEvents() {
        const transaction = db.transaction(['events'], 'readonly');
        const store = transaction.objectStore('events');
        const request = store.getAll();

        request.onsuccess = () => {
            const events = request.result;
            const eventList = document.getElementById('eventList');
            eventList.innerHTML = '';

            if (events.length === 0) {
                eventList.innerHTML = '<p class="empty-state"><i class="fas fa-calendar-times"></i> Nessun evento creato. Inizia a pianificare!</p>';
                return;
            }

            events.forEach(event => {
                const item = document.createElement('div');
                item.className = 'event-item';
                item.innerHTML = `
                    <div class="event-info">
                        <h3>${event.name}</h3>
                        <p>${event.description || ''}</p>
                        <small>Pagine: ${event.pages.length}</small>
                    </div>
                    <div class="event-actions">
                        <button class="btn btn-primary btn-sm open-event-btn" data-id="${event.id}"><i class="fas fa-folder-open"></i> Apri</button>
                        <button class="btn btn-secondary btn-sm edit-event-btn" data-id="${event.id}"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-danger btn-sm delete-event-btn" data-id="${event.id}"><i class="fas fa-trash"></i></button>
                    </div>
                `;
                eventList.appendChild(item);
            });
        };
    }

    function deleteEvent(id) {
        if (!confirm('Sei sicuro di voler eliminare questo evento?')) return;

        const transaction = db.transaction(['events'], 'readwrite');
        const request = transaction.objectStore('events').delete(id);

        request.onsuccess = () => {
            showToast('Evento eliminato.');
            loadEvents();
        };
    }

    let currentEvent = null;

    function openEventDetail(id) {
        const transaction = db.transaction(['events'], 'readonly');
        const request = transaction.objectStore('events').get(id);

        request.onsuccess = () => {
            currentEvent = request.result;
            document.getElementById('eventDetailName').textContent = currentEvent.name;
            renderEventPages();
            openModal('eventDetailModal');
        };
    }

    function renderEventPages() {
        const pageList = document.getElementById('eventPagesList');
        pageList.innerHTML = '';
        if (currentEvent.pages.length === 0) {
            pageList.innerHTML = '<p class="empty-state">Nessuna pagina aggiunta a questo evento.</p>';
            return;
        }
        currentEvent.pages.forEach((page, index) => {
            const item = document.createElement('div');
            item.className = 'event-item';
            item.innerHTML = `
                <span>Pagina ${page.page} (PDF: ${page.pdfId})</span>
                <div>
                    <button class="btn btn-sm btn-primary view-page-btn" data-pdf-id="${page.pdfId}" data-page="${page.page}"><i class="fas fa-eye"></i></button>
                    <button class="btn btn-sm btn-danger remove-page-btn" data-index="${index}"><i class="fas fa-times"></i></button>
                </div>
            `;
            pageList.appendChild(item);
        });
    }

    function addPageToEvent(pdfId, page) {
        if (!currentEvent) {
            showToast('Seleziona o crea un evento prima.', 'warning');
            return;
        }
        currentEvent.pages.push({ pdfId, page });
        saveEvent(currentEvent);
        renderEventPages();
        showToast('Pagina aggiunta all\'evento!');
    }

    function removePageFromEvent(index) {
        currentEvent.pages.splice(index, 1);
        saveEvent(currentEvent);
        renderEventPages();
    }

    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        setTimeout(() => toast.className = toast.className.replace('show', ''), 3000);
    }

    function openModal(id) {
        document.getElementById(id).style.display = 'flex';
        document.getElementById(id).classList.add('show');
    }

    function closeModal(id) {
        const modal = document.getElementById(id);
        modal.classList.remove('show');
        // Allow animation to finish before hiding
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }

    // PWA Installation
    let deferredPrompt;
    const installPrompt = document.getElementById('installPrompt');
    const installBtn = document.getElementById('installBtn');

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        installPrompt.classList.remove('hidden');
    });

    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    showToast('Installazione completata!', 'success');
                } else {
                    showToast('Installazione annullata.', 'secondary');
                }
                deferredPrompt = null;
                installPrompt.classList.add('hidden');
            }
        });
    }
    
    window.addEventListener('appinstalled', () => {
        installPrompt.classList.add('hidden');
        showToast('App installata con successo!', 'success');
    });

    // Initialize
    (async () => {
        await initDB();
        loadPdfs();
        loadEvents();

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
        if (uploadArea) {
            uploadArea.addEventListener('click', () => pdfInput.click());
            uploadArea.addEventListener('dragover', (e) => e.preventDefault());
            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file && file.type === 'application/pdf') {
                    savePdf(file);
                }
            });
        }
        if (pdfInput) {
            pdfInput.addEventListener('change', () => {
                const file = pdfInput.files[0];
                if (file) savePdf(file);
            });
        }

        // PDF List Actions
        const pdfList = document.getElementById('pdfList');
        if (pdfList) {
            pdfList.addEventListener('click', (e) => {
                if (e.target.closest('.open-pdf-btn')) {
                    openPdf(parseInt(e.target.closest('.open-pdf-btn').dataset.id));
                }
                if (e.target.closest('.delete-pdf-btn')) {
                    deletePdf(parseInt(e.target.closest('.delete-pdf-btn').dataset.id));
                }
            });
        }

        // PDF Viewer Controls
        const closePdfBtn = document.getElementById('closePdfBtn');
        if(closePdfBtn) closePdfBtn.addEventListener('click', () => document.getElementById('pdfViewer').style.display = 'none');
        
        const prevPage = document.getElementById('prevPage');
        if(prevPage) prevPage.addEventListener('click', () => {
            if (currentPdf.currentPage > 1) renderPage(currentPdf.currentPage - 1);
        });

        const nextPage = document.getElementById('nextPage');
        if(nextPage) nextPage.addEventListener('click', () => {
            if (currentPdf.currentPage < currentPdf.numPages) renderPage(currentPdf.currentPage + 1);
        });

        const pdfSlider = document.getElementById('pdfSlider');
        if(pdfSlider) pdfSlider.addEventListener('input', () => renderPage(parseInt(pdfSlider.value)));

        // Event Actions
        const addEventBtn = document.getElementById('addEventBtn');
        if(addEventBtn) addEventBtn.addEventListener('click', () => {
            document.getElementById('eventForm').reset();
            document.getElementById('eventId').value = '';
            document.getElementById('eventModalTitle').textContent = 'Crea Nuovo Evento';
            currentEvent = { name: '', description: '', pages: [] };
            openModal('eventModal');
        });

        const eventForm = document.getElementById('eventForm');
        if(eventForm) eventForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const eventData = {
                name: document.getElementById('eventName').value,
                description: document.getElementById('eventDescription').value,
                pages: currentEvent ? currentEvent.pages : []
            };
            const id = document.getElementById('eventId').value;
            if (id) eventData.id = parseInt(id);
            saveEvent(eventData);
        });

        const eventList = document.getElementById('eventList');
        if(eventList) eventList.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.edit-event-btn');
            if (editBtn) {
                const id = parseInt(editBtn.dataset.id);
                const transaction = db.transaction(['events'], 'readonly');
                const request = transaction.objectStore('events').get(id);
                request.onsuccess = () => {
                    const event = request.result;
                    document.getElementById('eventId').value = event.id;
                    document.getElementById('eventName').value = event.name;
                    document.getElementById('eventDescription').value = event.description;
                    document.getElementById('eventModalTitle').textContent = 'Modifica Evento';
                    currentEvent = event;
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
        const floatingAddBtn = document.getElementById('floatingAddBtn');
        if(floatingAddBtn) floatingAddBtn.addEventListener('click', () => {
            if (currentPdf.doc) {
                addPageToEvent(currentPdf.id, currentPdf.currentPage);
            } else {
                showToast('Apri un PDF per aggiungere una pagina.', 'warning');
            }
        });

        const eventPagesList = document.getElementById('eventPagesList');
        if(eventPagesList) eventPagesList.addEventListener('click', (e) => {
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
        });

        // General
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => closeModal(btn.closest('.modal').id));
        });
        const refreshBtn = document.getElementById('refreshBtn');
        if(refreshBtn) refreshBtn.addEventListener('click', () => window.location.reload());
        
        const helpBtn = document.getElementById('helpBtn');
        if(helpBtn) helpBtn.addEventListener('click', () => openModal('helpModal'));
        
        const resetAppBtn = document.getElementById('resetAppBtn');
        if(resetAppBtn) resetAppBtn.addEventListener('click', async () => {
            if (confirm('ATTENZIONE: Questa azione cancellerà TUTTI i dati (PDF, eventi, annotazioni). Sei sicuro?')) {
                await indexedDB.deleteDatabase('CanzoniereDB');
                showToast('Applicazione resettata. Ricarica la pagina.', 'danger');
                setTimeout(() => window.location.reload(), 2000);
            }
        });

        // Export/Import
        const exportDataBtn = document.getElementById('exportDataBtn');
        if(exportDataBtn) exportDataBtn.addEventListener('click', exportData);
        
        const importDataBtn = document.getElementById('importDataBtn');
        if(importDataBtn) importDataBtn.addEventListener('click', () => document.getElementById('importDataInput').click());
        
        const importDataInput = document.getElementById('importDataInput');
        if(importDataInput) importDataInput.addEventListener('change', importData);

    })();

    async function exportData() {
        const pdfsTransaction = db.transaction(['pdfs'], 'readonly');
        const eventsTransaction = db.transaction(['events'], 'readonly');

        const pdfs = await new Promise(resolve => pdfsTransaction.objectStore('pdfs').getAll().onsuccess = e => resolve(e.target.result));
        const events = await new Promise(resolve => eventsTransaction.objectStore('events').getAll().onsuccess = e => resolve(e.target.result));

        const zip = new JSZip();
        const pdfsFolder = zip.folder('pdfs');

        for (const pdf of pdfs) {
            pdfsFolder.file(pdf.name, pdf.data);
        }

        const dataToExport = {
            pdfs: pdfs.map(p => ({ id: p.id, name: p.name, createdAt: p.createdAt })),
            events: events
        };

        zip.file('data.json', JSON.stringify(dataToExport));

        zip.generateAsync({ type: 'blob' }).then(content => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(content);
            a.download = `chora-planner-backup-${new Date().toISOString().slice(0, 10)}.zip`;
            a.click();
            URL.revokeObjectURL(a.href);
            showToast('Dati esportati con successo!');
        });
    }

    async function importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (file.name.endsWith('.zip')) {
            const zip = await JSZip.loadAsync(file);
            const dataFile = zip.file('data.json');
            if (!dataFile) {
                showToast('File di dati non trovato nel backup.', 'error');
                return;
            }
            const data = JSON.parse(await dataFile.async('string'));

            // Clear existing data
            await new Promise(resolve => {
                const t = db.transaction(['pdfs', 'events'], 'readwrite');
                t.objectStore('pdfs').clear();
                t.objectStore('events').clear();
                t.oncomplete = resolve;
            });

            // Import PDFs
            const pdfsStore = db.transaction(['pdfs'], 'readwrite').objectStore('pdfs');
            for (const pdfMetadata of data.pdfs) {
                const pdfFile = zip.file(`pdfs/${pdfMetadata.name}`);
                if (pdfFile) {
                    const pdfBlob = await pdfFile.async('blob');
                    const pdfData = {
                        id: pdfMetadata.id,
                        name: pdfMetadata.name,
                        createdAt: pdfMetadata.createdAt,
                        data: new File([pdfBlob], pdfMetadata.name, { type: 'application/pdf' })
                    };
                    pdfsStore.add(pdfData);
                }
            }

            // Import Events
            const eventsStore = db.transaction(['events'], 'readwrite').objectStore('events');
            for (const eventData of data.events) {
                eventsStore.add(eventData);
            }

            showToast('Dati importati con successo! Ricaricamento...');
            setTimeout(() => window.location.reload(), 2000);

        } else if (file.name.endsWith('.json')) {
            // Handle old JSON import if needed
            showToast('Importazione da JSON non più supportata. Usa un backup .zip.', 'warning');
        }
    }
});
