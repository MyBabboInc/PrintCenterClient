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

        // Populate Print Products
        const productSelect = document.getElementById('product-select');
        if (config.paperSizes && productSelect) {
            Object.entries(config.paperSizes).forEach(([key, product]) => {
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = product.displayName || key.replace(/_/g, ' ');
                productSelect.appendChild(opt);
            });

            productSelect.addEventListener('change', async (e) => {
                const productKey = e.target.value;

                // Get fresh config to ensure we have latest data
                const currentConfig = await ipcRenderer.invoke('get-config');
                const product = currentConfig.paperSizes[productKey];

                if (product && productKey) {
                    // Reset offsets
                    offsetX.value = 0;
                    offsetY.value = 0;
                    valX.textContent = "0";
                    valY.textContent = "0";

                    // Apply Orientation if available
                    if (product.orientation) {
                        const rotSelect = document.getElementById('rotation-select');
                        if (product.orientation === 'landscape') {
                            rotSelect.value = "90";
                        } else {
                            rotSelect.value = "0";
                        }

                        // Trigger visual rotation update if PDF is loaded
                        if (currentPdfDoc && currentPageNum) {
                            renderPage(currentPageNum);
                        }
                    }

                    // Log custom margins if available
                    if (product.customMargins) {
                        console.log(`Selected product has custom margins:`, product.customMargins);
                    }
                }

                // Update button visibility and Print Notes link
                updateProductButtons(product && product.isCustom);

                // Enable/Disable Print Notes link
                const printNotesLink = document.getElementById('print-notes-link');
                if (product && productKey) {
                    // Enable Print Notes link for both system and custom products
                    if (printNotesLink) {
                        printNotesLink.style.color = '#3498db';
                        printNotesLink.style.pointerEvents = 'auto';
                        printNotesLink.style.opacity = '1';
                        printNotesLink.onclick = (ev) => {
                            ev.preventDefault();
                            const displayName = product.displayName || productKey.replace(/_/g, ' ');
                            ipcRenderer.invoke('open-print-notes', {
                                productKey: productKey,
                                productName: displayName
                            });
                        };
                    }
                } else {
                    // Disable Print Notes link if no product selected
                    if (printNotesLink) {
                        printNotesLink.style.color = '#bdc3c7';
                        printNotesLink.style.pointerEvents = 'none';
                        printNotesLink.style.opacity = '0.5';
                        printNotesLink.onclick = null;
                    }
                }
            });
        }

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

        // Get and select default printer
        const defaultPrinter = await ipcRenderer.invoke('get-default-printer');
        if (defaultPrinter) {
            const matchingOption = Array.from(printerSelect.options).find(
                opt => opt.value === defaultPrinter
            );
            if (matchingOption) {
                printerSelect.value = defaultPrinter;
                console.log(`Auto-selected default printer: ${defaultPrinter}`);
            }
        }
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

    // Rotation - Trigger re-render for visual feedback
    rotationSelect.addEventListener('change', () => {
        if (currentPdfDoc && currentPageNum) {
            renderPage(currentPageNum);
        }
    });

    // Print
    btnPrint.addEventListener('click', printCurrentPdf);

    // Save Defaults Button
    const btnSaveDefaults = document.getElementById('btn-save-defaults');
    btnSaveDefaults.addEventListener('click', async () => {
        const productSelect = document.getElementById('product-select');
        const currentProductKey = productSelect.value;
        let currentProduct = null;

        // Get current product if one is selected
        if (currentProductKey) {
            const config = await ipcRenderer.invoke('get-config');
            currentProduct = config.paperSizes[currentProductKey];
        }

        // Always prompt for name
        const defaultName = currentProduct && currentProduct.isCustom ? currentProduct.displayName : '';
        const name = prompt("Enter a name for this custom product:", defaultName);

        if (!name || name.trim() === '') {
            return; // User cancelled or entered empty name
        }

        // Create a key from the name (sanitize)
        const key = "user_" + name.trim().replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

        // Get current margins from selected product or default to 0
        let customMargins = { top: 0, right: 0, bottom: 0, left: 0 };
        if (currentProduct && currentProduct.customMargins) {
            customMargins = { ...currentProduct.customMargins };
        }

        const settings = {
            displayName: name.trim(),
            width: currentPageSize.width,
            height: currentPageSize.height,
            orientation: rotationSelect.value === "90" || rotationSelect.value === "270" ? "landscape" : "portrait",
            offsetX: parseFloat(offsetX.value) || 0,
            offsetY: parseFloat(offsetY.value) || 0,
            customMargins: customMargins,
            isCustom: true
        };

        const success = await ipcRenderer.invoke('save-user-product', { key, data: settings });
        if (success) {
            alert("Custom product saved successfully!");
            // Select the newly saved product
            productSelect.value = key;
        } else {
            alert("Failed to save custom product.");
        }
    });

    // Delete Product Button
    const btnDeleteProduct = document.getElementById('btn-delete-product');
    btnDeleteProduct.addEventListener('click', async () => {
        const productSelect = document.getElementById('product-select');
        const key = productSelect.value;

        if (!key) {
            return;
        }

        const config = await ipcRenderer.invoke('get-config');
        const product = config.paperSizes[key];

        // Only allow deleting custom products
        if (!product || !product.isCustom) {
            alert('Only custom products can be deleted.');
            return;
        }

        if (confirm(`Are you sure you want to delete "${product.displayName}"?`)) {
            const success = await ipcRenderer.invoke('delete-user-product', key);
            if (success) {
                // Clear selection
                productSelect.value = "";
                updateProductButtons(false);
            } else {
                alert("Failed to delete product.");
            }
        }
    });

    // IPC Config Update
    ipcRenderer.on('config-updated', (event, data) => {
        console.log('Config updated:', data);
        // Refresh dropdown
        const productSelect = document.getElementById('product-select');
        const currentVal = productSelect.value;
        productSelect.innerHTML = '<option value="">-- Select Product --</option>';

        if (data.paperSizes) {
            Object.entries(data.paperSizes).forEach(([key, product]) => {
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = product.displayName || key.replace(/_/g, ' ');
                // Mark custom products visually
                if (product.isCustom) {
                    opt.textContent += " (Custom)";
                }
                productSelect.appendChild(opt);
            });
        }
        productSelect.value = currentVal; // Restore selection if possible

        // Update buttons visibility based on selection
        const product = data.paperSizes[currentVal];
        updateProductButtons(product && product.isCustom);
    });

    // IPC File Opened (from Menu)
    ipcRenderer.on('file-opened', (event, filePath) => {
        loadPdf(filePath);
    });
}

