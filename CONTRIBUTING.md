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

1. In a pull request, set the same version in `package.json` and `src-tauri/Cargo.toml`, and run `cargo check` from `src-tauri/` to update `Cargo.lock`. A prerelease number must be numeric, as Windows installers refuse anything else.
2. Merge it. Any merge to `main` with an unreleased version builds every platform.
3. Approve the `release` environment when the run asks. Only this step can use the signing key.
4. Test the draft release, then publish it. Publishing creates the tag and offers the update to installed apps.

The website is separate: every merge to `main` deploys [archstudio.app](https://archstudio.app) once CI passes.

A run that fails uses up nothing: merge a fix and it runs again, replacing any old draft. A later merge also replaces a run still waiting for approval.

Builds run with no secrets. A separate job that runs no build scripts signs the update files, so a compromised dependency never comes near the signing key.

`bun run tauri build` needs `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` set, because it signs update files. A throwaway key from `bun run tauri signer generate` is fine for a local build.

New npm packages are held back for seven days by `bunfig.toml`. To take an urgent fix sooner, list it under `minimumReleaseAgeExcludes`.
