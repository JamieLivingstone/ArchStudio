# Security

ArchStudio handles API keys and sends diagrams to the model provider you choose, so security reports matter.

## Reporting a vulnerability

Please report it privately through [GitHub's security advisories](https://github.com/JamieLivingstone/ArchStudio/security/advisories/new), not in a public issue. Include what you found, how to reproduce it and what it affects.

## Supported versions

Fixes go into the latest release and into [archstudio.app](https://archstudio.app). The desktop app updates itself.

## How keys are kept

The README covers [best practices for any API key](README.md#api-key-best-practices).

- **Desktop:** keys stay in your system keychain. The app can use a saved key but has no way to read it back, and requests go through a native proxy that only talks to the provider's own address.
- **Browser:** keys stay in that tab's session storage until you close it.

There are no accounts and no ArchStudio backend, so keys and diagrams never reach a server of ours.
