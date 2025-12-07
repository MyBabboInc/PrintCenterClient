const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const config = require('./config');
const trayMapper = require('./trayMapping');
const printBridge = require('./printBridge');
const ProductNotesManager = require('./productNotes');

// Configure logging for auto-updater
log.transports.file.level = 'debug';
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'debug';
log.info('App starting...');
log.info('App version:', app.getVersion());

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
                            width: 1050,
                            height: 800,
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
                        if (mainWindow) {
                            mainWindow.webContents.send('update-checking');

                            // 60 second timeout
                            const timeoutId = setTimeout(() => {
                                if (mainWindow) {
                                    mainWindow.webContents.send('update-error', 'Connection timed out. Please check your internet connection.');
                                }
                            }, 60000);

                            autoUpdater.checkForUpdates().then(() => {
                                clearTimeout(timeoutId);
                            }).catch(err => {
                                clearTimeout(timeoutId);
                                if (mainWindow) {
                                    mainWindow.webContents.send('update-error', err.message);
                                }
                            });
                        }
                    }
                },
                {
                    label: 'Report Print Issue',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.webContents.send('request-report-data');
                        }
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
            autoUpdater.checkForUpdatesAndNotify().catch(err => console.log('Background update check failed:', err));
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

ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

ipcMain.handle('save-user-product', (event, { key, data }) => {
    return config.saveUserProduct(key, data);
});

ipcMain.handle('delete-user-product', (event, key) => {
    return config.deleteUserProduct(key);
});

ipcMain.handle('get-printer-profiles', () => {
    const fs = require('fs');
    const profilePath = path.join(__dirname, '..', '..', 'config', 'printerprofiles.json');
    try {
        const data = fs.readFileSync(profilePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Failed to load printer profiles:', err);
        return { printerProfiles: {} };
    }
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
        width: 1050,
        height: 800,
        title: "Manage Custom Products",
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        autoHideMenuBar: true
    });
    win.loadFile(path.join(__dirname, '../renderer/customProducts.html'));
});

// --- Report Issue Handling ---
let tempReportData = null;

ipcMain.handle('open-report-window', (event, data) => {
    tempReportData = data; // Store data to be fetched by the new window

    const win = new BrowserWindow({
        width: 600,
        height: 700,
        title: "Report Print Issue",
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        autoHideMenuBar: true,
        parent: mainWindow, // Make it a child of main window
        modal: false
    });
    win.loadFile(path.join(__dirname, '../renderer/reportIssue.html'));
});

ipcMain.handle('get-report-data', () => {
    return tempReportData;
});

ipcMain.handle('create-support-package', async (event, { reportData, userImages, comments }) => {
    try {
        const desktopPath = app.getPath('desktop');
        const tempDir = path.join(app.getPath('temp'), `mybabbo-report-${Date.now()}`);

        // 1. Create Temp Directory
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }

        // 2. Add System Info to Report Data
        const systemInfo = {
            os: process.platform,
            osRelease: require('os').release(),
            appVersion: app.getVersion(),
            arch: process.arch,
            date: new Date().toISOString()
        };

        const fullReport = {
            ...reportData,
            systemInfo,
            comments
        };

        // 3. Write Report JSON
        fs.writeFileSync(path.join(tempDir, 'report_info.json'), JSON.stringify(fullReport, null, 2));

        // 4. Copy Images
        if (userImages && userImages.length > 0) {
            userImages.forEach((img, index) => {
                const ext = path.extname(img);
                try {
                    fs.copyFileSync(img, path.join(tempDir, `image-${index + 1}${ext}`));
                } catch (err) {
                    console.error("Failed to copy image", img, err);
                }
            });
        }

        // 5. Zip
        const dateStr = new Date().toISOString().split('T')[0];
        const hostname = require('os').hostname();
        const zipName = `${dateStr}-${hostname}-PrintSupport.zip`;
        const zipPath = path.join(desktopPath, zipName);

        // Remove existing zip if any
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

        // PowerShell Compress-Archive
        // Note: Using 'powershell' command directly
        const psCommand = `Compress-Archive -Path "${tempDir}\\*" -DestinationPath "${zipPath}"`;

        await new Promise((resolve, reject) => {
            const { exec } = require('child_process');
            exec(`powershell -Command "${psCommand}"`, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });

        // 6. Cleanup Temp
        try {
            // fs.rmSync requires Node 14+, Electron typically has newer Node
            require('fs-extra').removeSync(tempDir);
        } catch (e) {
            console.error("Cleanup error", e);
        }

        return { success: true, filename: zipName, path: zipPath };

    } catch (error) {
        console.error("Create Package Error:", error);
        return { success: false, error: error.message };
    }
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
autoUpdater.on('checking-for-update', () => {
    log.info('Checking for update...');
});

autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info);
    if (mainWindow) mainWindow.webContents.send('update-available');
});

autoUpdater.on('update-not-available', (info) => {
    log.info('Update not available:', info);
    if (mainWindow) mainWindow.webContents.send('update-not-available');
});

autoUpdater.on('error', (err) => {
    log.error('Update error:', err);
    console.error('Update error:', err);
    if (mainWindow) mainWindow.webContents.send('update-error', err.message || 'Unknown error');
});

autoUpdater.on('download-progress', (progressObj) => {
    log.info(`Download progress: ${progressObj.percent}%`);
    if (mainWindow) mainWindow.webContents.send('update-download-progress', progressObj.percent);
});

autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded:', info);
    if (mainWindow) mainWindow.webContents.send('update-downloaded');
});

ipcMain.handle('install-update', () => {
    log.info('Installing update...');
    autoUpdater.quitAndInstall();
});
