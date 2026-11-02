#!/usr/bin/env bash
# Flattens the unsigned builds into one folder, then signs the files the updater downloads.
set -euo pipefail

unsigned=$1
release=$2
mkdir -p "$release"

# Both macOS builds produce the same file name.
mv "$unsigned/unsigned-aarch64-apple-darwin/macos/ArchStudio.app.tar.gz" "$release/ArchStudio_aarch64.app.tar.gz"
mv "$unsigned/unsigned-x86_64-apple-darwin/macos/ArchStudio.app.tar.gz" "$release/ArchStudio_x64.app.tar.gz"

find "$unsigned" -type f -exec mv {} "$release/" \;

for file in "$release"/*.app.tar.gz "$release"/*.AppImage "$release"/*-setup.exe; do
  bun run tauri signer sign "$file" >/dev/null
done
