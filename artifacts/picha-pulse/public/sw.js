const CACHE_PREFIX = 'picha-pulse:';
const CACHE_VERSION = 'v3';
const SHELL_CACHE = `${CACHE_PREFIX}shell:${CACHE_VERSION}`;
const DATA_CACHE = `${CACHE_PREFIX}public-data:${CACHE_VERSION}`;
const IMAGE_CACHE = `${CACHE_PREFIX}media-images:${CACHE_VERSION}`;
const OFFLINE_CACHE = `${CACHE_PREFIX}offline-saved`;
const LEGACY_CACHES = ['picha-pulse-shell-v1'];
const APP_ROOT = new URL('./', self.registration.scope);
const MAX_DATA_ENTRIES = 40;
const MAX_IMAGE_ENTRIES = 30;
const MAX_DATA_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_OFFLINE_ITEMS = 25;
const MAX_OFFLINE_ITEM_BYTES = 5 * 1024 * 1024;
const MAX_OFFLINE_TOTAL_BYTES = 30 * 1024 * 1024;
const OFFLINE_INDEX_URL = new URL('__picha_pulse_offline_index__', APP_ROOT).href;

async function trimCache(cache, maxEntries) {
  const keys = await cache.keys();
  const overflow = keys.length - maxEntries;
  if (overflow > 0) {
    await Promise.all(keys.slice(0, overflow).map((key) => cache.delete(key)));
  }
}

async function storeLimited(cache, request, response, maxBytes, maxEntries) {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) return;

  const body = await response.clone().blob();
  if (body.size > maxBytes) return;

  await cache.delete(request);
  await cache.put(request, new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  }));
  await trimCache(cache, maxEntries);
}

async function cacheShell() {
  const cache = await caches.open(SHELL_CACHE);
  const shellUrl = APP_ROOT.href;
  const response = await fetch(shellUrl, { cache: 'reload' });
  if (!response.ok) throw new Error(`App shell returned ${response.status}`);
  await cache.put(shellUrl, response.clone());

  const html = await response.text();
  const assets = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/g)]
    .map((match) => new URL(match[1], shellUrl))
    .filter((url) => url.origin === APP_ROOT.origin && url.pathname.startsWith(APP_ROOT.pathname));
  const appFiles = [
    'manifest.webmanifest',
    'favicon.svg',
    'picha-pulse-logo.svg',
    'picha-pulse-icon.png',
    'icons/picha-pulse-192.png',
    'icons/picha-pulse-512.png',
    'icons/picha-pulse-maskable-512.png',
    ...assets.map((url) => url.href),
  ];

  await Promise.all(appFiles.map(async (file) => {
    const url = new URL(file, APP_ROOT);
    try {
      const assetResponse = await fetch(url.href, { cache: 'reload' });
      if (assetResponse.ok) await cache.put(url.href, assetResponse);
    } catch {
      // Keep installation available even if an optional icon or stylesheet is unavailable.
    }
  }));
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    await cacheShell();
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) =>
          (key.startsWith(CACHE_PREFIX) &&
            ![SHELL_CACHE, DATA_CACHE, IMAGE_CACHE, OFFLINE_CACHE].includes(key)) ||
          LEGACY_CACHES.includes(key),
        )
        .map((key) => caches.delete(key)),
    );
    await self.clients.claim();
  })());
});

function isPublicMediaRead(url) {
  const path = url.pathname.slice(APP_ROOT.pathname.length);
  return /^api\/media(?:\/\d+(?:\/related)?)?$/.test(path);
}

function mediaDetailUrl(id) {
  return new URL(`api/media/${id}`, APP_ROOT).href;
}

function mediaImageUrl(objectPath) {
  if (typeof objectPath !== 'string' || !objectPath.startsWith('/')) return null;
  const url = new URL(`/api/storage${objectPath}`, APP_ROOT.origin);
  if (url.origin !== APP_ROOT.origin || !/^\/api\/storage\/(?:objects|public-objects)\//.test(url.pathname)) return null;
  return url.href;
}

async function readOfflineIndex(cache) {
  try {
    const response = await cache.match(OFFLINE_INDEX_URL);
    const value = response ? await response.json() : [];
    return Array.isArray(value) ? value.filter((entry) => Number.isInteger(entry?.id)) : [];
  } catch {
    return [];
  }
}

async function writeOfflineIndex(cache, index) {
  await cache.put(OFFLINE_INDEX_URL, new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json' },
  }));
}

