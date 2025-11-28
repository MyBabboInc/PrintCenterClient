const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { app } = require('electron');

const pdfToPrinter = require('pdf-to-printer');
const { PDFDocument, rgb } = require('pdf-lib');

class PrintBridge {
  constructor() {
    this.platform = os.platform();
  }

  async getPrinters() {
    if (this.platform === 'win32') {
      return this.getWindowsPrinters();
    } else {
      return this.getMacPrinters();
    }
  }

  async getDefaultPrinter() {
    if (this.platform === 'win32') {
      return this.getWindowsDefaultPrinter();
    } else {
      return this.getMacDefaultPrinter();
    }
  }

  getWindowsDefaultPrinter() {
    return new Promise((resolve) => {
      const psCommand = `Get-CimInstance -ClassName Win32_Printer | Where-Object { $_.Default -eq $true } | Select-Object -ExpandProperty Name`;
      const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCommand}"`;

      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.error('Error getting default printer:', error);
          resolve(null);
          return;
        }

        const printerName = stdout.trim();
        resolve(printerName || null);
      });
    });
  }

  getMacDefaultPrinter() {
    return new Promise((resolve) => {
      exec('lpstat -d', (error, stdout, stderr) => {
        if (error) {
          console.error('Error getting default printer:', error);
          resolve(null);
          return;
        }

        // Output format: "system default destination: PrinterName"
        const match = stdout.match(/system default destination: (.+)/);
        const printerName = match ? match[1].trim() : null;
        resolve(printerName);
      });
    });
  }

  getWindowsPrinters() {
    return new Promise((resolve, reject) => {
      // Use CSV format for robustness against JSON parsing errors and encoding issues
      const psCommand = `Get-Printer | Select-Object Name, PrinterStatus | ConvertTo-Csv -NoTypeInformation`;
      const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${psCommand}"`;

      exec(cmd, { maxBuffer: 1024 * 1024 * 5 }, (error, stdout, stderr) => {
        if (error) {
          console.error('Error getting printers:', error);
          resolve([]);
          return;
        }

        try {
          const lines = stdout.trim().split(/\r?\n/);
          const printers = [];

          // Skip header row if present
          const startIndex = lines[0] && lines[0].includes('"Name"') ? 1 : 0;

          for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Simple CSV parse: assume "Name","Status"
            // We use a regex to handle quotes
            const parts = line.match(/"([^"]*)"/g);

            if (parts && parts.length >= 2) {
              const name = parts[0].replace(/"/g, '');
              const status = parts[1].replace(/"/g, '');

              // Filter offline/error
              const statusLower = status.toLowerCase();
              if (statusLower !== 'offline' && statusLower !== 'error' && statusLower !== '7') {
                printers.push({
                  name: name,
                  status: status,
                  duplex: false // Default to false for now
                });
              }
            }
          }

          resolve(printers);
        } catch (e) {
          console.error("Error parsing printer CSV", e);
          resolve([]);
        }
      });
    });
  }

  getMacPrinters() {
    return new Promise((resolve) => {
      exec('lpstat -p', async (error, stdout, stderr) => {
        if (error) {
          resolve([]);
          return;
        }
        const lines = stdout.split('\n');
        const printerNames = lines
          .filter(l => l.startsWith('printer') && !l.includes('disabled') && !l.includes('offline'))
          .map(l => l.split(' ')[1]);

        const printers = [];
        for (const name of printerNames) {
          const canDuplex = await this.checkMacDuplex(name);
          printers.push({ name, duplex: canDuplex });
        }
        resolve(printers);
      });
    });
  }

  checkMacDuplex(printerName) {
    return new Promise(resolve => {
      exec(`lpoptions -p "${printerName}" -l`, (err, stdout) => {
        if (err) {
          resolve(false);
          return;
        }
        // Look for "Duplex" option
        if (stdout.includes('Duplex/Double-Sided Printing') || stdout.includes('Duplex')) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  }

  // Get printer capabilities (trays + duplex support)
  getPrinterCapabilities(printerName) {
    if (this.platform === 'win32') {
      return this.getWindowsPrinterCapabilities(printerName);
    } else {
      return this.getMacPrinterCapabilities(printerName);
    }
  }

  getWindowsPrinterCapabilities(printerName) {
    return new Promise((resolve) => {
      const psCommand = `
        Add-Type -AssemblyName System.Drawing;
        $printer = New-Object System.Drawing.Printing.PrinterSettings;
        $printer.PrinterName = '${printerName.replace(/'/g, "''")}';
        if ($printer.IsValid) {
            $trays = $printer.PaperSources | Select-Object -ExpandProperty SourceName;
            $canDuplex = $printer.CanDuplex;
            Write-Output "TRAYS_START";
            $trays | ForEach-Object { Write-Output $_ };
            Write-Output "TRAYS_END";
            Write-Output "DUPLEX:$canDuplex";
        }
      `;
      const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCommand.replace(/\n/g, ' ')}"`;

      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.error('Error getting printer capabilities:', error);
          resolve({ trays: [], canDuplex: false });
          return;
        }

        try {
          const lines = stdout.trim().split(/\r?\n/);
          const trays = [];
          let canDuplex = false;
          let inTrays = false;

          for (const line of lines) {
            if (line === 'TRAYS_START') {
              inTrays = true;
              continue;
            }
            if (line === 'TRAYS_END') {
              inTrays = false;
              continue;
            }
            if (line.startsWith('DUPLEX:')) {
              canDuplex = line.split(':')[1].trim().toLowerCase() === 'true';
              continue;
            }
            if (inTrays && line.trim().length > 0) {
              trays.push(line.trim());
            }
          }

          resolve({ trays, canDuplex });
        } catch (e) {
          console.error('Error parsing printer capabilities:', e);
          resolve({ trays: [], canDuplex: false });
        }
      });
    });
  }

  async getMacPrinterCapabilities(printerName) {
    return new Promise((resolve) => {
      exec(`lpoptions -p "${printerName}" -l`, async (err, stdout) => {
        if (err) {
          console.error('Error getting Mac printer capabilities:', err);
          const canDuplex = await this.checkMacDuplex(printerName);
          resolve({ trays: [], canDuplex });
          return;
        }

        const trays = [];
        let canDuplex = false;

        const lines = stdout.split('\n');

        for (const line of lines) {
          // Look for InputSlot or MediaSource options
          if (line.includes('InputSlot') || line.includes('MediaSource')) {
            const parts = line.split(':');
            if (parts.length >= 2) {
              const options = parts[1].trim().split(/\s+/);
              options.forEach(opt => {
                const cleanOpt = opt.replace(/^\*/, '');
                if (cleanOpt && cleanOpt.length > 0) {
                  trays.push(cleanOpt);
                }
              });
            }
          }

          if (line.includes('Duplex')) {
            canDuplex = true;
          }
        }

        const uniqueTrays = [...new Set(trays)];
        resolve({ trays: uniqueTrays, canDuplex });
      });
    });
  }

  async print(pdfPath, settings) {
    console.log('Printing:', pdfPath, settings);

    // --- Enforce Custom Margins & Offsets ---
    let finalPdfPath = pdfPath;
    let tempFilePath = null;

    try {
      // 1. Load PDF
      const pdfBytes = await fs.promises.readFile(pdfPath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pages = pdfDoc.getPages();

      // 2. Get Margins & Offsets
      // settings should now include customMargins if passed from renderer
      // If not, we might need to look them up here, but ideally renderer passes them.
      // Let's assume settings has them or we look them up.
      // Actually, renderer.js passes `settings` object constructed from UI.
      // We need to make sure renderer passes the margins in `settings`.
      // Wait, renderer.js `printCurrentPdf` constructs `settings` from UI elements.
      // It does NOT currently include `customMargins`.
      // We should update renderer.js to pass them, OR look them up here in main process.
      // Looking up here is safer/cleaner since we have access to config.

      // However, `printBridge` doesn't have direct access to `config` module easily unless we require it.
      // Let's require config at the top.

      // For now, let's assume we can get margins. 
      // Let's modify the `print-pdf` handler in `main.js` to inject margins into settings?
      // Or just require config here.
      const config = require('./config');
      const appConfig = config.get();

      // Find product
      // We don't know WHICH product is selected just from `settings` unless we pass productKey.
      // `settings` has `mediaType`, `tray`, etc. but not `productKey`.
      // We need to update `renderer.js` to pass `productKey` in settings.

      // Let's assume for this step that we will update renderer.js to pass `productKey`.
      // If `productKey` is present:
      let margins = { top: 0, right: 0, bottom: 0, left: 0 };
      if (settings.productKey && appConfig.paperSizes[settings.productKey]) {
        const product = appConfig.paperSizes[settings.productKey];
        if (product.customMargins) {
          margins = product.customMargins;
        }
      }

      // 3. Apply Cropping
      // PDF coordinates: (0,0) is usually Bottom-Left.
      // CropBox = [x, y, width, height]
      // x = left margin + offset X
      // y = bottom margin + offset Y
      // width = original width - left - right
      // height = original height - top - bottom

      // Note: 1 mm = 2.83465 pt
      const mmToPt = 2.83465;

      const mTop = margins.top * mmToPt;
      const mRight = margins.right * mmToPt;
      const mBottom = margins.bottom * mmToPt;
      const mLeft = margins.left * mmToPt;

      const offX = (settings.offsetX || 0) * mmToPt;
      const offY = (settings.offsetY || 0) * mmToPt;

      let modified = false;

      pages.forEach(page => {
        const { width, height } = page.getSize();

        // Calculate new box
        // x starts at left margin. 
        // y starts at bottom margin.

        // Apply Edge Compensation (Offset)
        // "Edge Compensation... must shift the entire printableArea"
        // So we shift the crop box.

        const newX = mLeft + offX;
        const newY = mBottom + offY;
        const newWidth = width - mLeft - mRight;
        const newHeight = height - mTop - mBottom;

        // Clamp to page bounds to avoid errors
        const clampedX = Math.max(0, newX);
        const clampedY = Math.max(0, newY);
        const clampedWidth = Math.min(width - clampedX, newWidth);
        const clampedHeight = Math.min(height - clampedY, newHeight);

        if (clampedWidth > 0 && clampedHeight > 0) {
          page.setCropBox(clampedX, clampedY, clampedWidth, clampedHeight);
          // Also set TrimBox and BleedBox to match
          page.setTrimBox(clampedX, clampedY, clampedWidth, clampedHeight);
          page.setBleedBox(clampedX, clampedY, clampedWidth, clampedHeight);
          modified = true;
        }
      });

      if (modified) {
        const pdfBytesModified = await pdfDoc.save();
        tempFilePath = path.join(os.tmpdir(), `print_job_${Date.now()}.pdf`);
        await fs.promises.writeFile(tempFilePath, pdfBytesModified);
        finalPdfPath = tempFilePath;
        console.log("Created cropped PDF at:", finalPdfPath);
      }

    } catch (err) {
      console.error("Error processing PDF margins:", err);
      // Fallback to original if processing fails? 
      // Or throw? Better to throw so we don't print bad output.
      throw err;
    }

    try {
      if (this.platform === 'win32') {
        await this.printWindows(finalPdfPath, settings);
      } else {
        await this.printMac(finalPdfPath, settings);
      }
    } finally {
      // Cleanup temp file
      if (tempFilePath) {
        fs.unlink(tempFilePath, (err) => {
          if (err) console.error("Failed to delete temp file:", err);
        });
      }
    }

    return { success: true };
  }

  async printWindows(pdfPath, settings) {
    const options = {
      printer: settings.printerName,
      copies: parseInt(settings.copies) || 1,
      scale: "noscale",
    };

    if (settings.pages) {
      options.pages = settings.pages;
    }

    // Tray
    if (settings.tray && settings.tray !== 'Auto-Select') {
      options.bin = settings.tray;
    }

    // Duplex
    if (settings.duplex) {
      if (settings.duplex === 'long') {
        options.side = "duplex"; // Standard long-edge
      } else if (settings.duplex === 'short') {
        options.side = "duplexshort"; // Short-edge
      }
    }

    // Color / Monochrome
    if (settings.color === 'gray') {
      options.monochrome = true;
    } else {
      options.monochrome = false;
    }

    // Rotation - use print-settings for landscape orientation
    // pdf-to-printer uses SumatraPDF on Windows which supports -print-settings
    if (settings.rotation) {
      if (settings.rotation === 90 || settings.rotation === 270) {
        // Use win32 parameter for landscape
        options.win32 = ['-print-settings', 'landscape'];
      } else {
        options.win32 = ['-print-settings', 'portrait'];
      }
    }

    try {
      await pdfToPrinter.print(pdfPath, options);
      return { success: true };
    } catch (err) {
      console.error("Windows Print Error:", err);
      throw err;
    }
  }

  printMac(pdfPath, settings) {
    return new Promise((resolve, reject) => {
      const args = [
        '-d', `"${settings.printerName}"`,
        '-n', settings.copies || 1,
        '-o', 'fit-to-page=false',
        '-o', 'scaling=100',
      ];

      if (settings.pages) {
        args.push('-P', settings.pages);
      }

      // Tray selection using InputSlot
      if (settings.tray && settings.tray !== 'Auto-Select' && settings.tray !== '') {
        args.push('-o', `InputSlot=${settings.tray}`);
      }

      // Duplex
      if (settings.duplex === 'long') {
        args.push('-o', 'sides=two-sided-long-edge');
      } else if (settings.duplex === 'short') {
        args.push('-o', 'sides=two-sided-short-edge');
      } else {
        args.push('-o', 'sides=one-sided');
      }

      // Color
      if (settings.color === 'gray') {
        // Common options for grayscale
        args.push('-o', 'ColorModel=Gray');
      } else {
        args.push('-o', 'ColorModel=CMYK'); // or Color
      }

      // Rotation - use orientation-requested for Mac lp command
      if (settings.rotation === 90 || settings.rotation === 270) {
        args.push('-o', 'landscape');
        args.push('-o', 'orientation-requested=4'); // 4 = landscape
      } else {
        args.push('-o', 'orientation-requested=3'); // 3 = portrait
      }

      const cmd = `lp ${args.join(' ')} "${pdfPath}"`;
      console.log('Exec:', cmd);

      exec(cmd, (err, stdout) => {
        if (err) reject(err);
        else resolve(stdout);
      });
    });
  }
}

module.exports = new PrintBridge();
