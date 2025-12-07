# Auto-Update Filename Fix

## Problem
The auto-updater was getting a 404 error because of a filename mismatch:
- **Built file**: `MyBabbo Print Centre Setup 1.5.5.exe` (with spaces)
- **Expected by latest.yml**: `MyBabbo-Print-Centre-Setup-1.5.5.exe` (with hyphens)

## Root Cause
`electron-builder` generates `latest.yml` with URL-safe filenames (hyphens instead of spaces), but the actual NSIS installer kept the spaces from the `productName`.

## Solution Applied

### Changed: `build/electron-builder.yml`
Added explicit artifact naming to the NSIS config:

```yaml
nsis:
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: "MyBabbo Print Centre"
  artifactName: "MyBabbo-Print-Centre-Setup-${version}.${ext}"  # ← Added this
```

## Result
From version 1.5.6 onwards, the build will create:
- ✅ `MyBabbo-Print-Centre-Setup-1.5.6.exe`
- ✅ `MyBabbo-Print-Centre-Setup-1.5.6.exe.blockmap`
- ✅ `latest.yml` with matching filename

## GitHub Release Checklist

When creating a release on GitHub:

1. **Tag format**: `v{version}` (e.g., `v1.5.6`)
2. **Upload these 3 files** from `dist/`:
   - `MyBabbo-Print-Centre-Setup-{version}.exe`
   - `MyBabbo-Print-Centre-Setup-{version}.exe.blockmap`
   - `latest.yml`
3. **Publish** the release (not draft)

## Verification

After publishing, verify the URL works:
```
https://github.com/MyBabboInc/PrintCenterClient/releases/download/v1.5.6/MyBabbo-Print-Centre-Setup-1.5.6.exe
```

Should download the installer (not return 404).

## For Version 1.5.5 (Already Released)

If you want to keep 1.5.5, rename the files on GitHub to:
- `MyBabbo-Print-Centre-Setup-1.5.5.exe`
- `MyBabbo-Print-Centre-Setup-1.5.5.exe.blockmap`

Or skip it and go straight to 1.5.6 with the fix.
