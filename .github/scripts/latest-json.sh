#!/usr/bin/env bash
# Writes latest.json, the file installed apps read to find an update.
set -euo pipefail

release=$1
tag=${TAG:?}
base="https://github.com/${GITHUB_REPOSITORY:?}/releases/download/$tag"

entry() {
  local path=$2
  local name=${path##*/}
  jq -n --arg platform "$1" --arg url "$base/$name" --rawfile signature "$path.sig" \
    '{($platform): {url: $url, signature: ($signature | rtrimstr("\n"))}}'
}

one() {
  local matches=("$release"/$1)
  [ "${#matches[@]}" -eq 1 ] && [ -f "${matches[0]}" ] || { echo "Expected one file for $1" >&2; exit 1; }
  echo "${matches[0]}"
}

{
  entry darwin-aarch64 "$(one 'ArchStudio_aarch64.app.tar.gz')"
  entry darwin-x86_64 "$(one 'ArchStudio_x64.app.tar.gz')"
  entry linux-x86_64 "$(one '*.AppImage')"
  entry windows-x86_64 "$(one '*-setup.exe')"
} | jq -s --arg version "${tag#v}" --arg date "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{version: $version, pub_date: $date, platforms: add}' >"$release/latest.json"
