"use client";

import { useState, useEffect, useCallback } from "react";
import { isOnline } from "@/lib/utils";

interface OfflineState {
  isOnline: boolean;
  wasOffline: boolean;
  lastOnlineAt: Date | null;
}

export function useOffline() {
  const [state, setState] = useState<OfflineState>({
    isOnline: true,
    wasOffline: false,
    lastOnlineAt: null,
  });

  useEffect(() => {
    // Set initial state
    setState((prev) => ({
      ...prev,
      isOnline: isOnline(),
      lastOnlineAt: isOnline() ? new Date() : null,
    }));

    const handleOnline = () => {
      setState((prev) => ({
        isOnline: true,
        wasOffline: !prev.isOnline,
        lastOnlineAt: new Date(),
      }));
    };

    const handleOffline = () => {
      setState((prev) => ({
        ...prev,
        isOnline: false,
      }));
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Clear the wasOffline flag after some time
  useEffect(() => {
    if (state.wasOffline) {
      const timer = setTimeout(() => {
        setState((prev) => ({ ...prev, wasOffline: false }));
      }, 5000); // Clear after 5 seconds

      return () => clearTimeout(timer);
    }
  }, [state.wasOffline]);

  return state;
}

/**
 * Hook to queue operations when offline
 */
interface QueuedOperation {
  id: string;
  type: string;
  data: any;
  timestamp: Date;
}

export function useOfflineQueue() {
  const [queue, setQueue] = useState<QueuedOperation[]>([]);
  const { isOnline } = useOffline();

  // Load queue from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("ebursar_offline_queue");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setQueue(
          parsed.map((op: any) => ({
            ...op,
            timestamp: new Date(op.timestamp),
          })),
        );
      } catch (e) {
        console.error("Failed to parse offline queue:", e);
      }
    }
  }, []);

  // Save queue to localStorage on change
  useEffect(() => {
    localStorage.setItem("ebursar_offline_queue", JSON.stringify(queue));
  }, [queue]);

  const addToQueue = useCallback((type: string, data: any) => {
    const operation: QueuedOperation = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type,
      data,
      timestamp: new Date(),
    };
    setQueue((prev) => [...prev, operation]);
    return operation.id;
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    setQueue((prev) => prev.filter((op) => op.id !== id));
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  const getQueueByType = useCallback(
    (type: string) => {
      return queue.filter((op) => op.type === type);
    },
    [queue],
  );

  return {
    queue,
    queueLength: queue.length,
    isOnline,
    addToQueue,
    removeFromQueue,
    clearQueue,
    getQueueByType,
  };
}
