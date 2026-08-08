---
name: Picha Pulse media architecture
description: Durable choices for the Kenya-focused media board and its upload/install experience.
---

Picha Pulse is intentionally a public browsing surface with authenticated publishing. Uploaded images and videos use direct presigned App Storage uploads; the API catalog stores metadata and the returned object path, never file bytes.

**Why:** Direct storage keeps larger video uploads out of the Express request body and makes full-screen serving practical, while authentication protects write-capable upload URL creation.

**How to apply:** Keep new media features centered on the `Media` catalog and object paths. Use device-local saved items for anonymous curation, and keep the web app PWA-friendly so mobile users can install it without a separate native package.