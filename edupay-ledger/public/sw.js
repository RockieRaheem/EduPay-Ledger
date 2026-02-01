// Service Worker for EduPay Ledger PWA
// Provides offline support, caching, and background sync

const CACHE_VERSION = "v2";
const STATIC_CACHE = `edupay-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `edupay-dynamic-${CACHE_VERSION}`;
const API_CACHE = `edupay-api-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";

// IndexedDB database name for offline queue
const DB_NAME = "edupay-offline-db";
const DB_VERSION = 1;
const STORE_PENDING_PAYMENTS = "pending-payments";
const STORE_PENDING_ACTIONS = "pending-actions";

// Static assets to precache (shell assets)
const PRECACHE_ASSETS = [
  "/",
  "/dashboard",
  "/students",
  "/payments",
  "/payments/record",
  "/reports",
  "/overdue",
  "/settings",
  "/manifest.json",
  "/offline.html",
];

// API routes to cache with network-first strategy
const API_ROUTES = [
  "/api/students",
  "/api/payments",
  "/api/dashboard",
  "/api/reports",
];

// ============================================================================
// IndexedDB Helper Functions
// ============================================================================

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create pending payments store
      if (!db.objectStoreNames.contains(STORE_PENDING_PAYMENTS)) {
        const paymentStore = db.createObjectStore(STORE_PENDING_PAYMENTS, {
          keyPath: "id",
        });
        paymentStore.createIndex("timestamp", "timestamp", { unique: false });
        paymentStore.createIndex("status", "status", { unique: false });
      }

      // Create pending actions store (for other offline operations)
      if (!db.objectStoreNames.contains(STORE_PENDING_ACTIONS)) {
        const actionStore = db.createObjectStore(STORE_PENDING_ACTIONS, {
          keyPath: "id",
        });
        actionStore.createIndex("type", "type", { unique: false });
        actionStore.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
  });
}

