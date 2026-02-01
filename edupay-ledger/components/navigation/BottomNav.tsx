"use client";

/**
 * Mobile Bottom Navigation Component
 * Touch-friendly navigation for mobile devices
 */

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  activeIcon?: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Home",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
    activeIcon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
      </svg>
    ),
  },
  {
    href: "/students",
    label: "Students",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>
    ),
    activeIcon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-6 8v-2c0-2.66 5.33-4 6-4s6 1.34 6 4v2H6zm10-8c.27 0 .53.02.79.06C18.75 11.27 20 9.77 20 8c0-2.21-1.79-4-4-4-.58 0-1.13.12-1.64.34C15.41 5.24 16 6.53 16 8c0 1.47-.59 2.76-1.64 3.66.51.34 1.06.62 1.64.82V12z" />
      </svg>
    ),
  },
  {
    href: "/payments/record",
    label: "Pay",
    icon: (
      <svg
        className="w-7 h-7"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
        />
      </svg>
    ),
    activeIcon: (
      <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
      </svg>
    ),
  },
  {
    href: "/overdue",
    label: "Overdue",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    activeIcon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z" />
      </svg>
    ),
  },
  {
    href: "/reports",
    label: "Reports",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
    activeIcon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 14h-3v3h-2v-3H8v-2h3v-3h2v3h3v2zm-3-7V3.5L18.5 9H13z" />
      </svg>
    ),
  },
];

interface BottomNavProps {
  pendingCount?: number;
}

export function BottomNav({ pendingCount = 0 }: BottomNavProps) {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Hide on scroll down, show on scroll up
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  // Check if we're on the payment page - highlight the pay button
  const isPaymentPage = pathname?.startsWith("/payments");

  return (
    <>
      {/* Spacer to prevent content from being hidden behind nav */}
      <div className="h-20 md:hidden" />

      {/* Bottom Navigation */}
      <nav
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 md:hidden transition-transform duration-300",
          "bg-white border-t border-gray-200 shadow-lg",
          "safe-area-bottom",
          !isVisible && "translate-y-full",
        )}
      >
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map((item, index) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard" || pathname === "/"
                : pathname?.startsWith(item.href);

            const isPay = item.label === "Pay";

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center min-w-[64px] h-full px-2",
                  "transition-all duration-200 relative",
                  isPay ? "scale-110 -mt-4" : "",
                  isActive ? "text-primary-600" : "text-gray-500",
                )}
              >
                {/* Special styling for Pay button */}
                {isPay ? (
                  <div
                    className={cn(
                      "flex items-center justify-center w-14 h-14 rounded-full",
                      "shadow-lg transition-all duration-200",
                      isActive || isPaymentPage
                        ? "bg-primary-600 text-white"
                        : "bg-primary-500 text-white hover:bg-primary-600",
                    )}
                  >
                    {isActive ? item.activeIcon : item.icon}
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      {isActive ? item.activeIcon : item.icon}

                      {/* Badge for pending items */}
                      {item.label === "Home" && pendingCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 text-[10px] font-bold text-white bg-error-500 rounded-full flex items-center justify-center">
                          {pendingCount > 9 ? "9+" : pendingCount}
                        </span>
                      )}
                    </div>

                    <span
                      className={cn(
                        "text-[10px] mt-1 font-medium",
                        isActive ? "text-primary-600" : "text-gray-500",
                      )}
                    >
                      {item.label}
                    </span>
                  </>
                )}

                {/* Active indicator dot */}
                {isActive && !isPay && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full bg-primary-600" />
                )}
              </Link>
            );
          })}
        </div>

        {/* Safe area for devices with home indicator */}
        <div className="h-safe-area-inset-bottom bg-white" />
      </nav>
    </>
  );
}

// Floating Action Button for quick payment (alternative design)
interface FABProps {
  onClick?: () => void;
  pendingCount?: number;
}

export function PaymentFAB({ onClick, pendingCount = 0 }: FABProps) {
  const pathname = usePathname();

  // Hide on payment page
  if (pathname?.startsWith("/payments")) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "fixed bottom-24 right-4 z-40 md:bottom-8 md:right-8",
        "w-14 h-14 rounded-full bg-primary-600 text-white shadow-xl",
        "flex items-center justify-center",
        "hover:bg-primary-700 active:scale-95 transition-all duration-200",
        "focus:outline-none focus:ring-4 focus:ring-primary-200",
      )}
      aria-label="Record Payment"
    >
      <svg
        className="w-7 h-7"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
        />
      </svg>

      {pendingCount > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 text-xs font-bold text-white bg-error-500 rounded-full flex items-center justify-center border-2 border-white">
          {pendingCount > 9 ? "9+" : pendingCount}
        </span>
      )}
    </button>
  );
}

// Sync Status Indicator for bottom nav
interface SyncIndicatorProps {
  status: "online" | "offline" | "syncing";
  pendingCount: number;
  onSync?: () => void;
}

export function SyncStatusIndicator({
  status,
  pendingCount,
  onSync,
}: SyncIndicatorProps) {
  if (status === "online" && pendingCount === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed bottom-20 left-4 right-4 z-40 md:hidden",
        "bg-white rounded-lg shadow-lg border p-3",
        "flex items-center justify-between",
        "animate-slide-up",
      )}
    >
      <div className="flex items-center gap-3">
        {/* Status Icon */}
        <div
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center",
            status === "offline" && "bg-warning-100",
            status === "syncing" && "bg-primary-100",
            status === "online" && "bg-success-100",
          )}
        >
          {status === "offline" && (
            <svg
              className="w-4 h-4 text-warning-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829"
              />
            </svg>
          )}
          {status === "syncing" && (
            <svg
              className="w-4 h-4 text-primary-600 animate-spin"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          )}
          {status === "online" && pendingCount > 0 && (
            <svg
              className="w-4 h-4 text-success-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </div>

        {/* Status Text */}
        <div>
          <p className="text-sm font-medium text-gray-900">
            {status === "offline" &&
              `${pendingCount} payment${pendingCount !== 1 ? "s" : ""} pending`}
            {status === "syncing" && "Syncing payments..."}
            {status === "online" && pendingCount > 0 && "Ready to sync"}
          </p>
          <p className="text-xs text-gray-500">
            {status === "offline" && "Will sync when online"}
            {status === "syncing" && "Please wait"}
            {status === "online" && pendingCount > 0 && "Tap to sync now"}
          </p>
        </div>
      </div>

      {/* Sync Button */}
      {status === "online" && pendingCount > 0 && onSync && (
        <button
          onClick={onSync}
          className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
        >
          Sync
        </button>
      )}
    </div>
  );
}

export default BottomNav;
