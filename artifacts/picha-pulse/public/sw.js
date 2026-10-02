const CACHE_PREFIX = 'picha-pulse:';
const CACHE_VERSION = 'v2';
const SHELL_CACHE = `${CACHE_PREFIX}shell:${CACHE_VERSION}`;
const DATA_CACHE = `${CACHE_PREFIX}public-data:${CACHE_VERSION}`;
const IMAGE_CACHE = `${CACHE_PREFIX}media-images:${CACHE_VERSION}`;
const LEGACY_CACHES = ['picha-pulse-shell-v1'];
const APP_ROOT = new URL('./', self.registration.scope);
const MAX_DATA_ENTRIES = 40;
const MAX_IMAGE_ENTRIES = 30;
const MAX_DATA_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

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
            ![SHELL_CACHE, DATA_CACHE, IMAGE_CACHE].includes(key)) ||
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