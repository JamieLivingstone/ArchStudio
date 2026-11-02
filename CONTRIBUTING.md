# Contributing

Bugs and ideas are welcome as [issues](https://github.com/JamieLivingstone/ArchStudio/issues). For a security problem, see [SECURITY.md](SECURITY.md).

## Development

```sh
bun install
bun run tauri dev    # the desktop app
bun run dev          # the frontend only, at http://localhost:1420
```

Before opening a pull request:

```sh
bun run typecheck
bun run lint
bun run test         # Vitest, not `bun test`
bun run build
```

And from `src-tauri/`:

```sh
cargo clippy
cargo test
```

## Releasing

Set the same version in `package.json` and `src-tauri/Cargo.toml`, then push a tag such as `v0.1.0-1`. A prerelease number must be numeric, as Windows installers refuse anything else.

The tag builds every platform into a draft release. Publishing the draft is what offers the update to installed apps.

Builds run with no secrets. A separate job that runs no build scripts signs the update files, so a compromised dependency never comes near the signing key.

`bun run tauri build` needs `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` set, because it signs update files. A throwaway key from `bun run tauri signer generate` is fine for a local build.

New npm packages are held back for seven days by `bunfig.toml`. To take an urgent fix sooner, list it under `minimumReleaseAgeExcludes`.
