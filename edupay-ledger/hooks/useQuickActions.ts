/**
 * Quick Actions Hooks
 * React hooks for quick action dashboard functionality
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  getDailySummary,
  getPendingTasks,
  getDashboardAlerts,
  getDashboardConfig,
  updateDashboardConfig,
  pinAction,
  unpinAction,
  quickSearch,
  markAlertRead,
  dismissAlert,
  subscribeToDailySummary,
  subscribeToPendingTasks,
  getMockDailySummary,
  getMockPendingTasks,
  getMockAlerts,
} from "../lib/services/quick-actions.service";
import {
  DailySummary,
  PendingTask,
  DashboardAlert,
  DashboardConfig,
  QuickAction,
  QuickSearchResult,
  DEFAULT_QUICK_ACTIONS,
} from "../types/quick-actions";

const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

// ============================================
// DAILY SUMMARY HOOK
// ============================================

export function useDailySummary(schoolId: string) {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId) return;

    setIsLoading(true);
    setError(null);

    if (USE_MOCK_DATA) {
      setSummary(getMockDailySummary());
      setIsLoading(false);
      return;
    }

    const unsubscribe = subscribeToDailySummary(schoolId, (data) => {
      setSummary(data);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [schoolId]);

  const refresh = useCallback(async () => {
    if (USE_MOCK_DATA) {
      setSummary(getMockDailySummary());
      return;
    }

    try {
      const data = await getDailySummary(schoolId);
      setSummary(data);
    } catch (err) {
      setError("Failed to refresh summary");
    }
  }, [schoolId]);

  return { summary, isLoading, error, refresh };
}

// ============================================
// PENDING TASKS HOOK
// ============================================

export function usePendingTasks(schoolId: string) {
  const [tasks, setTasks] = useState<PendingTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId) return;

    setIsLoading(true);
    setError(null);

    if (USE_MOCK_DATA) {
      setTasks(getMockPendingTasks());
      setIsLoading(false);
      return;
    }

    const unsubscribe = subscribeToPendingTasks(schoolId, (data) => {
      setTasks(data);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [schoolId]);

  // Group tasks by type
  const tasksByType = useMemo(() => {
    const grouped: { [key: string]: PendingTask[] } = {};
    tasks.forEach((task) => {
      if (!grouped[task.type]) grouped[task.type] = [];
      grouped[task.type].push(task);
    });
    return grouped;
  }, [tasks]);

  // Count urgent tasks
  const urgentCount = useMemo(() => {
    return tasks.filter((t) => t.priority === "urgent" || t.priority === "high")
      .length;
  }, [tasks]);

  return { tasks, tasksByType, urgentCount, isLoading, error };
}

// ============================================
// DASHBOARD ALERTS HOOK
// ============================================

export function useDashboardAlerts(schoolId: string) {
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId) return;

    setIsLoading(true);

    if (USE_MOCK_DATA) {
      setAlerts(getMockAlerts());
      setIsLoading(false);
      return;
    }

    getDashboardAlerts(schoolId)
      .then(setAlerts)
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [schoolId]);

  const markRead = useCallback(
    async (alertId: string) => {
      if (USE_MOCK_DATA) {
        setAlerts((prev) =>
          prev.map((a) => (a.id === alertId ? { ...a, isRead: true } : a)),
        );
        return;
      }

      await markAlertRead(schoolId, alertId);
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, isRead: true } : a)),
      );
    },
    [schoolId],
  );

  const dismiss = useCallback(
    async (alertId: string) => {
      if (USE_MOCK_DATA) {
        setAlerts((prev) => prev.filter((a) => a.id !== alertId));
        return;
      }

      await dismissAlert(schoolId, alertId);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    },
    [schoolId],
  );

  const unreadCount = useMemo(
    () => alerts.filter((a) => !a.isRead).length,
    [alerts],
  );

  return { alerts, unreadCount, isLoading, error, markRead, dismiss };
}

// ============================================
// QUICK ACTIONS HOOK
// ============================================

export function useQuickActions(userId: string) {
  const [config, setConfig] = useState<DashboardConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    if (USE_MOCK_DATA) {
      setConfig({
        userId,
        layout: "default",
        showDailySummary: true,
        showPendingTasks: true,
        showRecentPayments: true,
        showAlerts: true,
        pinnedActions: [
          "record-payment",
          "view-overdue",
          "send-reminder",
          "clear-student",
        ],
        quickAccessItems: [],
        refreshInterval: 60,
      });
      setIsLoading(false);
      return;
    }

    getDashboardConfig(userId)
      .then(setConfig)
      .finally(() => setIsLoading(false));
  }, [userId]);

  // Get all available actions
  const allActions = useMemo(() => DEFAULT_QUICK_ACTIONS, []);

  // Get pinned actions
  const pinnedActions = useMemo(() => {
    if (!config) return allActions.slice(0, 4);
    return config.pinnedActions
      .map((id) => allActions.find((a) => a.id === id))
      .filter(Boolean) as QuickAction[];
  }, [config, allActions]);

  // Get unpinned actions
  const unpinnedActions = useMemo(() => {
    if (!config) return allActions.slice(4);
    return allActions.filter((a) => !config.pinnedActions.includes(a.id));
  }, [config, allActions]);

  // Pin an action
  const pin = useCallback(
    async (actionId: string) => {
      if (!config) return;

      const newPinned = [...config.pinnedActions, actionId];
      setConfig({ ...config, pinnedActions: newPinned });

      if (!USE_MOCK_DATA) {
        await pinAction(userId, actionId);
      }
    },
    [config, userId],
  );

  // Unpin an action
  const unpin = useCallback(
    async (actionId: string) => {
      if (!config) return;

      const newPinned = config.pinnedActions.filter((id) => id !== actionId);
      setConfig({ ...config, pinnedActions: newPinned });

      if (!USE_MOCK_DATA) {
        await unpinAction(userId, actionId);
      }
    },
    [config, userId],
  );

  // Update config
  const updateConfig = useCallback(
    async (updates: Partial<DashboardConfig>) => {
      if (!config) return;

      const newConfig = { ...config, ...updates };
      setConfig(newConfig);

      if (!USE_MOCK_DATA) {
        await updateDashboardConfig(userId, updates);
      }
    },
    [config, userId],
  );

  return {
    config,
    allActions,
    pinnedActions,
    unpinnedActions,
    isLoading,
    pin,
    unpin,
    updateConfig,
  };
}

// ============================================
// QUICK SEARCH HOOK
// ============================================

export function useQuickSearch(schoolId: string) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<QuickSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setIsSearching(true);

      if (USE_MOCK_DATA) {
        // Mock search results
        setResults([
          {
            id: "1",
            type: "student",
            title: "John Mukasa",
            subtitle: "P7 Blue - EDU-2024-001",
            href: "/students/1",
          },
          {
            id: "2",
            type: "payment",
            title: "Payment: UGX 500,000",
            subtitle: "RCP-001 - John Mukasa",
            href: "/payments/1",
          },
        ]);
        setIsSearching(false);
        return;
      }

      try {
        const data = await quickSearch(schoolId, query);
        setResults(data);
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query, schoolId]);

  const clear = useCallback(() => {
    setQuery("");
    setResults([]);
  }, []);

  return { query, setQuery, results, isSearching, clear };
}

// ============================================
// KEYBOARD SHORTCUTS HOOK
// ============================================

export function useKeyboardShortcuts(
  actions: QuickAction[],
  onAction: (action: QuickAction) => void,
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle Alt+Key combinations
      if (!e.altKey) return;

      const key = e.key.toLowerCase();
      const action = actions.find((a) => {
        if (!a.shortcut) return false;
        const shortcutKey = a.shortcut.split("+").pop()?.toLowerCase();
        return shortcutKey === key;
      });

      if (action) {
        e.preventDefault();
        onAction(action);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [actions, onAction]);
}

// ============================================
// COMBINED DASHBOARD HOOK
// ============================================

export function useBursarDashboard(schoolId: string, userId: string) {
  const {
    summary,
    isLoading: summaryLoading,
    refresh: refreshSummary,
  } = useDailySummary(schoolId);
  const {
    tasks,
    urgentCount,
    isLoading: tasksLoading,
  } = usePendingTasks(schoolId);
  const {
    alerts,
    unreadCount,
    isLoading: alertsLoading,
    markRead,
    dismiss,
  } = useDashboardAlerts(schoolId);
  const {
    pinnedActions,
    unpinnedActions,
    config,
    isLoading: configLoading,
  } = useQuickActions(userId);

  const isLoading =
    summaryLoading || tasksLoading || alertsLoading || configLoading;

  const refresh = useCallback(() => {
    refreshSummary();
  }, [refreshSummary]);

  return {
    // Data
    summary,
    tasks,
    alerts,
    pinnedActions,
    unpinnedActions,
    config,
    // Counts
    urgentTaskCount: urgentCount,
    unreadAlertCount: unreadCount,
    // State
    isLoading,
    // Actions
    refresh,
    markAlertRead: markRead,
    dismissAlert: dismiss,
  };
}
