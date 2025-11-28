const { ipcRenderer } = require('electron');

let allProducts = {};
let selectedKey = null;

const productList = document.getElementById('product-list');
const editForm = document.getElementById('edit-form');
const emptyState = document.getElementById('empty-state');
const printerSelect = document.getElementById('edit-printer');
const traySelect = document.getElementById('edit-tray');

// Inputs
const inpName = document.getElementById('edit-name');
const inpMedia = document.getElementById('edit-media');
const inpCopies = document.getElementById('edit-copies');
const inpDuplex = document.getElementById('edit-duplex');
const inpColor = document.getElementById('edit-color');
const inpWidth = document.getElementById('edit-width');
const inpHeight = document.getElementById('edit-height');
const inpOffsetX = document.getElementById('edit-offsetX');
const inpOffsetY = document.getElementById('edit-offsetY');

async function init() {
    await loadPrinters();
    await loadProducts();

    document.getElementById('btn-new').addEventListener('click', createNewProduct);
    document.getElementById('btn-save').addEventListener('click', saveProduct);
    document.getElementById('btn-delete').addEventListener('click', deleteProduct);
    document.getElementById('btn-duplicate').addEventListener('click', duplicateProduct);

    printerSelect.addEventListener('change', populateTrays);
}

async function loadPrinters() {
    try {
        const printers = await ipcRenderer.invoke('get-printers');
        printerSelect.innerHTML = '<option value="">-- Select Printer --</option>';
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

async function populateTrays() {
    const printerName = printerSelect.value;
    const duplexSelect = document.getElementById('edit-duplex');

    if (!printerName) {
        traySelect.innerHTML = '<option value="">Select Printer First</option>';
        traySelect.disabled = true;

        duplexSelect.innerHTML = '<option value="">Select Printer First</option>';
        duplexSelect.disabled = true;
        return;
    }

    traySelect.innerHTML = '<option value="">Loading...</option>';
    traySelect.disabled = true;
    duplexSelect.innerHTML = '<option value="">Loading...</option>';
    duplexSelect.disabled = true;

    try {
        const capabilities = await ipcRenderer.invoke('get-printer-capabilities', printerName);

        // Populate Trays
        traySelect.innerHTML = '';
        const autoOpt = document.createElement('option');
        autoOpt.value = "";
        autoOpt.textContent = "Auto-Select";
        traySelect.appendChild(autoOpt);

        if (capabilities.trays && capabilities.trays.length > 0) {
            capabilities.trays.forEach(t => {
                if (t.toLowerCase() === 'auto select' || t.toLowerCase() === 'automatically select') return;
                const opt = document.createElement('option');
                opt.value = t;
                opt.textContent = t;
                traySelect.appendChild(opt);
            });
        }
        traySelect.disabled = false;

        // Restore selection if editing
        if (selectedKey && allProducts[selectedKey] && allProducts[selectedKey].tray) {
            traySelect.value = allProducts[selectedKey].tray;
        }

        // Populate Duplex
        duplexSelect.innerHTML = '';

        if (capabilities.canDuplex) {
            const duplexOptions = [
                { value: "", label: "None (Single-Sided)" },
                { value: "long", label: "Long Edge" },
                { value: "short", label: "Short Edge" }
            ];
            duplexOptions.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.value;
                opt.textContent = d.label;
                duplexSelect.appendChild(opt);
            });
            duplexSelect.disabled = false;

            // Restore selection if editing
            if (selectedKey && allProducts[selectedKey] && allProducts[selectedKey].duplex) {
                duplexSelect.value = allProducts[selectedKey].duplex;
            }
        } else {
            const opt = document.createElement('option');
            opt.value = "";
            opt.textContent = "Not Supported";
            duplexSelect.appendChild(opt);
            duplexSelect.disabled = true;
        }

    } catch (e) {
        console.error("Failed to load printer capabilities", e);
        traySelect.innerHTML = '<option value="">Error</option>';
        duplexSelect.innerHTML = '<option value="">Error</option>';
        duplexSelect.disabled = true;
    }
}

async function loadProducts() {
    const config = await ipcRenderer.invoke('get-config');
    allProducts = config.paperSizes || {};
    renderList();
}

