# Release Workflow Guide

> **Note:** This project now uses **GitHub Actions** for automated multi-platform builds. See [GITHUB_ACTIONS_GUIDE.md](GITHUB_ACTIONS_GUIDE.md) for the recommended approach.

## 🚀 Automated Release (Recommended)

The project uses **GitHub Actions** for automated multi-platform builds with a hybrid approach:

### Automatic Builds on Every Main Merge
- ✅ **Every push to `main` branch** triggers a build for Windows and macOS
- ✅ Build artifacts are stored for 5 days (for testing/validation)
- ⚠️ **No release is created** - just builds to verify everything works

### Release Creation (Tag-Based)
To create an **official release** with installers published to GitHub:

1. **Update version** in `package.json`
2. **Commit and push** to `main` branch (this will build but not release)
3. **Create and push a version tag**:
   ```powershell
   git tag v1.6.2
   git push origin v1.6.2
   ```
4. **Done!** GitHub Actions will automatically:
   - Build Windows installer
   - Build macOS installer  
   - **Create GitHub release** with all files and release notes

**✨ Benefit**: Every merge to `main` validates that builds work, but you control when releases are published via tags.

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
