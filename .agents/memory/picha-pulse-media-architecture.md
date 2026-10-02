---
name: Picha Pulse media architecture
description: Durable choices for the Kenya-focused media board and its upload/install experience.
---

Picha Pulse is intentionally a public browsing surface with authenticated publishing. Uploaded images and videos use direct presigned App Storage uploads; the API catalog stores metadata and the returned object path, never file bytes.

**Why:** Direct storage keeps larger video uploads out of the Express request body and makes full-screen serving practical, while authentication protects write-capable upload URL creation.

**How to apply:** Keep new media features centered on the `Media` catalog and object paths. Use device-local saved items for anonymous curation, and keep the web app PWA-friendly so mobile users can install it without a separate native package.

The web app's offline mode caches the app shell, public media feed/detail responses, and a bounded set of previously loaded images. It must not cache authentication responses or replay publishing/upload requests; those actions require an active connection.

**Why:** Offline browsing is useful on unreliable connections, but cached identity data and deferred writes create privacy and duplicate-publish risks.

**How to apply:** Keep service-worker caches limited to public GET reads and downloaded image assets. If adding offline writes or user-specific cached data, design explicit synchronization and account-scoped clearing rather than expanding the cache allowlist.