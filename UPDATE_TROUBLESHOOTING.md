# Auto-Updater Troubleshooting Guide

## Log Location

After adding logging support, you can find detailed update logs at:

**Windows:**
```
%USERPROFILE%\AppData\Roaming\mybabbo-print-centre\logs\main.log
```

Or navigate to:
```
C:\Users\[YourUsername]\AppData\Roaming\mybabbo-print-centre\logs\main.log
```

## How to Check Logs

1. Close the MyBabbo Print Centre app
2. Open File Explorer and paste this into the address bar:
   ```
   %APPDATA%\mybabbo-print-centre\logs
   ```
3. Open `main.log` in Notepad or your text editor
4. Look for lines containing:
   - "Checking for update..."
   - "Update available:" or "Update not available:"
   - "Update error:" (this will show what went wrong)

## Common Issues and Solutions

### Issue 1: Version 1.0.0 Built Without Squirrel Support

**Problem:** If version 1.0.0 was built with NSIS only (before you added Squirrel), it cannot auto-update.

**Solution:** You must manually uninstall 1.0.0 and install 1.5.0. Going forward, 1.5.0 will be able to auto-update to future versions because it now includes Squirrel support.

### Issue 2: Wrong Installer Type Used

**Problem:** The installer type used for 1.0.0 doesn't match what's available in the 1.5.0 release.

**Current Configuration:** Your package.json now builds BOTH:
- NSIS installer: `MyBabbo Print Centre Setup 1.5.0.exe`
- Squirrel installer: Files in `dist/squirrel-windows/`

**Solution:** Make sure you published BOTH installer types to the GitHub release:

From `dist/squirrel-windows/`:
- `RELEASES` file
- `.nupkg` file (the Squirrel package)

From `dist/`:
- `MyBabbo Print Centre Setup 1.5.0.exe`
- `MyBabbo Print Centre Setup 1.5.0.exe.blockmap`
- `latest.yml`

### Issue 3: GitHub Release Not Found

**Problem:** The app cannot reach GitHub or the release is still a draft.

**Check:**
1. Ensure the release is **published** (not draft)
2. The release should be tagged as `v1.5.0` (with the 'v' prefix)
3. Check the log for network errors

### Issue 4: publish Configuration Missing in 1.0.0

**Problem:** Version 1.0.0 might not have the publish configuration in its package.json.

**Solution:** This cannot be fixed retroactively. Version 1.0.0 users must manually update. Future updates from 1.5.0 onwards will work.

## Testing the Update

To test if the update mechanism works:

1. **Open the app** (version 1.0.0)
2. **Wait 3 seconds** (automatic check runs after startup)
3. **Or manually check:** Help → Check For Updates
4. **Check the logs** at the location above
5. Look for one of these messages:
   - ✅ "Update available" → Should start downloading
   - ❌ "Update not available" → Check version numbers and GitHub release
   - ❌ "Update error" → Read the error message for details

## Force Debug Mode

Add this to help menu click handler in `main.js` to see detailed info:

```javascript
console.log('Update feed URL:', autoUpdater.getFeedURL());
console.log('Current version:', app.getVersion());
```

## Quick Fix: Manual Update Required?

**If version 1.0.0 was built before adding Squirrel support:**

You'll need to:
1. Distribute version 1.5.0 manually (one time)
2. Users uninstall 1.0.0 and install 1.5.0
3. **From 1.5.0 onwards**, auto-updates will work perfectly

This is a one-time migration issue when adding update infrastructure.

## Verify GitHub Release

Check your release at: https://github.com/MyBabboInc/PrintCenterClient/releases/tag/v1.5.0

Should contain these files:
- ✅ `MyBabbo Print Centre Setup 1.5.0.exe`
- ✅ `MyBabbo Print Centre Setup 1.5.0.exe.blockmap`
- ✅ `latest.yml`
- ✅ `RELEASES` (from squirrel-windows folder)
- ✅ `MyBabbo.Print.Centre-1.5.0-full.nupkg` (from squirrel-windows folder)

## Need More Help?

Run the app from command line to see console output:
```powershell
& "C:\Users\[USERNAME]\AppData\Local\Programs\mybabbo-print-centre\MyBabbo Print Centre.exe"
```

Or check DevTools console: View → Toggle Developer Tools
