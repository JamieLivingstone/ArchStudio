#!/usr/bin/env bash
# Prints the tag to release, or nothing when this version has already been released.
set -euo pipefail

version=$(jq -r .version package.json)
crate=$(grep -m1 '^version = ' src-tauri/Cargo.toml | cut -d'"' -f2)
if [ "$version" != "$crate" ]; then
  echo "package.json says $version but src-tauri/Cargo.toml says $crate" >&2
  exit 1
fi

tag="v$version"
if [ -n "$(git ls-remote --tags origin "refs/tags/$tag")" ]; then
  tag=""
fi
echo "tag=$tag" >>"${GITHUB_OUTPUT:-/dev/stdout}"
