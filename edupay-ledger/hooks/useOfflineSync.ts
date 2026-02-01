"use client";

/**
 * Offline Queue Hook & Components
 * Manages offline data sync with conflict resolution
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

// ============================================================================
// Types
// ============================================================================

export type SyncStatus = "idle" | "syncing" | "success" | "error";
export type QueueItemStatus =
  | "pending"
  | "syncing"
  | "synced"
  | "failed"
  | "conflict";

export interface QueueItem {
  id: string;
  type: "payment" | "student" | "settings";
  action: "create" | "update" | "delete";
  data: any;
  timestamp: number;
  status: QueueItemStatus;
  syncAttempts: number;
  lastError?: string;
  conflictData?: any;
}

export interface ConflictResolution {
  id: string;
  localData: any;
  serverData: any;
  resolution: "keep-local" | "keep-server" | "merge";
}

interface OfflineState {
  isOnline: boolean;
  queue: QueueItem[];
  syncStatus: SyncStatus;
  lastSyncTime: number | null;
  conflicts: ConflictResolution[];

  // Actions
  setOnline: (isOnline: boolean) => void;
  addToQueue: (
    item: Omit<QueueItem, "id" | "timestamp" | "status" | "syncAttempts">,
  ) => string;
  updateQueueItem: (id: string, updates: Partial<QueueItem>) => void;
  removeFromQueue: (id: string) => void;
  clearSyncedItems: () => void;
  setSyncStatus: (status: SyncStatus) => void;
  addConflict: (conflict: ConflictResolution) => void;
  resolveConflict: (
    id: string,
    resolution: "keep-local" | "keep-server" | "merge",
  ) => void;
}

// ============================================================================
// Zustand Store for Offline State
// ============================================================================

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set, get) => ({
      isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
      queue: [],
      syncStatus: "idle",
      lastSyncTime: null,
      conflicts: [],

      setOnline: (isOnline) => set({ isOnline }),

      addToQueue: (item) => {
        const id = `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const queueItem: QueueItem = {
          ...item,
          id,
          timestamp: Date.now(),
          status: "pending",
          syncAttempts: 0,
        };

        set((state) => ({
          queue: [...state.queue, queueItem],
        }));

        return id;
      },

      updateQueueItem: (id, updates) => {
        set((state) => ({
          queue: state.queue.map((item) =>
            item.id === id ? { ...item, ...updates } : item,
          ),
        }));
      },

      removeFromQueue: (id) => {
        set((state) => ({
          queue: state.queue.filter((item) => item.id !== id),
        }));
      },

      clearSyncedItems: () => {
        set((state) => ({
          queue: state.queue.filter((item) => item.status !== "synced"),
        }));
      },

      setSyncStatus: (syncStatus) => set({ syncStatus }),

      addConflict: (conflict) => {
        set((state) => ({
          conflicts: [...state.conflicts, conflict],
        }));
      },

      resolveConflict: (id, resolution) => {
        set((state) => ({
          conflicts: state.conflicts.filter((c) => c.id !== id),
        }));
      },
    }),
    {
      name: "ebursar-offline-store",
      partialize: (state) => ({
        queue: state.queue,
        lastSyncTime: state.lastSyncTime,
      }),
    },
  ),
);

// ============================================================================
// useOfflineSync Hook
// ============================================================================

interface UseOfflineSyncOptions {
  autoSync?: boolean;
  syncInterval?: number; // ms
  onSyncStart?: () => void;
  onSyncComplete?: (synced: number, failed: number) => void;
  onSyncError?: (error: Error) => void;
  onConflict?: (
    item: QueueItem,
    serverData: any,
  ) => Promise<"keep-local" | "keep-server" | "merge">;
}

export function useOfflineSync(options: UseOfflineSyncOptions = {}) {
  const {
    autoSync = true,
    syncInterval = 30000, // 30 seconds
    onSyncStart,
    onSyncComplete,
    onSyncError,
    onConflict,
  } = options;

  const {
    isOnline,
    queue,
    syncStatus,
    setOnline,
    updateQueueItem,
    removeFromQueue,
    setSyncStatus,
    addConflict,
  } = useOfflineStore();

  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [setOnline]);

  // Listen for service worker messages
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      const handleMessage = (event: MessageEvent) => {
        const { type, ...data } = event.data;

        switch (type) {
          case "PAYMENT_SYNCED":
            removeFromQueue(data.offlineId);
            break;
          case "PAYMENT_QUEUED":
            // Payment was queued by service worker
            break;
          case "SYNC_COMPLETE":
            setSyncStatus("success");
            onSyncComplete?.(data.syncedCount, data.failedCount);
            break;
        }
      };

      navigator.serviceWorker.addEventListener("message", handleMessage);
      return () =>
        navigator.serviceWorker.removeEventListener("message", handleMessage);
    }
  }, [removeFromQueue, setSyncStatus, onSyncComplete]);

  // Sync function
  const sync = useCallback(async () => {
    const pendingItems = queue.filter(
      (item) => item.status === "pending" || item.status === "failed",
    );

    if (pendingItems.length === 0 || !isOnline) {
      return;
    }

    setSyncStatus("syncing");
    onSyncStart?.();

    let syncedCount = 0;
    let failedCount = 0;

    for (const item of pendingItems) {
      try {
        updateQueueItem(item.id, { status: "syncing" });

        const response = await syncItem(item);

        if (response.conflict) {
          // Handle conflict
          if (onConflict) {
            const resolution = await onConflict(item, response.serverData);
            addConflict({
              id: item.id,
              localData: item.data,
              serverData: response.serverData,
              resolution,
            });
            updateQueueItem(item.id, {
              status: "conflict",
              conflictData: response.serverData,
            });
          } else {
            // Default: keep server data
            updateQueueItem(item.id, {
              status: "conflict",
              conflictData: response.serverData,
            });
          }
          failedCount++;
        } else if (response.success) {
          updateQueueItem(item.id, { status: "synced" });
          syncedCount++;
        } else {
          throw new Error(response.error || "Sync failed");
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        updateQueueItem(item.id, {
          status: "failed",
          syncAttempts: item.syncAttempts + 1,
          lastError: errorMessage,
        });
        failedCount++;
      }
    }

    setSyncStatus(failedCount > 0 ? "error" : "success");
    onSyncComplete?.(syncedCount, failedCount);

    // Clear synced items after a delay
    setTimeout(() => {
      useOfflineStore.getState().clearSyncedItems();
    }, 5000);
  }, [
    queue,
    isOnline,
    setSyncStatus,
    updateQueueItem,
    addConflict,
    onSyncStart,
    onSyncComplete,
    onConflict,
  ]);

  // Auto sync when coming online
  useEffect(() => {
    if (isOnline && autoSync) {
      sync();
    }
  }, [isOnline, autoSync, sync]);

  // Periodic sync
  useEffect(() => {
    if (autoSync && syncInterval > 0) {
      syncIntervalRef.current = setInterval(() => {
        if (isOnline) {
          sync();
        }
      }, syncInterval);

      return () => {
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
        }
      };
    }
  }, [autoSync, syncInterval, isOnline, sync]);

  // Request background sync via service worker
  const requestBackgroundSync = useCallback(async () => {
    if (
      "serviceWorker" in navigator &&
      "sync" in window.ServiceWorkerRegistration.prototype
    ) {
      const registration = await navigator.serviceWorker.ready;
      await (registration as any).sync.register("sync-payments");
    } else {
      // Fallback: sync immediately
      sync();
    }
  }, [sync]);

  return {
    isOnline,
    queue,
    syncStatus,
    pendingCount: queue.filter(
      (i) => i.status === "pending" || i.status === "failed",
    ).length,
    sync,
    requestBackgroundSync,
  };
}

// ============================================================================
// Sync API Helper
// ============================================================================

async function syncItem(item: QueueItem): Promise<{
  success: boolean;
  conflict?: boolean;
  serverData?: any;
  error?: string;
}> {
  const endpoints: Record<QueueItem["type"], string> = {
    payment: "/api/payments",
    student: "/api/students",
    settings: "/api/settings",
  };

  const endpoint = endpoints[item.type];
  const method =
    item.action === "create"
      ? "POST"
      : item.action === "update"
        ? "PUT"
        : "DELETE";

  try {
    const response = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Offline-Sync": "true",
        "X-Offline-Timestamp": item.timestamp.toString(),
      },
      body: JSON.stringify(item.data),
    });

    if (response.status === 409) {
      // Conflict detected
      const serverData = await response.json();
      return { success: false, conflict: true, serverData };
    }

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

// ============================================================================
// useOnlineStatus Hook (Simple)
// ============================================================================

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}

export default useOfflineSync;
