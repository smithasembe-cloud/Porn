---
name: Native video posters
description: Durable thumbnail handling for native Expo video uploads
---

Expo's native video thumbnail API produces a native image reference suitable for rendering, but it is not a portable file URI for direct object-storage upload. Keep native thumbnail generation for immediate local preview, and retain a server-side extraction path for durable poster storage.

**Why:** A native thumbnail object cannot reliably be converted to an uploadable blob across Expo Go, iOS, Android, and web.

**How to apply:** When adding native video uploads, upload the original first and ensure the API can generate and persist a poster when the client does not provide a thumbnail object path.