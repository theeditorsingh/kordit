// Kordit Service Worker v1.0
const CACHE_NAME = 'kordit-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
];

// IndexedDB for offline mutation queue
const DB_NAME = 'kordit-offline';
const STORE_NAME = 'mutation-queue';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = reject;
  });
}

async function queueMutation(data) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).add({ ...data, timestamp: Date.now() });
}

async function flushMutationQueue() {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const all = await new Promise((resolve) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
  });

  for (const mutation of all) {
    try {
      const res = await fetch(mutation.url, {
        method: mutation.method,
        headers: mutation.headers,
        body: mutation.body,
      });
      if (res.ok) {
        store.delete(mutation.id);
      }
    } catch (e) {
      // Still offline, keep in queue
    }
  }
}

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - API routes: Network first, fallback to cache
// - Static assets: Cache first, fallback to network
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET for caching, but handle offline POST mutations
  if (event.request.method !== 'GET') {
    if (!navigator.onLine && url.pathname.startsWith('/api/')) {
      event.respondWith(
        (async () => {
          try {
            return await fetch(event.request.clone());
          } catch {
            // Queue the mutation for later
            const body = await event.request.text();
            await queueMutation({
              url: event.request.url,
              method: event.request.method,
              headers: Object.fromEntries(event.request.headers.entries()),
              body,
            });
            return new Response(JSON.stringify({ queued: true }), {
              headers: { 'Content-Type': 'application/json' },
            });
          }
        })()
      );
    }
    return;
  }

  // Network first for API routes
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache first for static assets (_next/static, fonts, etc.)
  if (
    url.pathname.startsWith('/_next/static') ||
    url.pathname.startsWith('/fonts') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.ico')
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return res;
      }))
    );
    return;
  }

  // Default: network first
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// Sync queued mutations when back online
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-mutations') {
    event.waitUntil(flushMutationQueue());
  }
});

// Message handler: manual flush trigger
self.addEventListener('message', (event) => {
  if (event.data === 'FLUSH_QUEUE') {
    flushMutationQueue();
  }
});

// Notification click: focus the app window
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing tab if any
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new tab
      return clients.openWindow('/');
    })
  );
});
