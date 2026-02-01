"use client";

/**
 * Accessibility Utilities
 * WCAG 2.1 compliant helpers for eBursar
 */

import { useEffect, useRef, useCallback, useState } from "react";

// ============================================================================
// Focus Management
// ============================================================================

/**
 * Hook to trap focus within a container (for modals, dialogs)
 */
export function useFocusTrap(isActive: boolean = true) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive) return;

    const container = containerRef.current;
    if (!container) return;

    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus first element on open
    firstElement?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [isActive]);

  return containerRef;
}

/**
 * Hook to restore focus when component unmounts
 */
export function useRestoreFocus() {
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement;

    return () => {
      previousFocus.current?.focus();
    };
  }, []);
}

/**
 * Hook for roving tabindex (for toolbars, menus)
 */
export function useRovingTabIndex<T extends HTMLElement>(
  itemCount: number,
  orientation: "horizontal" | "vertical" = "horizontal",
) {
  const containerRef = useRef<T>(null);
  const currentIndex = useRef(0);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const items =
        container.querySelectorAll<HTMLElement>("[data-roving-item]");
      if (items.length === 0) return;

      const prevKey = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";
      const nextKey = orientation === "horizontal" ? "ArrowRight" : "ArrowDown";

      if (e.key === prevKey) {
        e.preventDefault();
        currentIndex.current =
          (currentIndex.current - 1 + items.length) % items.length;
        items[currentIndex.current].focus();
      } else if (e.key === nextKey) {
        e.preventDefault();
        currentIndex.current = (currentIndex.current + 1) % items.length;
        items[currentIndex.current].focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        currentIndex.current = 0;
        items[0].focus();
      } else if (e.key === "End") {
        e.preventDefault();
        currentIndex.current = items.length - 1;
        items[items.length - 1].focus();
      }
    },
    [orientation],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return { containerRef, currentIndex };
}

// ============================================================================
// Screen Reader Announcements
// ============================================================================

/**
 * Announce a message to screen readers
 */
export function announce(
  message: string,
  priority: "polite" | "assertive" = "polite",
) {
  if (typeof document === "undefined") return;

  // Create or find the live region
  let liveRegion = document.getElementById("a11y-announcer");

  if (!liveRegion) {
    liveRegion = document.createElement("div");
    liveRegion.id = "a11y-announcer";
    liveRegion.setAttribute("aria-live", priority);
    liveRegion.setAttribute("aria-atomic", "true");
    liveRegion.className = "sr-only";
    liveRegion.style.cssText = `
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    `;
    document.body.appendChild(liveRegion);
  }

  // Update priority if needed
  liveRegion.setAttribute("aria-live", priority);

  // Clear and set new message (needs a small delay to trigger announcement)
  liveRegion.textContent = "";
  setTimeout(() => {
    liveRegion!.textContent = message;
  }, 100);
}

/**
 * Hook for announcing loading states
 */
export function useLoadingAnnouncement(
  isLoading: boolean,
  loadingMessage = "Loading...",
  completedMessage = "Content loaded",
) {
  const previousLoading = useRef(isLoading);

  useEffect(() => {
    if (isLoading && !previousLoading.current) {
      announce(loadingMessage);
    } else if (!isLoading && previousLoading.current) {
      announce(completedMessage);
    }
    previousLoading.current = isLoading;
  }, [isLoading, loadingMessage, completedMessage]);
}

// ============================================================================
// Keyboard Navigation
// ============================================================================

/**
 * Common keyboard shortcuts handler
 */
export function useKeyboardShortcuts(shortcuts: Record<string, () => void>) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Build key string
      const parts: string[] = [];
      if (e.ctrlKey || e.metaKey) parts.push("ctrl");
      if (e.altKey) parts.push("alt");
      if (e.shiftKey) parts.push("shift");
      parts.push(e.key.toLowerCase());

      const keyString = parts.join("+");

      if (shortcuts[keyString]) {
        e.preventDefault();
        shortcuts[keyString]();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts]);
}

// ============================================================================
// Skip Links
// ============================================================================

/**
 * Skip link component for keyboard navigation
 */
export function SkipLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-white"
    >
      {children}
    </a>
  );
}

// ============================================================================
// ARIA Helpers
// ============================================================================

/**
 * Generate unique IDs for ARIA relationships
 */
let idCounter = 0;
export function generateId(prefix = "a11y"): string {
  return `${prefix}-${++idCounter}`;
}

/**
 * Hook for managing ARIA expanded state
 */
export function useAriaExpanded(initialState = false) {
  const [isExpanded, setIsExpanded] = useState(initialState);
  const contentId = useRef(generateId("content"));
  const triggerId = useRef(generateId("trigger"));

  const triggerProps = {
    id: triggerId.current,
    "aria-expanded": isExpanded,
    "aria-controls": contentId.current,
    onClick: () => setIsExpanded(!isExpanded),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setIsExpanded(!isExpanded);
      }
    },
  };

  const contentProps = {
    id: contentId.current,
    "aria-labelledby": triggerId.current,
    hidden: !isExpanded,
  };

  return { isExpanded, setIsExpanded, triggerProps, contentProps };
}

// ============================================================================
// Color Contrast
// ============================================================================

/**
 * Check if color contrast ratio meets WCAG standards
 */
export function getContrastRatio(
  foreground: string,
  background: string,
): number {
  const getLuminance = (color: string): number => {
    // Convert hex to RGB
    const hex = color.replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;

    const [R, G, B] = [r, g, b].map((c) =>
      c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
    );

    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  };

  const l1 = getLuminance(foreground);
  const l2 = getLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast meets WCAG AA standard
 */
export function meetsContrastAA(
  foreground: string,
  background: string,
  isLargeText = false,
): boolean {
  const ratio = getContrastRatio(foreground, background);
  return isLargeText ? ratio >= 3 : ratio >= 4.5;
}

/**
 * Check if contrast meets WCAG AAA standard
 */
export function meetsContrastAAA(
  foreground: string,
  background: string,
  isLargeText = false,
): boolean {
  const ratio = getContrastRatio(foreground, background);
  return isLargeText ? ratio >= 4.5 : ratio >= 7;
}

// ============================================================================
// Reduced Motion
// ============================================================================

/**
 * Hook to check if user prefers reduced motion
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  return prefersReducedMotion;
}

// ============================================================================
// Export default for convenience
// ============================================================================

export default {
  useFocusTrap,
  useRestoreFocus,
  useRovingTabIndex,
  announce,
  useLoadingAnnouncement,
  useKeyboardShortcuts,
  SkipLink,
  generateId,
  useAriaExpanded,
  getContrastRatio,
  meetsContrastAA,
  meetsContrastAAA,
  usePrefersReducedMotion,
};
