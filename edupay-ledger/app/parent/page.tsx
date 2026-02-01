"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

export default function ParentLoginPage() {
  const [phone, setPhone] = useState("");
  const [studentId, setStudentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // In production, this would verify the phone matches the student's guardian
      // For now, redirect to student profile
      window.location.href = `/parent/student/${studentId}`;
    } catch (err: any) {
      setError(err.message || "Failed to login. Please check your details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="material-symbols-outlined text-primary text-3xl">
              school
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white">eBursar</h1>
          <p className="text-white/70 mt-2">Parent Portal</p>
        </div>

        {/* Login Card */}
        <Card className="p-6">
          <h2 className="text-xl font-bold text-center mb-2">
            Welcome, Parent!
          </h2>
          <p className="text-center text-slate-500 text-sm mb-6">
            View your child's fee status and payment history
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                Phone Number
              </label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+256 7XX XXX XXX"
                icon={
                  <span className="material-symbols-outlined text-sm">
                    phone
                  </span>
                }
                required
              />
              <p className="text-xs text-slate-400 mt-1">
                Use the phone number registered with the school
              </p>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                Student ID
              </label>
              <Input
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="e.g., EDU-2024-ABC1-P7"
                icon={
                  <span className="material-symbols-outlined text-sm">
                    badge
                  </span>
                }
                required
              />
              <p className="text-xs text-slate-400 mt-1">
                Found on your child's school ID card
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              fullWidth
              size="lg"
              loading={loading}
              icon={<span className="material-symbols-outlined">login</span>}
            >
              View Fee Status
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">
              This portal is for viewing only.
              <br />
              To make payments, visit your Mobile Money app or bank.
            </p>
          </div>
        </Card>

        {/* Footer */}
        <p className="text-center text-white/50 text-xs mt-8">
          Need help? Contact your school's accounts office.
        </p>
      </div>
    </div>
  );
}
