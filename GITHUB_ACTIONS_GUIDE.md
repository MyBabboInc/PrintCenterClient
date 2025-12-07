# GitHub Actions Automated Builds

## Overview

The MyBabbo Print Centre now uses **GitHub Actions** to automatically build installers for both Windows and macOS whenever you create a new version tag.

## How It Works

1. **You create a git tag** (e.g., `v1.5.8`)
2. **GitHub Actions automatically:**
   - Builds Windows installer on Windows runner
   - Builds macOS installer on macOS runner
   - Creates a GitHub release with all installers
   - Generates release notes

3. **Users can download** from GitHub Releases page

## Creating a New Release

### Prerequisites

- Ensure `package.json` version is updated (e.g., `"version": "1.5.8"`)
- Commit all changes to `main` branch
- Push to GitHub

### Steps

```powershell
# 1. Update version in package.json (if not already done)
# Edit package.json and change "version" field

# 2. Commit changes
git add .
git commit -m "Release v1.5.8"
git push origin main

# 3. Create and push tag
git tag v1.5.8
git push origin v1.5.8
```

### What Happens Next

1. **Workflow Triggers** (within seconds)
   - Go to: https://github.com/MyBabboInc/PrintCenterClient/actions
   - You'll see "Build and Release" workflow running

2. **Build Process** (takes ~10-15 minutes)
   - Windows build runs on `windows-latest` runner
   - macOS build runs on `macos-latest` runner
   - Progress visible in real-time on Actions page

3. **Release Created** (automatically)
   - Go to: https://github.com/MyBabboInc/PrintCenterClient/releases
   - New release appears with tag `v1.5.8`
   - Contains all installer files:
     - **Windows**: `MyBabbo-Print-Centre-Setup-1.5.8.exe`, blockmap, `latest.yml`
     - **macOS**: `.dmg`, `.pkg`, blockmap, `latest-mac.yml`

## Release Files

Each release will contain:

### Windows
- `MyBabbo-Print-Centre-Setup-{version}.exe` - NSIS installer
- `MyBabbo-Print-Centre-Setup-{version}.exe.blockmap` - For delta updates
- `latest.yml` - Update metadata

### macOS
- `MyBabbo Print Centre-{version}.dmg` - Disk image installer
- `MyBabbo Print Centre-{version}.dmg.blockmap` - For delta updates
- `MyBabbo Print Centre-{version}.pkg` - Package installer (alternative)
- `latest-mac.yml` - Update metadata

## Monitoring Builds

### View Build Progress
1. Go to repository → **Actions** tab
2. Click on the running workflow
3. View real-time logs for Windows and macOS builds

### Build Failed?
Common issues:
- **Syntax error**: Check workflow YAML syntax
- **Build error**: Check build logs for specific errors
- **Permission denied**: Ensure GitHub Actions is enabled in repository settings

## Troubleshooting

### Enable GitHub Actions
If workflows don't run:
1. Go to repository **Settings** → **Actions** → **General**
2. Enable "Allow all actions and reusable workflows"
3. Click **Save**

### Delete a Bad Tag
If you need to recreate a release:
```powershell
# Delete local tag
git tag -d v1.5.8

# Delete remote tag
git push origin :refs/tags/v1.5.8

# Create new tag and push
git tag v1.5.8
git push origin v1.5.8
```

### Manual Build (Fallback)
If GitHub Actions is unavailable:
```powershell
# Windows
npm run dist

# Upload files manually to GitHub Release
```

## Benefits

✅ **No local builds needed** - Builds happen in the cloud
✅ **Multi-platform** - Windows and macOS built automatically
✅ **Consistent** - Same build environment every time
✅ **Fast** - Parallel builds on cloud runners
✅ **Free** - GitHub Actions is free for public repositories
✅ **Automated** - Just push a tag, everything else is automatic

## Workflow File

The workflow is defined in: [`.github/workflows/build.yml`](file:///e:/Git/MyBabbo/GoogleAG/ForReal/PrintCenterClient/.github/workflows/build.yml)

To modify the build process, edit this file and commit changes.
