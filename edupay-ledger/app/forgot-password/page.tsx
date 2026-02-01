'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { useFirebaseAuth } from '@/contexts/AuthContext';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, forgotPassword, error: authError, clearError } = useFirebaseAuth();
  
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  // Clear errors on mount
  useEffect(() => {
    clearError?.();
    setError('');
  }, [clearError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess(false);

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      setIsLoading(false);
      return;
    }

    try {
      await forgotPassword(email);
      setSuccess(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send reset email. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary via-primary/90 to-primary/80 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="material-symbols-outlined text-3xl text-white">school</span>
          </div>
          <p className="text-white/60 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  const displayError = error || authError;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary/90 to-primary/80 flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl text-white">school</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">eBursar</h1>
          <p className="text-white/60 text-sm">School Fee Management System</p>
        </div>

        {/* Forgot Password Card */}
        <Card className="backdrop-blur-xl bg-white/95 dark:bg-slate-900/95">
          {!success ? (
            <>
              {/* Back Link */}
              <Link
                href="/login"
                className="inline-flex items-center text-sm text-slate-500 hover:text-primary transition-colors mb-4"
              >
                <span className="material-symbols-outlined text-sm mr-1">arrow_back</span>
                Back to Sign In
              </Link>

              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-2xl text-primary">lock_reset</span>
                </div>
                <h2 className="text-xl font-bold">Forgot Password?</h2>
                <p className="text-slate-500 text-sm mt-2">
                  No worries! Enter your email address and we&apos;ll send you instructions to reset your password.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                    Email Address
                  </label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@school.ac.ug"
                    icon={<span className="material-symbols-outlined text-sm">email</span>}
                    required
                    autoFocus
                  />
                </div>

                {displayError && (
                  <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg">
                    <p className="text-sm text-danger flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">error</span>
                      {displayError}
                    </p>
                  </div>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  size="lg"
                  loading={isLoading}
                >
                  {isLoading ? 'Sending...' : 'Send Reset Link'}
                </Button>
              </form>

              <div className="text-center mt-6">
                <p className="text-sm text-slate-500">
                  Remember your password?{' '}
                  <Link href="/login" className="text-primary font-medium hover:underline">
                    Sign In
                  </Link>
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Success State */}
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-3xl text-emerald-600">check_circle</span>
                </div>
                <h2 className="text-xl font-bold mb-2">Check Your Email</h2>
                <p className="text-slate-500 text-sm mb-6">
                  We&apos;ve sent a password reset link to:
                  <br />
                  <span className="font-medium text-slate-700 dark:text-slate-300">{email}</span>
                </p>
                
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 text-left mb-6">
                  <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    What&apos;s next?
                  </h3>
                  <ol className="text-xs text-slate-500 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-5 h-5 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-xs">
                        1
                      </span>
                      <span>Open the email from eBursar</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-5 h-5 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-xs">
                        2
                      </span>
                      <span>Click the password reset link</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-5 h-5 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-xs">
                        3
                      </span>
                      <span>Create a new strong password</span>
                    </li>
                  </ol>
                </div>

                <p className="text-xs text-slate-400 mb-4">
                  Didn&apos;t receive the email? Check your spam folder or{' '}
                  <button
                    type="button"
                    onClick={() => setSuccess(false)}
                    className="text-primary hover:underline font-medium"
                  >
                    try again
                  </button>
                </p>

                <Link href="/login">
                  <Button variant="primary" fullWidth>
                    Back to Sign In
                  </Button>
                </Link>
              </div>
            </>
          )}
        </Card>

        {/* Footer */}
        <p className="text-center text-white/40 text-xs mt-8">
          © 2024 eBursar Uganda. All rights reserved.
          <br />
          <span className="inline-flex items-center gap-1 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-soft" />
            Secured by Stellar Blockchain
          </span>
        </p>
      </div>
    </div>
  );
}
