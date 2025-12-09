# Release Workflow Guide

> **Note:** This project now uses **GitHub Actions** for automated multi-platform builds. See [GITHUB_ACTIONS_GUIDE.md](GITHUB_ACTIONS_GUIDE.md) for the recommended approach.

## 🚀 Automated Release (Recommended)

The easiest way to create a release is using GitHub Actions:

1. **Update version** in `package.json`
2. **Commit and push** to `main` branch
3. **Create and push a tag**:
   ```powershell
   git tag v1.5.8
   git push origin v1.5.8
   ```
4. **Done!** GitHub Actions will automatically:
   - Build Windows installer
   - Build macOS installer
   - Create GitHub release with all files

See [GITHUB_ACTIONS_GUIDE.md](GITHUB_ACTIONS_GUIDE.md) for full details.

---

## 🛠️ Manual Release (Fallback)

If you need to build manually (e.g., GitHub Actions unavailable):

### Prerequisites

1. **GitHub Token**: Generate a Personal Access Token (PAT) with `repo` scope
   - Go to: GitHub → Settings → Developer settings → Personal access tokens
   - Create token with `repo` scope
   - Save securely

### Steps

#### 1. Update Version

Edit `package.json`:
```json
{
  "version": "1.5.8"
}
```

#### 2. Build

**Windows:**
```powershell
$env:GH_TOKEN="YOUR_GITHUB_TOKEN"
npm run dist
```

**macOS:**
```bash
export GH_TOKEN="YOUR_GITHUB_TOKEN"
npm run dist
```

#### 3. Publish Release

1. Go to: https://github.com/MyBabboInc/PrintCenterClient/releases
2. Create new release with tag `v1.5.8`
3. Upload files from `dist/`:
   - **Windows**: `MyBabbo-Print-Centre-Setup-{version}.exe`, `.exe.blockmap`, `latest.yml`
   - **macOS**: `.dmg`, `.dmg.blockmap`, `.pkg`, `latest-mac.yml`
4. Publish release

---

## Auto-Update Behavior

Once released:
- ✅ Users receive update notification on app startup
- ✅ Update downloads in background
- ✅ User prompted to restart and install

---

## Troubleshooting

### Build Issues
- See [UPDATE_TROUBLESHOOTING.md](UPDATE_TROUBLESHOOTING.md) for auto-update debugging
- See [FILENAME_FIX.md](FILENAME_FIX.md) for artifact naming issues

### GitHub Actions
- See [GITHUB_ACTIONS_GUIDE.md](GITHUB_ACTIONS_GUIDE.md) for workflow configuration and troubleshooting
