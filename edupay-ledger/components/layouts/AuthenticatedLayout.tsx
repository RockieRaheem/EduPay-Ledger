"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar, MobileNav } from "@/components/navigation/Sidebar";
import { TopNav } from "@/components/navigation/TopNav";
import { useFirebaseAuth } from "@/contexts/AuthContext";

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

/**
 * Shared authenticated layout component
 * Displays user info from auth context in sidebar and topnav
 * Optionally requires authentication to view
 */
export function AuthenticatedLayout({
  children,
  requireAuth = true,
}: AuthenticatedLayoutProps) {
  const router = useRouter();
  const { user, isLoading, isAuthenticated, isDemoMode } = useFirebaseAuth();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && requireAuth && !isAuthenticated && !isDemoMode) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, isDemoMode, requireAuth, router]);

  // Format role for display
  const formatRole = (role: string | undefined) => {
    if (!role) return "Staff";
    const roleMap: Record<string, string> = {
      admin: "Administrator",
      bursar: "Bursar",
      registrar: "Registrar",
      teacher: "Teacher",
      viewer: "Viewer",
    };
    return roleMap[role] || role.charAt(0).toUpperCase() + role.slice(1);
  };

  // Get current academic term/year (could be from settings context later)
  const getCurrentTerm = () => {
    const now = new Date();
    const month = now.getMonth();
    // Uganda school terms: Term 1 (Feb-May), Term 2 (Jun-Aug), Term 3 (Sep-Dec)
    if (month >= 1 && month <= 4) return "TERM 1";
    if (month >= 5 && month <= 7) return "TERM 2";
    return "TERM 3";
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show nothing while redirecting
  if (requireAuth && !isAuthenticated && !isDemoMode) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar
          userName={user?.displayName || user?.email?.split("@")[0] || "User"}
          userRole={formatRole(user?.role)}
          userAvatar={user?.photoURL || undefined}
          schoolName={user?.schoolName}
        />
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <TopNav
          currentTerm={getCurrentTerm()}
          currentYear={new Date().getFullYear()}
          userName={user?.displayName || user?.email?.split("@")[0] || "User"}
          userAvatar={user?.photoURL || undefined}
          schoolName={user?.schoolName}
        />
        <div className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth pb-20 lg:pb-0">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <MobileNav />
    </div>
  );
}

export default AuthenticatedLayout;