function renderList() {
    productList.innerHTML = '';
    Object.entries(allProducts).forEach(([key, product]) => {
        const li = document.createElement('li');
        li.className = `product-item ${selectedKey === key ? 'active' : ''}`;
        li.innerHTML = `
            <span class="product-name">${product.displayName || key}</span>
            <span class="product-type">${product.isCustom ? 'Custom' : 'System'}</span>
        `;
        li.onclick = () => selectProduct(key);
        productList.appendChild(li);
    });
}

function selectProduct(key) {
    selectedKey = key;
    renderList();

    const product = allProducts[key];
    if (!product) return;

    emptyState.classList.add('hidden');
    editForm.classList.remove('hidden');

    // Populate form
    inpName.value = product.displayName || '';
    inpWidth.value = product.width || 0;
    inpHeight.value = product.height || 0;
    inpOffsetX.value = product.offsetX || 0;
    inpOffsetY.value = product.offsetY || 0;

    inpMedia.value = product.mediaType || 'Plain';
    inpCopies.value = product.copies || 1;
    inpDuplex.value = product.duplex || '';
    inpColor.value = product.color || 'color';

    if (product.printerName) {
        printerSelect.value = product.printerName;
        populateTrays(); // This is async, might need to wait to set tray
    } else {
        printerSelect.value = "";
        traySelect.innerHTML = '<option value="">Select Printer First</option>';
        traySelect.disabled = true;
    }

    // System products are read-only except for duplication? 
    // Or maybe we allow editing but save as custom?
    // For now, let's allow editing but maybe disable delete for system products.
    document.getElementById('btn-delete').style.display = product.isCustom ? 'block' : 'none';
    document.getElementById('btn-save').textContent = product.isCustom ? 'Save Changes' : 'Save as Custom';
}

function createNewProduct() {
    selectedKey = null;
    renderList(); // clear active class

    emptyState.classList.add('hidden');
    editForm.classList.remove('hidden');

    // Clear form
    inpName.value = "New Product";
    inpWidth.value = 215.9;
    inpHeight.value = 279.4;
    inpOffsetX.value = 0;
    inpOffsetY.value = 0;
    printerSelect.value = "";
    traySelect.innerHTML = '<option value="">Select Printer First</option>';
    traySelect.disabled = true;

    document.getElementById('btn-delete').style.display = 'none';
    document.getElementById('btn-save').textContent = 'Create Product';
}

async function saveProduct() {
    const name = inpName.value.trim();
    if (!name) {
        alert("Please enter a product name");
        return;
    }

    const key = selectedKey && allProducts[selectedKey] && allProducts[selectedKey].isCustom
        ? selectedKey
        : "user_" + name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() + "_" + Date.now();

    const data = {
        displayName: name,
        width: parseFloat(inpWidth.value),
        height: parseFloat(inpHeight.value),
        offsetX: parseFloat(inpOffsetX.value),
        offsetY: parseFloat(inpOffsetY.value),
        printerName: printerSelect.value,
        tray: traySelect.value,
        mediaType: inpMedia.value,
        copies: parseInt(inpCopies.value),
        duplex: inpDuplex.value,
        color: inpColor.value,
        isCustom: true
    };

    const success = await ipcRenderer.invoke('save-user-product', { key, data });
    if (success) {
        await loadProducts();
        selectProduct(key);
        alert("Product saved!");
    } else {
        alert("Failed to save product.");
    }
}

async function deleteProduct() {
    if (!selectedKey) return;
    if (!confirm("Are you sure you want to delete this product?")) return;

    const success = await ipcRenderer.invoke('delete-user-product', selectedKey);
    if (success) {
        await loadProducts();
        selectedKey = null;
        emptyState.classList.remove('hidden');
        editForm.classList.add('hidden');
    } else {
        alert("Failed to delete product.");
    }
}

function duplicateProduct() {
    const oldName = inpName.value;
    inpName.value = oldName + " (Copy)";
    selectedKey = null; // Treat as new
    document.getElementById('btn-delete').style.display = 'none';
    document.getElementById('btn-save').textContent = 'Save New Product';
}

init();