async function addPendingPayment(payment) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_PENDING_PAYMENTS], "readwrite");
    const store = transaction.objectStore(STORE_PENDING_PAYMENTS);

    const paymentWithMeta = {
      ...payment,
      id:
        payment.id ||
        `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      status: "pending",
      syncAttempts: 0,
    };

    const request = store.add(paymentWithMeta);
    request.onsuccess = () => resolve(paymentWithMeta);
    request.onerror = () => reject(request.error);
  });
}

async function getPendingPayments() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_PENDING_PAYMENTS], "readonly");
    const store = transaction.objectStore(STORE_PENDING_PAYMENTS);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function updatePendingPayment(id, updates) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_PENDING_PAYMENTS], "readwrite");
    const store = transaction.objectStore(STORE_PENDING_PAYMENTS);

    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const payment = getRequest.result;
      if (payment) {
        const updated = { ...payment, ...updates };
        const putRequest = store.put(updated);
        putRequest.onsuccess = () => resolve(updated);
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        reject(new Error("Payment not found"));
      }
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

async function removePendingPayment(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_PENDING_PAYMENTS], "readwrite");
    const store = transaction.objectStore(STORE_PENDING_PAYMENTS);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getPendingCount() {
  const payments = await getPendingPayments();
  return payments.length;
}

// ============================================================================
// Service Worker Lifecycle Events
// ============================================================================

// Install event - cache core assets
self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker...");
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log("[SW] Precaching core assets");
      return cache.addAll(PRECACHE_ASSETS);
    }),
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker...");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return (
              name.startsWith("edupay-") &&
              name !== STATIC_CACHE &&
              name !== DYNAMIC_CACHE &&
              name !== API_CACHE
            );
          })
          .map((name) => {
            console.log("[SW] Deleting old cache:", name);
            return caches.delete(name);
          }),
      );
    }),
  );
  self.clients.claim();
});

// ============================================================================
// Fetch Strategies
// ============================================================================

// Cache-first strategy for static assets
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // Return offline page for navigation
    if (request.mode === "navigate") {
      return caches.match(OFFLINE_URL);
    }
    throw error;
  }
}

// Network-first strategy for API calls (with cache fallback)
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Add header to indicate stale data
      const headers = new Headers(cachedResponse.headers);
      headers.set("X-Cache-Status", "stale");
      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers,
      });
    }
    throw error;
  }
}

// Stale-while-revalidate strategy for dynamic content
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  });

  return cachedResponse || fetchPromise;
}

// ============================================================================
// Fetch Event Handler
// ============================================================================

// Fetch event - route requests to appropriate strategy
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests for caching (but handle POST for offline queue)
  if (request.method !== "GET") {
    // Handle offline payment submissions
    if (request.method === "POST" && url.pathname === "/api/payments") {
      event.respondWith(handleOfflinePayment(request));
      return;
    }
    return;
  }

  // Skip Chrome extension and other non-http(s) requests
  if (!url.protocol.startsWith("http")) {
    return;
  }

  // Route based on request type
  if (API_ROUTES.some((route) => url.pathname.startsWith(route))) {
    // API requests - network first with cache fallback
    event.respondWith(networkFirst(request));
  } else if (request.destination === "image") {
    // Images - cache first
    event.respondWith(cacheFirst(request));
  } else if (request.mode === "navigate") {
    // Page navigations - network first, offline fallback
    event.respondWith(
      networkFirst(request).catch(() => caches.match(OFFLINE_URL)),
    );
  } else {
    // Everything else - stale while revalidate
    event.respondWith(staleWhileRevalidate(request));
  }
});

// Handle offline payment submissions
async function handleOfflinePayment(request) {
  try {
    // Try to submit online first
    const response = await fetch(request.clone());
    return response;
  } catch (error) {
    // Network failed - queue for later
    const payment = await request.json();
    const queuedPayment = await addPendingPayment(payment);

    // Notify client
    notifyClients({
      type: "PAYMENT_QUEUED",
      payment: queuedPayment,
      message: "Payment saved offline and will sync when connected",
    });

    // Register for background sync
    if ("sync" in self.registration) {
      await self.registration.sync.register("sync-payments");
    }

    // Return success response (offline queued)
    return new Response(
      JSON.stringify({
        success: true,
        offline: true,
        queuedPayment,
        message: "Payment queued for sync",
      }),
      {
        status: 202,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

// ============================================================================
// Background Sync
// ============================================================================

// Background sync for offline payments
self.addEventListener("sync", (event) => {
  console.log("[SW] Sync event:", event.tag);

  if (event.tag === "sync-payments") {
    event.waitUntil(syncPendingPayments());
  } else if (event.tag === "sync-actions") {
    event.waitUntil(syncPendingActions());
  }
});

async function syncPendingPayments() {
  console.log("[SW] Starting payment sync...");
  const pendingPayments = await getPendingPayments();

  if (pendingPayments.length === 0) {
    console.log("[SW] No pending payments to sync");
    return;
  }

  console.log(`[SW] Syncing ${pendingPayments.length} pending payments`);

  let syncedCount = 0;
  let failedCount = 0;

  for (const payment of pendingPayments) {
    try {
      // Update status to syncing
      await updatePendingPayment(payment.id, { status: "syncing" });

      const response = await fetch("/api/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Offline-Payment": "true",
        },
        body: JSON.stringify({
          ...payment,
          offlineId: payment.id,
          offlineTimestamp: payment.timestamp,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        await removePendingPayment(payment.id);
        syncedCount++;

        // Notify clients of successful sync
        notifyClients({
          type: "PAYMENT_SYNCED",
          offlineId: payment.id,
          serverId: result.id,
          payment: result,
        });
      } else {
        // Update with failure info
        await updatePendingPayment(payment.id, {
          status: "failed",
          syncAttempts: payment.syncAttempts + 1,
          lastError: `Server error: ${response.status}`,
        });
        failedCount++;
      }
    } catch (error) {
      console.error("[SW] Failed to sync payment:", payment.id, error);
      await updatePendingPayment(payment.id, {
        status: "pending",
        syncAttempts: payment.syncAttempts + 1,
        lastError: error.message,
      });
      failedCount++;
    }
  }

  // Notify completion
  notifyClients({
    type: "SYNC_COMPLETE",
    syncedCount,
    failedCount,
    remaining: failedCount,
  });

  console.log(
    `[SW] Sync complete: ${syncedCount} synced, ${failedCount} failed`,
  );
}

async function syncPendingActions() {
  // Placeholder for syncing other offline actions
  console.log("[SW] Syncing pending actions...");
}

// ============================================================================
// Client Communication
// ============================================================================

function notifyClients(message) {
  self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
    clients.forEach((client) => {
      client.postMessage(message);
    });
  });
}

// Listen for messages from clients
self.addEventListener("message", async (event) => {
  const { type, data } = event.data;

  switch (type) {
    case "GET_PENDING_COUNT":
      const count = await getPendingCount();
      event.source.postMessage({ type: "PENDING_COUNT", count });
      break;

    case "GET_PENDING_PAYMENTS":
      const payments = await getPendingPayments();
      event.source.postMessage({ type: "PENDING_PAYMENTS", payments });
      break;

    case "FORCE_SYNC":
      if ("sync" in self.registration) {
        await self.registration.sync.register("sync-payments");
      } else {
        // Fallback for browsers without Background Sync
        await syncPendingPayments();
      }
      break;

    case "CLEAR_PENDING":
      // Clear a specific pending payment (e.g., user cancelled)
      if (data?.id) {
        await removePendingPayment(data.id);
        notifyClients({ type: "PENDING_REMOVED", id: data.id });
      }
      break;

    case "SKIP_WAITING":
      self.skipWaiting();
      break;
  }
});

// Push notification handling
self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};

  const options = {
    body: data.body || "New notification from EduPay Ledger",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    vibrate: [100, 50, 100],
    data: {
      url: data.url || "/dashboard",
    },
    actions: [
      {
        action: "view",
        title: "View",
        icon: "/icons/action-view.png",
      },
      {
        action: "dismiss",
        title: "Dismiss",
        icon: "/icons/action-dismiss.png",
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "EduPay Ledger", options),
  );
});

// Notification click handling
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") {
    return;
  }

  const urlToOpen = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        // Open new window if none exists
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      }),
  );
});
