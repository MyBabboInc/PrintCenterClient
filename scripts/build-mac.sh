#!/bin/bash

echo "Building MyBabbo Print Centre for macOS..."

# Ensure dependencies are installed
npm install

# Run electron-builder
npm run dist -- --mac

echo "Build complete. Check /dist folder."