function updateProductButtons(isCustom) {
    const btnDelete = document.getElementById('btn-delete-product');
    if (isCustom) {
        btnDelete.classList.remove('hidden');
    } else {
        btnDelete.classList.add('hidden');
    }
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

    // Get rotation override from UI
    let rotation = 0;
    if (rotationSelect) {
        rotation = parseInt(rotationSelect.value) || 0;
    }

    const baseViewport = page.getViewport({ scale: 1.0 });

    // Detect size in mm (1 pt = 1/72 inch, 1 inch = 25.4 mm)
    const widthMm = (baseViewport.width / 72) * 25.4;
    const heightMm = (baseViewport.height / 72) * 25.4;
    currentPageSize = { width: widthMm, height: heightMm };

    // --- Fit to Container Logic ---
    const container = document.getElementById('preview-container');
    const containerWidth = container.clientWidth - 80; // Account for padding
    const containerHeight = container.clientHeight - 80;

    // Calculate scale to fit (considering rotation)
    const unscaledViewport = page.getViewport({ scale: 1.0, rotation: rotation });
    const scaleX = containerWidth / unscaledViewport.width;
    const scaleY = containerHeight / unscaledViewport.height;
    const fitScale = Math.min(scaleX, scaleY, 2.0); // Cap at 2.0x for reasonable max zoom

    const displayScale = fitScale;
    const viewport = page.getViewport({ scale: displayScale, rotation: rotation });

    // Use devicePixelRatio for sharp rendering on high-DPI screens
    const dpr = window.devicePixelRatio || 1;

    // Set canvas size to match viewport at high DPI
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);

    // Set CSS display size
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    // Scale context to match DPI
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const renderContext = {
        canvasContext: ctx,
        viewport: viewport
    };

    try {
        await page.render(renderContext).promise;
    } catch (e) {
        console.error("Render error:", e);
    }

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
        offsetY: parseFloat(offsetY.value),
        productKey: document.getElementById('product-select').value
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
