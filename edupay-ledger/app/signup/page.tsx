"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { useFirebaseAuth } from "@/contexts/AuthContext";
import { validatePasswordStrength } from "@/lib/firebase";

// Password strength indicator colors
const strengthColors = {
  weak: "bg-red-500",
  fair: "bg-orange-500",
  good: "bg-yellow-500",
  strong: "bg-emerald-500",
};

const strengthLabels = {
  weak: "Weak",
  fair: "Fair",
  good: "Good",
  strong: "Strong",
};

export default function SignupPage() {
  const router = useRouter();
  const {
    user,
    isLoading: authLoading,
    register,
    signInWithGoogle,
    error: authError,
    clearError,
  } = useFirebaseAuth();

  // Form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [step, setStep] = useState<1 | 2>(1); // Multi-step form

  // Password strength
  const [passwordStrength, setPasswordStrength] = useState<
    ReturnType<typeof validatePasswordStrength>
  >({
    isValid: false,
    score: 0,
    errors: [],
    strength: "weak",
  });

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

  // Validate password on change
  const handlePasswordChange = useCallback((value: string) => {
    setPassword(value);
    setPasswordStrength(validatePasswordStrength(value));
  }, []);

  // Handle email/password registration
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    // Validation
    if (!fullName.trim()) {
      setError("Please enter your full name");
      setIsLoading(false);
      return;
    }

    if (!email.trim()) {
      setError("Please enter your email address");
      setIsLoading(false);
      return;
    }

    if (!passwordStrength.isValid) {
      setError("Please choose a stronger password");
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    if (!agreedToTerms) {
      setError("Please agree to the Terms of Service and Privacy Policy");
      setIsLoading(false);
      return;
    }

    try {
      await register(email, password, fullName, schoolName || "pending");
      router.push("/dashboard");
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to create account. Please try again.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Google Sign-In
  const handleGoogleSignup = async () => {
    setIsLoading(true);
    setError("");

    try {
      // This will redirect to Google - user will be redirected back automatically
      await signInWithGoogle?.();
      // Note: router.push not needed here as signInWithGoogle uses redirect flow
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Google sign-up failed. Please try again.";
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  // Progress to next step
  const handleNextStep = () => {
    if (!fullName.trim() || !email.trim()) {
      setError("Please fill in all required fields");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setError("");
    setStep(2);
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

  const displayError = error || authError;

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

        {/* Signup Card */}
        <Card className="backdrop-blur-xl bg-white/95 dark:bg-slate-900/95">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">Create Account</h2>
            {/* Step indicator */}
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-1 rounded-full transition-colors ${step >= 1 ? "bg-primary" : "bg-slate-200"}`}
              />
              <div
                className={`w-8 h-1 rounded-full transition-colors ${step >= 2 ? "bg-primary" : "bg-slate-200"}`}
              />
            </div>
          </div>

          {/* Google Sign-Up Button */}
          <Button
            type="button"
            variant="outline"
            fullWidth
            onClick={handleGoogleSignup}
            disabled={isLoading}
            className="mb-4 border-slate-300 hover:bg-slate-50"
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

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-700" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-slate-900 px-2 text-slate-400">
                or with email
              </span>
            </div>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            {step === 1 && (
              <>
                {/* Step 1: Basic Info */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                    Full Name *
                  </label>
                  <Input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                    icon={
                      <span className="material-symbols-outlined text-sm">
                        person
                      </span>
                    }
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                    Email Address *
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

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                    Phone Number (Optional)
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
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                    School Name (Optional)
                  </label>
                  <Input
                    type="text"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="St. Mary's Primary School"
                    icon={
                      <span className="material-symbols-outlined text-sm">
                        apartment
                      </span>
                    }
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    You can set up your school later in settings
                  </p>
                </div>

                {displayError && (
                  <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg">
                    <p className="text-sm text-danger flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">
                        error
                      </span>
                      {displayError}
                    </p>
                  </div>
                )}

                <Button
                  type="button"
                  variant="primary"
                  fullWidth
                  size="lg"
                  onClick={handleNextStep}
                  disabled={isLoading}
                >
                  Continue
                  <span className="material-symbols-outlined text-sm ml-1">
                    arrow_forward
                  </span>
                </Button>
              </>
            )}

            {step === 2 && (
              <>
                {/* Step 2: Password */}
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center text-sm text-slate-500 hover:text-primary transition-colors mb-2"
                >
                  <span className="material-symbols-outlined text-sm mr-1">
                    arrow_back
                  </span>
                  Back to previous step
                </button>

                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 mb-4">
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    <span className="font-medium">{fullName}</span>
                    <br />
                    <span className="text-slate-400">{email}</span>
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                    Create Password *
                  </label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => handlePasswordChange(e.target.value)}
                      placeholder="Create a strong password"
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

                  {/* Password Strength Indicator */}
                  {password && (
                    <div className="mt-2">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${strengthColors[passwordStrength.strength]}`}
                            style={{
                              width: `${(passwordStrength.score / 6) * 100}%`,
                            }}
                          />
                        </div>
                        <span
                          className={`text-xs font-medium ${
                            passwordStrength.strength === "strong"
                              ? "text-emerald-600"
                              : passwordStrength.strength === "good"
                                ? "text-yellow-600"
                                : passwordStrength.strength === "fair"
                                  ? "text-orange-600"
                                  : "text-red-600"
                          }`}
                        >
                          {strengthLabels[passwordStrength.strength]}
                        </span>
                      </div>

                      {/* Password requirements */}
                      <div className="space-y-1">
                        {[
                          {
                            check: password.length >= 8,
                            text: "At least 8 characters",
                          },
                          {
                            check: /[A-Z]/.test(password),
                            text: "One uppercase letter",
                          },
                          {
                            check: /[a-z]/.test(password),
                            text: "One lowercase letter",
                          },
                          { check: /[0-9]/.test(password), text: "One number" },
                          {
                            check: /[!@#$%^&*(),.?":{}|<>]/.test(password),
                            text: "One special character",
                          },
                        ].map((req, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-1.5 text-xs"
                          >
                            <span
                              className={`material-symbols-outlined text-xs ${req.check ? "text-emerald-500" : "text-slate-300"}`}
                            >
                              {req.check
                                ? "check_circle"
                                : "radio_button_unchecked"}
                            </span>
                            <span
                              className={
                                req.check
                                  ? "text-slate-600 dark:text-slate-400"
                                  : "text-slate-400"
                              }
                            >
                              {req.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                    Confirm Password *
                  </label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your password"
                      icon={
                        <span className="material-symbols-outlined text-sm">
                          lock
                        </span>
                      }
                      required
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <span className="material-symbols-outlined text-sm">
                        {showConfirmPassword ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">
                        error
                      </span>
                      Passwords do not match
                    </p>
                  )}
                  {confirmPassword && password === confirmPassword && (
                    <p className="text-xs text-emerald-500 mt-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">
                        check_circle
                      </span>
                      Passwords match
                    </p>
                  )}
                </div>

                {/* Terms Agreement */}
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <label htmlFor="terms" className="text-xs text-slate-500">
                    I agree to the{" "}
                    <Link
                      href="/terms"
                      className="text-primary hover:underline"
                    >
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link
                      href="/privacy"
                      className="text-primary hover:underline"
                    >
                      Privacy Policy
                    </Link>
                  </label>
                </div>

                {displayError && (
                  <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg">
                    <p className="text-sm text-danger flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">
                        error
                      </span>
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
                  disabled={
                    !passwordStrength.isValid ||
                    password !== confirmPassword ||
                    !agreedToTerms
                  }
                >
                  {isLoading ? "Creating Account..." : "Create Account"}
                </Button>
              </>
            )}
          </form>

          {/* Sign In Link */}
          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-primary font-medium hover:underline"
            >
              Sign In
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
