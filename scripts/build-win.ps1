# Build script for Windows
Write-Host "Building MyBabbo Print Centre for Windows..."

# Ensure dependencies are installed
npm install

# Run electron-builder
npm run dist -- --win

Write-Host "Build complete. Check /dist folder."
