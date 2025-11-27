const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const config = require('./config');
const trayMapper = require('./trayMapping');
const printBridge = require('./printBridge');
const ProductNotesManager = require('./productNotes');

let mainWindow;
let notesWindow = null;
const notesManager = new ProductNotesManager();

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1500,
        height: 1000,
        minWidth: 1300,
        minHeight: 800,
        title: "MyBabbo Print Centre",
        icon: path.join(__dirname, '../../assets/icon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // For MVP simplicity
            webSecurity: false
        }
    });

    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    // mainWindow.webContents.openDevTools();

    mainWindow.on('closed', function () {
        mainWindow = null;
    });

    createMenu();
}

function showCustomProductDialog() {
    const html = `
        <style>
            body {
                font-family: 'Segoe UI', sans-serif;
                padding: 20px;
                margin: 0;
                background: #f5f5f5;
            }
            .form-group {
                margin-bottom: 16px;
            }
            label {
                display: block;
                margin-bottom: 4px;
                font-weight: 600;
                font-size: 13px;
            }
            input, select {
                width: 100%;
                padding: 8px;
                border: 1px solid #bdc3c7;
                border-radius: 4px;
                font-size: 13px;
                box-sizing: border-box;
            }
            input:focus, select:focus {
                outline: none;
                border-color: #3498db;
            }
            .buttons {
                display: flex;
                gap: 8px;
                margin-top: 24px;
            }
            button {
                flex: 1;
                padding: 10px;
                border: none;
                border-radius: 4px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
            }
            .btn-save {
                background: #27ae60;
                color: white;
            }
            .btn-save:hover {
                background: #229954;
            }
            .btn-cancel {
                background: #95a5a6;
                color: white;
            }
            .btn-cancel:hover {
                background: #7f8c8d;
            }
            .error {
                color: #e74c3c;
                font-size: 12px;
                margin-top: 4px;
            }
        </style>
        <div class="form-group">
            <label for="name">Product Name</label>
            <input type="text" id="name" placeholder="e.g., My Custom Card" autofocus>
            <div id="name-error" class="error"></div>
        </div>
        <div class="form-group">
            <label for="width">Width (mm)</label>
            <input type="number" id="width" placeholder="e.g., 215" step="0.1" min="1">
            <div id="width-error" class="error"></div>
        </div>
        <div class="form-group">
            <label for="height">Height (mm)</label>
            <input type="number" id="height" placeholder="e.g., 280" step="0.1" min="1">
            <div id="height-error" class="error"></div>
        </div>
        <div class="form-group">
            <label for="orientation">Orientation</label>
            <select id="orientation">
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
            </select>
        </div>
        <div class="buttons">
            <button class="btn-cancel" onclick="window.close()">Cancel</button>
            <button class="btn-save" onclick="saveProduct()">Create Product</button>
        </div>
        <script>
            const { ipcRenderer } = require('electron');
            
            function saveProduct() {
                // Clear errors
                document.querySelectorAll('.error').forEach(el => el.textContent = '');
                
                const name = document.getElementById('name').value.trim();
                const width = parseFloat(document.getElementById('width').value);
                const height = parseFloat(document.getElementById('height').value);
                const orientation = document.getElementById('orientation').value;
                
                let hasError = false;
                
                if (!name) {
                    document.getElementById('name-error').textContent = 'Product name is required';
                    hasError = true;
                }
                if (!width || width <= 0) {
                    document.getElementById('width-error').textContent = 'Valid width is required';
                    hasError = true;
                }
                if (!height || height <= 0) {
                    document.getElementById('height-error').textContent = 'Valid height is required';
                    hasError = true;
                }
                
                if (hasError) return;
                
                const key = 'user_' + name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
                const data = {
                    displayName: name,
                    width: width,
                    height: height,
                    orientation: orientation,
                    isCustom: true
                };
                
                ipcRenderer.invoke('save-user-product', { key, data })
                    .then(success => {
                        if (success) {
                            window.close();
                        } else {
                            alert('Failed to save product');
                        }
                    });
            }
        </script>
    `;

    const dialogWindow = new BrowserWindow({
        width: 400,
        height: 350,
        resizable: false,
        parent: mainWindow,
        modal: true,
        title: 'Create Custom Product',
        icon: path.join(__dirname, '../../assets/icon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    dialogWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    dialogWindow.setMenu(null);
}


function createMenu() {
    const isMac = process.platform === 'darwin';

    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Open PDF...', click: () => {
                        dialog.showOpenDialog(mainWindow, {
                            properties: ['openFile'],
                            filters: [{ name: 'PDFs', extensions: ['pdf'] }]
                        }).then(result => {
                            if (!result.canceled && result.filePaths.length > 0) {
                                mainWindow.webContents.send('file-opened', result.filePaths[0]);
                            }
                        });
                    }
                },
                { type: 'separator' },
                {
                    label: 'Custom Products...', click: () => {
                        showCustomProductDialog();
                    }
                },
                { type: 'separator' },
                isMac ? { role: 'close' } : { role: 'quit' }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'Check For Updates',
                    click: () => {
                        autoUpdater.checkForUpdatesAndNotify();
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'Update Check',
                            message: 'Checking for updates...'
                        });
                    }
                },
                {
                    label: 'Contact Support',
                    click: async () => {
                        await shell.openExternal('mailto:service@mybabbo.com');
                    }
                },
                { type: 'separator' },
                {
                    label: 'About',
                    click: () => createAboutWindow()
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

function createAboutWindow() {
    dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'About MyBabbo Print Centre',
        message: 'MyBabbo Print Centre',
        detail: 'Built by NFDS for MyBabbo\nUsing Open-Source Technologies\n© NFDS — All Rights Reserved\n\nVersion: ' + app.getVersion(),
        buttons: ['OK']
    });
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    app.on('ready', () => {
        createWindow();
        // Check for updates in background after a short delay
        setTimeout(() => {
            autoUpdater.checkForUpdatesAndNotify();
        }, 3000);
    });
}

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
    if (mainWindow === null) createWindow();
});

