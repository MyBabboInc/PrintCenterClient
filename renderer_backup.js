const { ipcRenderer } = require('electron');
const path = require('path');

// PDF.js is ESM only in v4+, so we load it dynamically
let pdfjsLib;

// UI Elements
const dropZone = document.getElementById('drop-zone');
const canvas = document.getElementById('pdf-canvas');
const ctx = canvas.getContext('2d');
const statusBar = document.getElementById('status-bar');
const printerSelect = document.getElementById('printer-select');
const traySelect = document.getElementById('tray-select');
const btnPrint = document.getElementById('btn-print');
const rotationSelect = document.getElementById('rotation-select');
const offsetX = document.getElementById('offset-x');
const offsetY = document.getElementById('offset-y');
const valX = document.getElementById('val-x');
const valY = document.getElementById('val-y');

// Navigation Elements
const pdfNav = document.getElementById('pdf-nav');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const pageIndicator = document.getElementById('page-indicator');

let currentPdfPath = null;
let currentPdfDoc = null;
let currentPageNum = 1;
let totalPages = 0;
let currentPageSize = { width: 0, height: 0 }; // in mm

// Initialize
async function init() {
    try {
        // Load PDF.js
        const pdfjsPath = require.resolve('pdfjs-dist/build/pdf.mjs');
        const pdfjsModule = await import(`file://${pdfjsPath.replace(/\\/g, '/')}`);
        pdfjsLib = pdfjsModule;

        const workerPath = require.resolve('pdfjs-dist/build/pdf.worker.mjs');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${workerPath.replace(/\\/g, '/')}`;

        console.log("PDF.js initialized");

        await loadPrinters();
        setupEventListeners();

        const config = await ipcRenderer.invoke('get-config');
        console.log('Config loaded:', config);

    } catch (err) {
        console.error("Init failed:", err);
        statusBar.textContent = "Error initializing: " + err.message;
    }
}

async function loadPrinters() {
    try {
        const printers = await ipcRenderer.invoke('get-printers');
        printerSelect.innerHTML = '';
        printers.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.name;
            opt.textContent = p.name;
            printerSelect.appendChild(opt);
        });
    } catch (e) {
        console.error("Failed to load printers", e);
    }
}

function setupEventListeners() {
    // Drag & Drop
    document.body.addEventListener('dragover', e => {
        e.preventDefault();
        e.stopPropagation();
    });

    document.body.addEventListener('drop', e => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files.length > 0) {
            loadPdf(e.dataTransfer.files[0].path);
        }
    });

    dropZone.addEventListener('click', async () => {
        const filePath = await ipcRenderer.invoke('open-file-dialog');
        if (filePath) {
            loadPdf(filePath);
        }
    });

    // Navigation
    btnPrev.addEventListener('click', () => {
        if (currentPageNum > 1) {
            renderPage(currentPageNum - 1);
        }
    });

    btnNext.addEventListener('click', () => {
        if (currentPageNum < totalPages) {
            renderPage(currentPageNum + 1);
        }
    });

    // Sliders
    offsetX.addEventListener('input', (e) => valX.textContent = e.target.value);
    offsetY.addEventListener('input', (e) => valY.textContent = e.target.value);

    // Print
    btnPrint.addEventListener('click', printCurrentPdf);

    // IPC Config Update
    ipcRenderer.on('config-updated', (event, data) => {
        console.log('Config updated:', data);
    });

    // IPC File Opened (from Menu)
    ipcRenderer.on('file-opened', (event, filePath) => {
        loadPdf(filePath);
    });
}

async function loadPdf(filePath) {
    try {
        console.log("Loading PDF:", filePath);
        statusBar.textContent = "Loading PDF...";

        if (!pdfjsLib) {
            throw new Error("PDF.js not initialized");
        }

        const fileUrl = `file://${filePath.replace(/\\/g, '/')}`;

        const loadingTask = pdfjsLib.getDocument(fileUrl);
        currentPdfDoc = await loadingTask.promise;
        currentPdfPath = filePath;
        totalPages = currentPdfDoc.numPages;

        // Render first page
        await renderPage(1);

        dropZone.classList.add('hidden');

        // Show nav ONLY if multiple pages
        if (totalPages > 1) {
            pdfNav.classList.remove('hidden');
        } else {
            pdfNav.classList.add('hidden');
        }

        btnPrint.disabled = false;

        statusBar.textContent = `Loaded: ${path.basename(filePath)} (${totalPages} pages)`;

    } catch (err) {
        console.error("Error loading PDF:", err);
        statusBar.textContent = "Error loading PDF: " + err.message;
    }
}

async function renderPage(pageNum) {
    if (!currentPdfDoc) return;

    currentPageNum = pageNum;
    pageIndicator.textContent = `Page ${currentPageNum} of ${totalPages}`;

    btnPrev.disabled = currentPageNum <= 1;
    btnNext.disabled = currentPageNum >= totalPages;

    const page = await currentPdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });

    // Detect size in mm (1 pt = 1/72 inch, 1 inch = 25.4 mm)
    const widthMm = (viewport.width / 72) * 25.4;
    const heightMm = (viewport.height / 72) * 25.4;

    currentPageSize = { width: widthMm, height: heightMm };

    // Render to canvas (scale for display)
    // Adjust scale to fit width of container nicely, or fixed scale?
    // User wants "100% actual size" for PRINTING, but for viewing we should probably fit width or use a reasonable scale.
    // Let's stick to 1.5 for now as it seemed to work, or maybe 1.0 to be "Actual Size" on screen roughly.
    const displayScale = 1.0;
    const displayViewport = page.getViewport({ scale: displayScale });
    canvas.width = displayViewport.width;
    canvas.height = displayViewport.height;

    const renderContext = {
        canvasContext: ctx,
        viewport: displayViewport
    };
    await page.render(renderContext).promise;

    // Auto-detect tray
    const recommendedTray = await ipcRenderer.invoke('get-recommended-tray', currentPageSize);
    if (recommendedTray) {
        traySelect.value = recommendedTray;
        if (!statusBar.textContent.includes('Recommended')) {
            statusBar.textContent += ` - Recommended: ${recommendedTray}`;
        }
    }
}

async function printCurrentPdf() {
    if (!currentPdfPath) return;

    // Show Progress
    const modal = document.getElementById('progress-modal');
    const progressText = document.getElementById('progress-text');
    modal.classList.remove('hidden');
    progressText.textContent = "Preparing print job...";

    statusBar.textContent = "Printing...";
    btnPrint.disabled = true;

    const settings = {
        printerName: printerSelect.value,
        tray: traySelect.value,
        copies: document.getElementById('copies').value,
        rotation: parseInt(rotationSelect.value),
        duplex: document.getElementById('duplex-select').value,
        color: document.getElementById('color-select').value,
        mediaType: document.getElementById('media-select').value,
        offsetX: parseFloat(offsetX.value),
        offsetY: parseFloat(offsetY.value)
    };

    try {
        progressText.textContent = "Sending to printer...";
        const result = await ipcRenderer.invoke('print-pdf', {
            filePath: currentPdfPath,
            settings
        });

        if (result.success) {
            progressText.textContent = "Success!";
            statusBar.textContent = "Print job sent successfully.";
            setTimeout(() => {
                modal.classList.add('hidden');
            }, 1000);
        } else {
            throw new Error(result.error);
        }
    } catch (err) {
        progressText.textContent = "Failed!";
        statusBar.textContent = "Print failed: " + err.message;
        alert("Print Error: " + err.message);
        modal.classList.add('hidden');
    }

    btnPrint.disabled = false;
}

init();
