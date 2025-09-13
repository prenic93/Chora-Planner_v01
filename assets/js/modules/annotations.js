import { getDB } from './storage.js';
import { getCurrentPdf } from './pdf.js';

const ANNOTATION_STORE = 'annotations';

const annotationStore = {
    currentPdfId: null,
    annotations: [], // { page, type, data }
    isDrawing: false,
    drawingMode: 'pen', // 'pen', 'eraser', 'note'
    lastPos: { x: 0, y: 0 }
};

const drawingCanvas = document.getElementById('drawingCanvas');
const drawingCtx = drawingCanvas.getContext('2d');
const pdfCanvas = document.getElementById('pdfCanvas');
const pdfViewer = document.getElementById('pdfViewer');

export function initAnnotations() {
    const annotationToggle = document.getElementById('annotationToggle');
    const annotationTools = document.getElementById('annotationTools');

    annotationToggle.addEventListener('click', () => {
        const isActive = annotationTools.classList.toggle('show');
        annotationToggle.classList.toggle('active', isActive);
        drawingCanvas.classList.toggle('active', isActive && annotationStore.drawingMode !== 'note');
    });

    document.querySelectorAll('.annotation-tool').forEach(tool => {
        tool.addEventListener('click', () => {
            document.querySelector('.annotation-tool.active')?.classList.remove('active');
            tool.classList.add('active');
            annotationStore.drawingMode = tool.dataset.tool;
            drawingCanvas.classList.toggle('active', annotationStore.drawingMode !== 'note');
            drawingCanvas.style.cursor = annotationStore.drawingMode === 'pen' ? 'crosshair' : (annotationStore.drawingMode === 'eraser' ? 'cell' : 'pointer');
        });
    });

    drawingCanvas.addEventListener('mousedown', startDrawing);
    drawingCanvas.addEventListener('mouseup', stopDrawing);
    drawingCanvas.addEventListener('mousemove', draw);
    drawingCanvas.addEventListener('mouseleave', stopDrawing);
    
    drawingCanvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDrawing(e.touches[0]); });
    drawingCanvas.addEventListener('touchend', (e) => { e.preventDefault(); stopDrawing(); });
    drawingCanvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e.touches[0]); });
}

export function loadAnnotationsForPdf(pdfId) {
    annotationStore.currentPdfId = pdfId;
    const db = getDB();
    const transaction = db.transaction([ANNOTATION_STORE], 'readonly');
    const store = transaction.objectStore(ANNOTATION_STORE);
    const request = store.get(pdfId);
    request.onsuccess = () => {
        annotationStore.annotations = request.result ? request.result.annotations : [];
        renderAnnotations(getCurrentPdf().currentPage);
    };
}

function saveAnnotations() {
    const db = getDB();
    const transaction = db.transaction([ANNOTATION_STORE], 'readwrite');
    const store = transaction.objectStore(ANNOTATION_STORE);
    store.put({ pdfId: annotationStore.currentPdfId, annotations: annotationStore.annotations });
}

export function renderAnnotations(pageNum) {
    // Clear previous page annotations
    document.querySelectorAll('.sticky-note').forEach(n => n.remove());

    // Render drawings
    drawingCanvas.width = pdfCanvas.width;
    drawingCanvas.height = pdfCanvas.height;
    drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);

    const pageAnnotations = annotationStore.annotations.filter(a => a.page === pageNum);
    pageAnnotations.forEach(annotation => {
        if (annotation.type === 'path') {
            drawingCtx.beginPath();
            drawingCtx.strokeStyle = annotation.data.color;
            drawingCtx.lineWidth = annotation.data.width;
            drawingCtx.lineCap = 'round';
            drawingCtx.lineJoin = 'round';
            annotation.data.points.forEach((p, i) => {
                if (i === 0) drawingCtx.moveTo(p.x, p.y);
                else drawingCtx.lineTo(p.x, p.y);
            });
            drawingCtx.stroke();
        } else if (annotation.type === 'note') {
            createStickyNote(annotation);
        }
    });
}

function startDrawing(e) {
    if (annotationStore.drawingMode === 'note') {
        const pos = getCanvasPos(e);
        const note = {
            id: Date.now(),
            page: getCurrentPdf().currentPage,
            type: 'note',
            data: { x: pos.x, y: pos.y, content: '' }
        };
        annotationStore.annotations.push(note);
        createStickyNote(note);
        saveAnnotations();
        return;
    }

    annotationStore.isDrawing = true;
    const pos = getCanvasPos(e);
    annotationStore.lastPos = pos;

    if (annotationStore.drawingMode === 'pen') {
        const newPath = {
            id: Date.now(),
            page: getCurrentPdf().currentPage,
            type: 'path',
            data: {
                color: '#ef4444',
                width: 3,
                points: [pos]
            }
        };
        annotationStore.annotations.push(newPath);
    }
}

function stopDrawing() {
    if (!annotationStore.isDrawing) return;
    annotationStore.isDrawing = false;
    saveAnnotations();
}

function draw(e) {
    if (!annotationStore.isDrawing) return;
    const pos = getCanvasPos(e);

    if (annotationStore.drawingMode === 'pen') {
        const currentPath = annotationStore.annotations[annotationStore.annotations.length - 1];
        currentPath.data.points.push(pos);

        drawingCtx.beginPath();
        drawingCtx.strokeStyle = currentPath.data.color;
        drawingCtx.lineWidth = currentPath.data.width;
        drawingCtx.lineCap = 'round';
        drawingCtx.lineJoin = 'round';
        drawingCtx.moveTo(annotationStore.lastPos.x, annotationStore.lastPos.y);
        drawingCtx.lineTo(pos.x, pos.y);
        drawingCtx.stroke();
    } else if (annotationStore.drawingMode === 'eraser') {
        const size = 20;
        drawingCtx.clearRect(pos.x - size / 2, pos.y - size / 2, size, size);
        // Remove annotations under eraser
        annotationStore.annotations = annotationStore.annotations.filter(a => {
            if (a.page !== getCurrentPdf().currentPage) return true;
            if (a.type === 'path') {
                return !a.data.points.some(p => Math.abs(p.x - pos.x) < size / 2 && Math.abs(p.y - pos.y) < size / 2);
            }
            return true;
        });
        renderAnnotations(getCurrentPdf().currentPage);
    }
    annotationStore.lastPos = pos;
}

function getCanvasPos(e) {
    const rect = pdfCanvas.getBoundingClientRect();
    return {
        x: (e.clientX - rect.left) * (pdfCanvas.width / rect.width),
        y: (e.clientY - rect.top) * (pdfCanvas.height / rect.height)
    };
}

function createStickyNote(annotation) {
    const noteEl = document.createElement('div');
    noteEl.className = 'sticky-note';
    noteEl.style.left = `${annotation.data.x}px`;
    noteEl.style.top = `${annotation.data.y}px`;
    noteEl.innerHTML = `<textarea>${annotation.data.content}</textarea>`;
    pdfViewer.appendChild(noteEl);

    const textarea = noteEl.querySelector('textarea');
    textarea.addEventListener('input', () => {
        annotation.data.content = textarea.value;
        saveAnnotations();
    });
}