// --- IPC Handlers ---

ipcMain.handle('get-config', () => {
    return config.get();
});

ipcMain.handle('save-user-product', (event, { key, data }) => {
    return config.saveUserProduct(key, data);
});

ipcMain.handle('delete-user-product', (event, key) => {
    return config.deleteUserProduct(key);
});

ipcMain.handle('get-printers', async () => {
    return await printBridge.getPrinters();
});

ipcMain.handle('get-default-printer', async () => {
    return await printBridge.getDefaultPrinter();
});

ipcMain.handle('get-recommended-tray', (event, { width, height }) => {
    return trayMapper.getRecommendedTray(width, height);
});

ipcMain.handle('print-pdf', async (event, { filePath, settings }) => {
    try {
        await printBridge.print(filePath, settings);
        return { success: true };
    } catch (error) {
        console.error("Print failed:", error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('open-file-dialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'PDFs', extensions: ['pdf'] }]
    });
    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
});

// Print Notes handlers
ipcMain.handle('open-print-notes', (event, { productKey, productName }) => {
    // Close existing notes window if open
    if (notesWindow && !notesWindow.isDestroyed()) {
        notesWindow.close();
    }

    // Create new notes window
    notesWindow = new BrowserWindow({
        width: 535,
        height: 750,
        resizable: false,
        parent: mainWindow,
        modal: false,
        title: `Print Notes - ${productName}`,
        icon: path.join(__dirname, '../../assets/icon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    notesWindow.loadFile(path.join(__dirname, '../renderer/printNotes.html'));

    notesWindow.on('closed', () => {
        notesWindow = null;
    });

    // Send product data and notes to the window once it's ready
    notesWindow.webContents.once('did-finish-load', () => {
        const content = notesManager.getNote(productKey);
        notesWindow.webContents.send('load-notes', {
            productKey: productKey,
            productName: productName,
            content: content
        });
    });

    return true;
});

ipcMain.on('save-note', (event, { productKey, content }) => {
    notesManager.saveNote(productKey, content);
});

// Config watcher
config.subscribe((data) => {
    if (mainWindow) {
        mainWindow.webContents.send('config-updated', data);
    }
});

// Auto-updater events
autoUpdater.on('update-available', () => {
    if (mainWindow) mainWindow.webContents.send('update-available');
});

autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
        type: 'info',
        title: 'Update Ready',
        message: 'A new version of MyBabbo Print Centre is available. Restart now to update?',
        buttons: ['Restart', 'Later']
    }).then((result) => {
        if (result.response === 0) {
            autoUpdater.quitAndInstall();
        }
    });
});
