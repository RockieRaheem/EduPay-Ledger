"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Avatar } from "../ui/Avatar";
import { useOffline } from "@/hooks/useOffline";
import { useFirebaseAuth } from "@/contexts/AuthContext";

interface TopNavProps {
  currentTerm?: string;
  currentYear?: number;
  schoolName?: string;
  userName?: string;
  userAvatar?: string;
  showSearch?: boolean;
  onSearch?: (query: string) => void;
}

export function TopNav({
  currentTerm = "TERM 1",
  currentYear = 2024,
  schoolName,
  userName,
  userAvatar,
  showSearch = true,
  onSearch,
}: TopNavProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { isOnline, wasOffline } = useOffline();
  const { user, logout } = useFirebaseAuth();
  const pathname = usePathname();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(searchQuery);
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Use props or fall back to auth context
  const displayName =
    userName || user?.displayName || user?.email?.split("@")[0] || "User";
  const displayAvatar = userAvatar || user?.photoURL || undefined;

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-border-light dark:border-slate-800 flex items-center justify-between px-4 lg:px-8 shrink-0 sticky top-0 z-40">
      {/* Left: Search */}
      <div className="flex items-center gap-4 flex-1 max-w-md">
        {showSearch && (
          <form onSubmit={handleSearch} className="relative w-full">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary"
              placeholder="Search student or receipt..."
            />
          </form>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-4 lg:gap-6">
        {/* Offline Indicator */}
        {!isOnline && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full">
            <span className="material-symbols-outlined text-sm offline-indicator">
              cloud_off
            </span>
            <span className="text-xs font-bold hidden sm:inline">
              Offline Mode
            </span>
          </div>
        )}

        {/* Back Online Indicator */}
        {isOnline && wasOffline && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
            <span className="material-symbols-outlined text-sm">
              cloud_done
            </span>
            <span className="text-xs font-bold hidden sm:inline">
              Back Online
            </span>
          </div>
        )}

        {/* Term Badge */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full">
          <span className="material-symbols-outlined text-emerald-soft text-sm">
            calendar_today
          </span>
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
            {currentTerm}, {currentYear}
          </span>
        </div>

        {/* Notifications */}
        <button className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors relative">
          <span className="material-symbols-outlined">notifications</span>
          <span className="absolute top-2 right-2 size-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900" />
        </button>

        {/* User Avatar (Mobile) with Dropdown */}
        <div className="lg:hidden relative" ref={menuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2"
          >
            <Avatar src={displayAvatar} name={displayName} size="sm" />
          </button>

          {/* User Dropdown Menu */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-2 z-50">
              <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {displayName}
                </p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </div>
              <Link
                href="/settings"
                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                onClick={() => setShowUserMenu(false)}
              >
                <span className="material-symbols-outlined text-lg">
                  settings
                </span>
                Settings
              </Link>
              <Link
                href="/help"
                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                onClick={() => setShowUserMenu(false)}
              >
                <span className="material-symbols-outlined text-lg">help</span>
                Help Center
              </Link>
              <hr className="my-2 border-slate-200 dark:border-slate-700" />
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 w-full text-left"
              >
                <span className="material-symbols-outlined text-lg">
                  logout
                </span>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// Alternate Top Nav (Minimal version used in some designs)
interface MinimalTopNavProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  actions?: React.ReactNode;
}

export function MinimalTopNav({
  title,
  subtitle,
  showBack = false,
  onBack,
  actions,
}: MinimalTopNavProps) {
  const pathname = usePathname();

  // Determine navigation items based on current section
  const getNavItems = () => {
    if (pathname.startsWith("/settings")) {
      return [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/settings/fees", label: "Fee Management" },
        { href: "/settings", label: "Settings" },
      ];
    }
    return [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/reports", label: "Reports" },
      { href: "/settings", label: "Settings" },
    ];
  };

  const navItems = getNavItems();

  return (
    <header className="flex items-center justify-between whitespace-nowrap border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-background-dark px-6 lg:px-10 py-3 sticky top-0 z-50">
      <div className="flex items-center gap-4 lg:gap-8">
        {/* Logo */}
        <Link
          href="/dashboard"
          className="flex items-center gap-3 text-primary dark:text-white"
        >
          <div className="size-6">
            <svg
              fill="none"
              viewBox="0 0 48 48"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4 4H17.3334V17.3334H30.6666V30.6666H44V44H4V4Z"
                fill="currentColor"
              />
            </svg>
          </div>
          <h2 className="text-lg font-bold leading-tight tracking-tight">
            eBursar
          </h2>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6 lg:gap-9">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "text-sm font-medium leading-normal transition-colors",
                  isActive
                    ? "text-primary dark:text-white border-b-2 border-primary pb-1"
                    : "text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-white",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4">
        {actions}
        <Avatar size="md" />
      </div>
    </header>
  );
}
