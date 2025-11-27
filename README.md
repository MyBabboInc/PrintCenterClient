# MyBabbo Print Centre

A lightweight, controlled PDF viewer and print utility for funeral homes.

## Features
- **100% Actual Size Printing**: Enforces no scaling to ensure templates align perfectly.
- **Tray & Media Control**: Allows selection of specific printer trays and media types.
- **Auto-Detection**: Detects PDF page size and recommends the correct tray based on `config/papers.json`.
- **Auto-Update**: Updates automatically via GitHub Releases.

## Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configuration**:
   - Edit `config/papers.json` to define paper sizes and tray mappings.

3. **Icons**:
   - Place `icon.ico` (Windows) and `icon.icns` (macOS) in the `assets/` folder before building.

## Development

To start the application in development mode:
```bash
npm start
```

## Building

### Windows
Run the build script from PowerShell:
```powershell
./scripts/build-win.ps1
```
Output will be in `dist/`.

### macOS
Run the build script from Terminal:
```bash
./scripts/build-mac.sh
```
Output will be in `dist/`.

## Architecture
- **Main Process**: Handles window management, IPC, configuration, and printing logic (`app/main/`).
- **Renderer Process**: Handles UI, PDF rendering (via PDF.js), and user interactions (`app/renderer/`).
- **Printing**: Uses native OS commands (PowerShell on Windows, `lp` on macOS) to enforce print settings.
