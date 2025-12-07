# Version Display & Logo Fixes

## Changes Made

### 1. ✅ Fixed Logo Display in About Window

**Problem**: Logo wasn't loading due to path resolution issues with app.asar packaging.

**Solution**: Convert logo to base64 data URL to bypass file path issues entirely.

**Files Changed**:
- `app/renderer/about.html`
  - Reads logo file as Buffer
  - Converts to base64
  - Sets as data URL: `data:image/png;base64,{data}`
  - Falls back to hiding logo container if reading fails

### 2. ✅ Auto-Update Version from package.json

**Problem**: Version was hardcoded in multiple places (`about.html` and `index.html`), requiring manual updates.

**Solution**: Use Electron's `app.getVersion()` API to read version from package.json dynamically.

**Files Changed**:

#### `app/main/main.js`
Added IPC handler:
```javascript
ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});
```

#### `app/renderer/about.html`
- Added `class="version"` to version paragraph
- Loads version via IPC: `ipcRenderer.invoke('get-app-version')`
- Updates text dynamically on load

#### `app/renderer/index.html`
- Added `id="app-version"` to footer paragraph
- Fixed malformed HTML (`v7/p` → proper `</p>` tag)

#### `app/renderer/renderer.js`
- Loads version in `init()` function
- Updates footer text: `MyBabbo Print Centre v${version}`

### 3. ✅ Fixed HTML Formatting

**Problem**: Line 153 in `index.html` had malformed tag: `v7/p>`

**Solution**: Fixed to proper closing tag: `</p>`

## How It Works Now

### Single Source of Truth
The version is **only** defined in `package.json`:
```json
{
  "version": "1.5.7"
}
```

### Automatic Updates
When you change the version in `package.json`:
1. ✅ About window auto-updates
2. ✅ Main window footer auto-updates
3. ✅ Build artifacts use correct version
4. ✅ No manual edits needed anywhere else

### Logo Loading
The logo is loaded using this strategy:
1. Read `assets/mybabbo-logo.png` as Buffer
2. Convert to base64 string
3. Use as data URL in `<img src="data:image/png;base64,..."/>`
4. Works in both development and production
5. Works inside app.asar without path issues

## Testing

1. **Dev Mode**: Run `npm start`
   - Check Help → About shows correct version and logo
   - Check main window footer shows correct version

2. **Production**: Build and install
   - Logo should display in About window
   - Versions should match package.json

## Future Version Updates

To update the version:
1. Edit `package.json` → change `"version": "1.5.X"`
2. Build: `npm run dist`
3. Done! ✅

No need to edit:
- ❌ `about.html`
- ❌ `index.html`
- ❌ Any other files

The version is pulled dynamically from `package.json` via Electron's built-in API.