function mediaJsonResponse(media) {
  return new Response(JSON.stringify(media), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

async function removeOfflineMedia(id) {
  if (!Number.isInteger(id) || id <= 0) return;
  const cache = await caches.open(OFFLINE_CACHE);
  const index = await readOfflineIndex(cache);
  const entry = index.find((item) => item.id === id);
  await cache.delete(mediaDetailUrl(id));
  if (entry?.imageUrl) await cache.delete(entry.imageUrl);
  await writeOfflineIndex(cache, index.filter((item) => item.id !== id));
}

async function saveOfflineMedia(media) {
  if (!media || !Number.isInteger(media.id) || media.id <= 0 || !['image', 'video'].includes(media.type)) {
    throw new Error('This moment cannot be saved for offline viewing.');
  }

  const detailUrl = mediaDetailUrl(media.id);
  const objectPath = media.type === 'video' ? media.thumbnailObjectPath : media.objectPath;
  const imageUrl = objectPath ? mediaImageUrl(objectPath) : null;
  let imageResponse = null;
  let imageBytes = 0;

  if (imageUrl) {
    const response = await fetch(imageUrl, { credentials: 'same-origin' });
    if (!response.ok) throw new Error('The photo or clip poster could not be downloaded.');
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) throw new Error('The file is not a supported image.');
    const blob = await response.blob();
    imageBytes = blob.size;
    if (imageBytes > MAX_OFFLINE_ITEM_BYTES) {
      throw new Error('This image is too large to save offline. The limit is 5 MB per moment.');
    }
    imageResponse = new Response(blob, { headers: response.headers });
  }

  const detailResponse = mediaJsonResponse(media);
  const detailBytes = new Blob([JSON.stringify(media)]).size;
  const itemBytes = imageBytes + detailBytes;
  if (itemBytes > MAX_OFFLINE_ITEM_BYTES) {
    throw new Error('This moment is too large to save offline. The limit is 5 MB per moment.');
  }

  const cache = await caches.open(OFFLINE_CACHE);
  const index = await readOfflineIndex(cache);
  const existing = index.find((entry) => entry.id === media.id);
  const currentBytes = index.reduce((total, entry) => total + (Number(entry.bytes) || 0), 0);
  const projectedBytes = currentBytes - (Number(existing?.bytes) || 0) + itemBytes;
  if (!existing && index.length >= MAX_OFFLINE_ITEMS) {
    throw new Error(`Offline storage is full (${MAX_OFFLINE_ITEMS} moments maximum). Remove a saved moment first.`);
  }
  if (projectedBytes > MAX_OFFLINE_TOTAL_BYTES) {
    throw new Error('Offline storage is full (30 MB maximum). Remove a saved moment first.');
  }

  try {
    if (imageResponse && imageUrl) await cache.put(imageUrl, imageResponse);
    await cache.put(detailUrl, detailResponse);
    const nextIndex = index.filter((entry) => entry.id !== media.id);
    nextIndex.push({ id: media.id, imageUrl, bytes: itemBytes });
    await writeOfflineIndex(cache, nextIndex);
  } catch {
    if (!existing) {
      await cache.delete(detailUrl);
      if (imageUrl) await cache.delete(imageUrl);
    } else if (imageUrl && imageUrl !== existing.imageUrl) {
      await cache.delete(imageUrl);
    }
    throw new Error('The browser could not store this moment offline. Check available device storage.');
  }

  return {
    ok: true,
    offlineImageAvailable: Boolean(imageResponse),
    message: imageResponse
      ? media.type === 'video'
        ? 'Clip poster saved. Video playback still needs internet.'
        : 'Photo saved for offline viewing.'
      : 'Moment details saved. No preview image was available to save.',
  };
}

self.addEventListener('message', (event) => {
  const port = event.ports?.[0];
  if (!port) return;
  event.waitUntil((async () => {
    try {
      const message = event.data || {};
      if (message.type === 'SAVE_MEDIA_FOR_OFFLINE') {
        port.postMessage(await saveOfflineMedia(message.media));
      } else if (message.type === 'REMOVE_MEDIA_FROM_OFFLINE') {
        await removeOfflineMedia(message.id);
        port.postMessage({ ok: true, offlineImageAvailable: false, message: 'Removed from offline storage.' });
      } else {
        port.postMessage({ ok: false, reason: 'unknown-message', message: 'Unsupported offline storage action.' });
      }
    } catch (error) {
      port.postMessage({
        ok: false,
        reason: 'save-failed',
        message: error instanceof Error ? error.message : 'This moment could not be saved offline.',
      });
    } finally {
      port.close();
    }
  })());
});

function isMediaImage(request, url) {
  const path = url.pathname.slice(APP_ROOT.pathname.length);
  return request.destination === 'image' && /^api\/storage\/(?:objects|public-objects)\//.test(path);
}

async function networkFirst(request, cacheName, maxBytes, maxEntries) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      const cacheableType = cacheName === DATA_CACHE
        ? contentType.includes('application/json')
        : contentType.startsWith('image/');
      if (cacheableType) {
        await storeLimited(cache, request, response, maxBytes, maxEntries).catch(() => undefined);
      }
    }
    return response;
  } catch {
    if (cacheName === DATA_CACHE || cacheName === IMAGE_CACHE) {
      const pinned = await caches.open(OFFLINE_CACHE);
      const saved = await pinned.match(request);
      if (saved) return saved;
    }
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error('This content is not available offline.');
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== APP_ROOT.origin || !url.pathname.startsWith(APP_ROOT.pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      try {
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(request, response.clone()).catch(() => undefined);
        }
        return response;
      } catch {
        return (await cache.match(request)) || (await cache.match(APP_ROOT.href)) || Response.error();
      }
    })());
    return;
  }

  if (isPublicMediaRead(url)) {
    event.respondWith(networkFirst(request, DATA_CACHE, MAX_DATA_BYTES, MAX_DATA_ENTRIES));
    return;
  }

  if (isMediaImage(request, url)) {
    event.respondWith(networkFirst(request, IMAGE_CACHE, MAX_IMAGE_BYTES, MAX_IMAGE_ENTRIES));
    return;
  }

  if (url.pathname.includes('/api/')) return;

  if (['script', 'style', 'font', 'worker'].includes(request.destination)) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(request, response.clone()).catch(() => undefined);
        }
        return response;
      } catch {
        return Response.error();
      }
    })());
  }
});