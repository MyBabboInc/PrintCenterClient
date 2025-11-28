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
                        ipcMain.emit('open-custom-products-window'); // Trigger via IPC or direct function
                        // Since we are in main process, we can just call the logic directly.
                        // But let's define a helper or just put the logic here.
                        const win = new BrowserWindow({
                            width: 1000,
                            height: 700,
                            title: "Manage Custom Products",
                            webPreferences: {
                                nodeIntegration: true,
                                contextIsolation: false
                            },
                            autoHideMenuBar: true
                        });
                        win.loadFile(path.join(__dirname, '../renderer/customProducts.html'));
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
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        title: "About MyBabbo Print Centre",
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        autoHideMenuBar: true
    });
    win.loadFile(path.join(__dirname, '../renderer/about.html'));
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

ipcMain.handle('get-printer-trays', async (event, printerName) => {
    return await printBridge.getPrinterTrays(printerName);
});

ipcMain.handle('get-printer-capabilities', async (event, printerName) => {
    return await printBridge.getPrinterCapabilities(printerName);
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

ipcMain.handle('get-print-note', (event, productKey) => {
    return notesManager.getNote(productKey);
});

ipcMain.handle('save-print-note', (event, { productKey, content }) => {
    return notesManager.saveNote(productKey, content);
});

ipcMain.handle('open-custom-products-window', () => {
    const win = new BrowserWindow({
        width: 1000,
        height: 700,
        title: "Manage Custom Products",
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        autoHideMenuBar: true
    });
    win.loadFile(path.join(__dirname, '../renderer/customProducts.html'));
});

ipcMain.handle('clear-cache', async () => {
    if (mainWindow) {
        await mainWindow.webContents.session.clearCache();
        return true;
    }
    return false;
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
