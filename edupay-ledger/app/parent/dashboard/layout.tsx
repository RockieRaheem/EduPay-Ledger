/**
 * Parent Dashboard Layout
 */

import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Parent Dashboard | eBursar",
  description: "View your children's fee status and make payments",
};

export default function ParentDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Parent Portal Header */}
      <header className="bg-blue-600 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <span className="text-xl">📚</span>
              </div>
              <div>
                <h1 className="font-bold text-lg">eBursar Parent Portal</h1>
                <p className="text-blue-100 text-sm">
                  Fee Management Made Easy
                </p>
              </div>
            </div>
            <nav className="flex items-center gap-6">
              <a
                href="/parent/dashboard"
                className="text-sm hover:text-blue-100 font-medium"
              >
                Dashboard
              </a>
              <a href="/parent" className="text-sm hover:text-blue-100">
                Logout
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>

      {/* Footer */}
      <footer className="bg-white border-t mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-4 text-center text-sm text-gray-500">
          <p>© 2024 eBursar. All rights reserved.</p>
          <p className="mt-1">
            Need help? Contact your school's bursar office.
          </p>
        </div>
      </footer>
    </div>
  );
}
