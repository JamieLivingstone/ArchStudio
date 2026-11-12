<div align="center">

<img src="public/favicon.svg" alt="ArchStudio logo" width="72" height="72">

<h1>ArchStudio</h1>

<p><strong>The architecture editor that understands what you're designing.</strong><br>
Design systems from real components, and review AI changes like a pull request.<br>
Free, open source and no account needed.</p>

<p>
  <a href="https://archstudio.app"><img alt="Try it at archstudio.app" src="https://img.shields.io/badge/try%20it-archstudio.app-4f46e5?style=flat-square"></a>
  <a href="LICENSE.md"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-22c55e?style=flat-square"></a>
  <img alt="Runs on web, macOS, Windows and Linux" src="https://img.shields.io/badge/runs%20on-web%20%7C%20macOS%20%7C%20Windows%20%7C%20Linux-64748b?style=flat-square">
  <img alt="Status: beta" src="https://img.shields.io/badge/status-beta-f59e0b?style=flat-square">
</p>

<p><a href="https://archstudio.app"><strong>Open ArchStudio</strong></a> &nbsp;·&nbsp; <a href="#get-started">Download</a> &nbsp;·&nbsp; <a href="#features">Features</a> &nbsp;·&nbsp; <a href="#roadmap">Roadmap</a></p>

</div>

<div align="center">
  <img src="docs/screenshot.jpg" alt="ArchStudio with the assistant proposing a cache in front of an orders database: the new cache and changed database are marked on the canvas, and each change can be accepted or rejected in the assistant panel">
</div>

![ArchStudio — build an architecture diagram from real components and set what each one does](./docs/archstudio-demo.gif)

## Features

- **A canvas that gets out of your way:** drag in components, snap to alignment, copy and paste, zoom with a minimap, and undo anything
- **29 real components:** clients, services, workers, edge, data, messaging, identity, observability and AI
- **Boundaries that mean something:** nest services, teams, domains, trust zones and regions
- **AI that understands your system:** it reads your real components and their options, not a picture, so it can answer questions and review your design for risks and gaps
- **AI changes you stay in control of:** describe a change, then [review it like a pull request](#review-ai-changes-like-a-pull-request) and accept or reject each part
- **Lines that keep themselves tidy:** right-angled and routed around whatever is in the way
- **One-click Format:** arrange the whole diagram when it gets messy
- **Templates:** start from a URL shortener, e-commerce platform, real-time chat or AI assistant with retrieval
- **Plain JSON files:** readable, diffable and easy to keep in git
- **Private by default:** no accounts or cloud sync, and your diagram only goes to the provider you chose, when you send a message
- **PNG export:** drop a diagram straight into a doc or slide

## More than boxes and lines

In most diagramming tools, a database is a rectangle with the word "database" in it. In ArchStudio, it's a database.

Each component knows what matters about it, and every option explains its trade-offs as you go. Your diagram ends up describing how the system actually works, not just how it looks.

| Component | Details you can set |
| --- | --- |
| **Database** | Data model, replication, partitioning, consistency, failover, tables or collections |
| **Queue** | Delivery guarantees, ordering, retries, dead-letter handling, retention |
| **Cache** | Strategy, TTL, invalidation, eviction, what happens on failure |

Everything stays generic, so "PostgreSQL" is a tag. You describe the design, not the vendor.

## Review AI changes like a pull request

ArchStudio is a complete editor without AI. Connect your own Anthropic or OpenAI key, and the assistant never touches your diagram until you say so:

- **See it on the canvas:** new and changed components are marked in place, and removed lines stay visible until you decide
- **Read a real diff:** added, changed and removed, down to details like `Replication: Primary-replica`
- **Decide change by change:** accept or reject each part or all of it, and undo it in one step
- **Trust what you're shown:** every proposal is checked against the diagram's rules before you see it

## Get started

**In your browser:** open **[archstudio.app](https://archstudio.app)**. There is nothing to install and no sign-up.

**On your desktop:** download it for macOS, Windows or Linux from [Releases](https://github.com/JamieLivingstone/ArchStudio/releases). It updates itself and keeps your API keys in your system keychain.

The desktop app isn't signed with a paid certificate, so your system will warn you the first time:

- **macOS:** move the app to Applications, then run `xattr -cr /Applications/ArchStudio.app` in Terminal.
- **Windows:** on the SmartScreen warning, choose **More info**, then **Run anyway**.

ArchStudio is in beta, so expect rough edges. Your files are safe: a diagram you save today will keep opening in later versions.

## API key best practices

ArchStudio only ever sends your key to the provider you chose. These habits are good practice for any app that uses an API key, and protect you from things outside the app, such as a rogue browser extension.

- **Use a key just for ArchStudio**, so you can revoke it without touching your other projects.
- **Set a spending limit.** On Anthropic, use a separate workspace with its own [limit](https://console.anthropic.com/settings/limits). On OpenAI, use a separate project with a [limit](https://platform.openai.com/settings/organization/limits), and check it stops requests rather than only alerting you.
- **Replace it regularly**, or set an expiry if your provider offers one, and delete it when you stop using ArchStudio.
- **Use the desktop app for regular work**, where your key stays in your system keychain.

## Roadmap

- [ ] Interview mode
- [ ] More templates
- [ ] Local models through Ollama
- [ ] More model providers
- [ ] Whiteboard import

## Contributing

Found a bug or have an idea? [Open an issue](https://github.com/JamieLivingstone/ArchStudio/issues), or see [CONTRIBUTING.md](CONTRIBUTING.md). ArchStudio is [MIT licensed](LICENSE.md).

<div align="center">
  <sub>The canvas is powered by <a href="https://reactflow.dev">React Flow</a> and Format by <a href="https://eclipse.dev/elk/">ELK</a>. Built with <a href="https://tauri.app">Tauri</a>, <a href="https://react.dev">React</a> and the <a href="https://ai-sdk.dev">AI SDK</a>.</sub>
</div>
