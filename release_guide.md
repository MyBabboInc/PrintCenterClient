# Release Workflow Guide

This guide explains how to release a new version of the MyBabbo Print Centre application and trigger the auto-updater.

## Prerequisites

1.  **GitHub Token**: You need a GitHub Personal Access Token (PAT) with `repo` scope.
    - Go to GitHub -> Settings -> Developer settings -> Personal access tokens.
    - Generate a new token (classic) with `repo` scope.
    - Save this token securely.

## Release Steps

### 1. Update Version

Update the version number in `package.json`.

```json
{
  "name": "mybabbo-print-centre",
  "version": "1.0.1", 
  ...
}
```

### 2. Build and Publish

Run the following commands in your terminal (PowerShell or Bash). Replace `YOUR_GITHUB_TOKEN` with your actual token.

**Windows (PowerShell):**
```powershell
$env:GH_TOKEN="YOUR_GITHUB_TOKEN"
npm run dist
```

**macOS (Terminal):**
```bash
export GH_TOKEN="YOUR_GITHUB_TOKEN"
npm run dist
```

### 3. Verify Release

1.  Go to the [GitHub Repository Releases page](https://github.com/MyBabboInc/PrintCenterClient/releases).
2.  You should see a new "Draft" release created by electron-builder.
3.  Edit the release, add release notes, and publish it.

### 4. Auto-Update

- Users with the installed application will automatically check for updates on startup (and every 10 minutes thereafter).
- When an update is found, it will download in the background.
- Once downloaded, the user will be prompted to restart the application to update.
