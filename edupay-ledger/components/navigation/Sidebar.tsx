"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Avatar } from "../ui/Avatar";
import { useFirebaseAuth } from "@/contexts/AuthContext";

interface SidebarProps {
  schoolName?: string;
  userName?: string;
  userRole?: string;
  userAvatar?: string;
}

interface NavItem {
  href: string;
  icon: string;
  label: string;
}

const navItems: NavItem[] = [
  { href: "/dashboard", icon: "dashboard", label: "Dashboard" },
  { href: "/classes", icon: "school", label: "Classes" },
  { href: "/students", icon: "group", label: "Students" },
  { href: "/payments", icon: "payments", label: "Payments" },
  { href: "/reports", icon: "description", label: "Reports" },
  { href: "/settings", icon: "settings", label: "Settings" },
];

export function Sidebar({
  schoolName,
  userName,
  userRole,
  userAvatar,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useFirebaseAuth();

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <aside className="w-64 bg-primary text-white flex flex-col shrink-0 h-screen sticky top-0">
      {/* Logo - Fixed at top */}
      <div className="p-6 pb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="size-8 bg-emerald-soft rounded-lg flex items-center justify-center">
            <span className="material-symbols-outlined text-white">
              account_balance_wallet
            </span>
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">eBursar</h2>
            {schoolName && (
              <p className="text-[10px] text-white/60 truncate max-w-[160px]">
                {schoolName}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Navigation - Scrollable */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth scrollbar-thin px-6 py-2">
        <nav className="space-y-2">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                  isActive
                    ? "bg-white/10 text-white"
                    : "hover:bg-white/5 text-white/70",
                )}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Info - Fixed at bottom */}
      <div className="p-6 border-t border-white/10 flex-shrink-0 mt-auto">
        <div className="flex items-center gap-3 mb-4">
          <Avatar
            src={userAvatar}
            name={userName}
            size="md"
            className="ring-2 ring-white/20"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">
              {userName || "User"}
            </p>
            <p className="text-[10px] text-white/50 uppercase tracking-wider">
              {userRole || "Staff"}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Link
            href="/help"
            className="flex items-center gap-2 text-white/50 hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-sm">help</span>
            <span className="text-xs font-medium">Help</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-white/50 hover:text-red-300 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            <span className="text-xs font-medium">Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

// Mobile Bottom Navigation
export function MobileNav() {
  const pathname = usePathname();

  const mobileNavItems = navItems.slice(0, 5); // Limit items for mobile

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-gray-800 lg:hidden z-50">
      <div className="flex justify-around items-center h-16">
        {mobileNavItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[64px]",
                isActive
                  ? "text-primary dark:text-white"
                  : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300",
              )}
            >
              <span className="material-symbols-outlined text-xl">
                {item.icon}
              </span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
