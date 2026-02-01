"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { useFirebaseAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";

export default function LoginPage() {
  const router = useRouter();
  const { success, error: showError } = useToast();
  const {
    user,
    isLoading: authLoading,
    login,
    loginAsDemo,
    signInWithGoogle,
    error: authError,
    clearError,
  } = useFirebaseAuth();

  const [loginMethod, setLoginMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      router.push("/dashboard");
    }
  }, [user, authLoading, router]);

  // Clear errors on mount
  useEffect(() => {
    clearError?.();
    setError("");
  }, [clearError]);

  // Load remembered email
  useEffect(() => {
    const rememberedEmail = localStorage.getItem("ebursar_remembered_email");
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const loginEmail =
        loginMethod === "email"
          ? email
          : `${phone.replace(/\D/g, "")}@phone.ebursar.ug`;

      // Remember email if checked
      if (rememberMe) {
        localStorage.setItem("ebursar_remembered_email", email);
      } else {
        localStorage.removeItem("ebursar_remembered_email");
      }

      await login(loginEmail, password);
      success("Welcome back!", "Successfully logged in");
      router.push("/dashboard");
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Invalid credentials. Please try again.";
      setError(errorMessage);
      showError("Login failed", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError("");

    try {
      console.log("Initiating Google sign-in...");

      if (!signInWithGoogle) {
        // Fall back to demo mode if Google sign-in not available
        console.log("Google sign-in not available, using demo mode...");
        await loginAsDemo();
        success("Demo Mode", "Exploring with sample data");
        router.replace("/dashboard");
        return;
      }

      await signInWithGoogle();
      console.log("Google sign-in completed, redirecting to dashboard...");
      success("Welcome!", "Signed in with Google");
      // Use replace instead of push to prevent back navigation to login
      router.replace("/dashboard");
    } catch (err: any) {
      console.error("Google login error:", err);

      // If popup was blocked or failed, offer demo mode
      if (
        err?.message?.includes("popup") ||
        err?.message?.includes("blocked")
      ) {
        setError("Popup blocked. Click 'Try Demo' below to continue.");
        showError("Popup Blocked", "Please allow popups or try demo mode");
      } else {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Google sign-in failed. Please try again.";
        setError(errorMessage);
        showError("Sign-in Failed", errorMessage);
      }
      setIsLoading(false);
    }
  };

  // Quick access to demo mode
  const handleQuickDemo = async () => {
    setIsLoading(true);
    setError("");
    try {
      await loginAsDemo();
      success("Demo Mode", "Exploring with sample school data");
      router.replace("/dashboard");
    } catch (err) {
      setError("Failed to start demo mode");
      showError("Demo Failed", "Could not start demo mode");
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setIsLoading(true);
    setError("");

    try {
      await loginAsDemo();
      success("Demo Mode", "Exploring with sample school data");
      router.push("/dashboard");
    } catch (err) {
      setError("Failed to start demo mode. Please try again.");
      showError("Demo Failed", "Please try again");
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
            <span className="material-symbols-outlined text-3xl text-white">
              school
            </span>
          </div>
          <p className="text-white/60 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary/90 to-primary/80 flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl text-white">
              school
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">eBursar</h1>
          <p className="text-white/60 text-sm">School Fee Management System</p>
        </div>

        {/* Login Card */}
        <Card className="backdrop-blur-xl bg-white/95 dark:bg-slate-900/95">
          <h2 className="text-xl font-bold text-center mb-6">Welcome Back</h2>

          {/* Google Sign-In Button */}
          <Button
            type="button"
            variant="outline"
            fullWidth
            onClick={handleGoogleLogin}
            disabled={isLoading || authLoading}
            className="mb-2 border-slate-300 hover:bg-slate-50"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </Button>

          {/* Quick Demo Access - Always visible */}
          <Button
            type="button"
            variant="primary"
            fullWidth
            onClick={handleQuickDemo}
            disabled={isLoading || authLoading}
            className="mb-4"
            icon={
              <span className="material-symbols-outlined text-sm">
                rocket_launch
              </span>
            }
          >
            Quick Demo Access
          </Button>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-700" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-slate-900 px-2 text-slate-400">
                or
              </span>
            </div>
          </div>

          {/* Login Method Toggle */}
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 mb-6">
            <button
              type="button"
              onClick={() => setLoginMethod("email")}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                loginMethod === "email"
                  ? "bg-white dark:bg-slate-700 shadow text-primary"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <span className="material-symbols-outlined text-sm align-middle mr-1">
                email
              </span>
              Email
            </button>
            <button
              type="button"
              onClick={() => setLoginMethod("phone")}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                loginMethod === "phone"
                  ? "bg-white dark:bg-slate-700 shadow text-primary"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <span className="material-symbols-outlined text-sm align-middle mr-1">
                phone
              </span>
              Phone
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {loginMethod === "email" ? (
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                  Email Address
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@school.ac.ug"
                  icon={
                    <span className="material-symbols-outlined text-sm">
                      email
                    </span>
                  }
                  required
                />
              </div>
            ) : (
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
              </div>
            )}

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  icon={
                    <span className="material-symbols-outlined text-sm">
                      lock
                    </span>
                  }
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined text-sm">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              <label htmlFor="remember" className="text-sm text-slate-500">
                Remember me
              </label>
            </div>

            {(error || authError) && (
              <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg">
                <p className="text-sm text-danger flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">
                    error
                  </span>
                  {error || authError}
                </p>
                <button
                  type="button"
                  onClick={handleQuickDemo}
                  className="mt-2 text-sm text-primary hover:underline"
                >
                  → Click here to use Demo Mode instead
                </button>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              fullWidth
              size="lg"
              loading={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-700" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-slate-900 px-2 text-slate-400">
                or
              </span>
            </div>
          </div>

          {/* Demo Access */}
          <Button
            type="button"
            variant="outline"
            fullWidth
            onClick={handleDemoLogin}
            disabled={isLoading}
            icon={
              <span className="material-symbols-outlined text-sm">
                play_arrow
              </span>
            }
          >
            Try Demo Mode
          </Button>

          {/* Sign Up Link */}
          <p className="text-center text-sm text-slate-500 mt-6">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="text-primary font-medium hover:underline"
            >
              Create Account
            </Link>
          </p>
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
