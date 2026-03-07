// ============================================================
// MIDA Sales Intelligence - Service Worker
// Gestisce: cache offline, notifiche push, background sync
// ============================================================

const CACHE_VERSION = 'mida-v1';
const CACHE_ASSETS = [
  '/mida-sales/',
  '/mida-sales/index.html',
  '/mida-sales/mida_pipeline_kanban_v3.html',
  '/mida-sales/mida_sales_dashboard_v2.html',
  '/mida-sales/manifest.json',
  '/mida-sales/icons/icon-192.png',
  '/mida-sales/icons/icon-512.png'
];

// ── INSTALL: precache assets ─────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing MIDA Service Worker...');
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      return cache.addAll(CACHE_ASSETS).catch(err => {
        console.warn('[SW] Cache addAll partial failure (ok in dev):', err);
      });
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE: clean old caches ───────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── FETCH: network-first, fallback to cache ──────────────────
self.addEventListener('fetch', event => {
  // Solo richieste GET, non API Supabase
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('supabase.co')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Aggiorna cache con risposta fresca
        const clone = response.clone();
        caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
        return response;
      })
      .catch(() => {
        // Offline: servi dalla cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Fallback per navigazione offline
          if (event.request.mode === 'navigate') {
            return caches.match('/mida-sales/index.html');
          }
        });
      })
  );
});

// ── PUSH: ricevi notifica dal server ────────────────────────
self.addEventListener('push', event => {
  console.log('[SW] Push ricevuto');

  let data = {
    title: 'MIDA Sales Intelligence',
    body: 'Hai un aggiornamento sulla tua pipeline.',
    icon: '/mida-sales/icons/icon-192.png',
    badge: '/mida-sales/icons/icon-192.png',
    tag: 'mida-reminder',
    url: '/mida-sales/mida_pipeline_kanban_v3.html',
    type: 'reminder'
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    data: { url: data.url, type: data.type },
    vibrate: [200, 100, 200],
    requireInteraction: data.type === 'deadline', // Scadenze restano visibili
    actions: [
      { action: 'open', title: 'Apri Pipeline' },
      { action: 'dismiss', title: 'Ignora' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ── NOTIFICATION CLICK ───────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/mida-sales/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Se c'è già una finestra aperta, portala in primo piano
      for (const client of windowClients) {
        if (client.url.includes('mida-sales') && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Altrimenti apri una nuova finestra
      return clients.openWindow(url);
    })
  );
});

// ── MESSAGE: comunicazione con la pagina ─────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
