"use client";

/**
 * Firebase Context Provider for eBursar
 * Provides Firebase authentication state and user data throughout the app
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  initializeFirebase,
  onAuthChange,
  signInWithEmail,
  signOutUser,
  createUser,
  resetPassword,
  getCurrentUser,
  fetchDocument,
  saveDocument,
  COLLECTIONS,
  signInWithGoogle as firebaseSignInWithGoogle,
  getGoogleRedirectResult,
  sendVerificationEmail,
} from "@/lib/firebase";
import type { User as FirebaseUser } from "firebase/auth";
import {
  authRateLimiter,
  RateLimitError,
  formatRateLimitTime,
} from "@/lib/services/rate-limiter.service";

// ============================================================================
// TYPES
// ============================================================================

export interface EBursarUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  phoneNumber: string | null;
  role: "admin" | "bursar" | "registrar" | "teacher" | "viewer";
  schoolId: string;
  schoolName?: string;
  permissions: string[];
  isActive: boolean;
  lastLogin?: Date;
  createdAt?: Date;
}

export interface AuthContextType {
  // State
  user: EBursarUser | null;
  firebaseUser: FirebaseUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isDemoMode: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  loginAsDemo: () => Promise<void>;
  logout: () => Promise<void>;
  register: (
    email: string,
    password: string,
    displayName: string,
    schoolId: string,
  ) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  sendEmailVerification: () => Promise<void>;
  clearError: () => void;
  refreshUser: () => Promise<void>;

  // Permission checks
  hasPermission: (permission: string) => boolean;
  hasRole: (role: EBursarUser["role"] | EBursarUser["role"][]) => boolean;
}

// ============================================================================
// CONTEXT
// ============================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<EBursarUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Demo user for trial mode
  const DEMO_USER: EBursarUser = {
    uid: "demo-user-001",
    email: "demo@ebursar.ug",
    displayName: "Demo Admin",
    photoURL: null,
    phoneNumber: "+256700000000",
    role: "admin",
    schoolId: "demo-school-001",
    schoolName: "Demo Primary School",
    permissions: ["all"],
    isActive: true,
    lastLogin: new Date(),
    createdAt: new Date("2024-01-01"),
  };

  // Check for demo mode in localStorage on mount
  useEffect(() => {
    const savedDemoMode = localStorage.getItem("ebursar_demo_mode");
    if (savedDemoMode === "true") {
      setIsDemoMode(true);
      setUser(DEMO_USER);
      setIsLoading(false);
    }
  }, []);

  // Initialize Firebase and listen to auth changes
  useEffect(() => {
    // Skip Firebase auth if in demo mode
    if (isDemoMode) return;

    initializeFirebase();

    const unsubscribe = onAuthChange(async (fbUser) => {
      setFirebaseUser(fbUser);

      if (fbUser) {
        try {
          // Fetch user profile from Firestore
          const userProfile = await fetchDocument<EBursarUser>(
            COLLECTIONS.USERS,
            fbUser.uid,
          );

          if (userProfile) {
            setUser({
              ...userProfile,
              uid: fbUser.uid,
              email: fbUser.email,
              displayName: fbUser.displayName || userProfile.displayName,
              photoURL: fbUser.photoURL,
              phoneNumber: fbUser.phoneNumber,
            });
          } else {
            // User exists in Auth but not in Firestore - create basic profile
            const newUser: EBursarUser = {
              uid: fbUser.uid,
              email: fbUser.email,
              displayName: fbUser.displayName,
              photoURL: fbUser.photoURL,
              phoneNumber: fbUser.phoneNumber,
              role: "viewer",
              schoolId: "",
              permissions: [],
              isActive: true,
            };
            setUser(newUser);
          }
        } catch (err) {
          console.error("Error fetching user profile:", err);
          setError("Failed to load user profile");
        }
      } else {
        setUser(null);
      }

      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [isDemoMode]);

  // Login with rate limiting
  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // Check rate limit before attempting login
      const rateLimitStatus = authRateLimiter.isRateLimited(
        email.toLowerCase(),
      );
      if (rateLimitStatus.limited) {
        const message = `Too many failed login attempts. Please try again in ${formatRateLimitTime(rateLimitStatus.retryAfter || 0)}.`;
        setError(message);
        throw new RateLimitError(message, rateLimitStatus.retryAfter);
      }

      await signInWithEmail(email, password);

      // Success - clear rate limit
      authRateLimiter.recordSuccess(email.toLowerCase());

      // Update last login timestamp
      const currentUser = getCurrentUser();
      if (currentUser) {
        await saveDocument(COLLECTIONS.USERS, currentUser.uid, {
          lastLogin: new Date(),
        });
      }
    } catch (err: any) {
      // If it's already a rate limit error, re-throw
      if (err instanceof RateLimitError) {
        throw err;
      }

      // Record failed attempt
      const result = authRateLimiter.recordFailedAttempt(email.toLowerCase());

      let errorMessage = getAuthErrorMessage(err.code);

      // Add rate limit warning to error message
      if (result.locked) {
        errorMessage = `${errorMessage} Account locked for ${formatRateLimitTime(result.lockoutSeconds || 0)} due to too many failed attempts.`;
      } else if (
        result.attemptsRemaining > 0 &&
        result.attemptsRemaining <= 3
      ) {
        errorMessage = `${errorMessage} ${result.attemptsRemaining} attempt${result.attemptsRemaining !== 1 ? "s" : ""} remaining before lockout.`;
      }

      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Login as Demo User (Trial Mode)
  const loginAsDemo = async () => {
    setIsLoading(true);
    setError(null);

    // Set demo mode
    setIsDemoMode(true);
    setUser(DEMO_USER);
    localStorage.setItem("ebursar_demo_mode", "true");

    setIsLoading(false);
  };

  // Sign in with Google (uses popup flow)
  const signInWithGoogle = async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log("AuthContext: Starting Google sign-in...");

      const result = await firebaseSignInWithGoogle();
      console.log("AuthContext: Google sign-in result:", result?.user?.email);

      if (result && result.user) {
        // Try to save/update user profile in Firestore (but don't fail if permissions deny)
        try {
          const existingProfile = await fetchDocument<EBursarUser>(
            COLLECTIONS.USERS,
            result.user.uid,
          );

          if (!existingProfile) {
            // Create new user profile for Google sign-in
            const newUser: Partial<EBursarUser> = {
              uid: result.user.uid,
              email: result.user.email,
              displayName: result.user.displayName,
              photoURL: result.user.photoURL,
              phoneNumber: result.user.phoneNumber,
              role: "viewer", // Default role
              schoolId: "",
              permissions: [],
              isActive: true,
              createdAt: new Date(),
              lastLogin: new Date(),
            };

            await saveDocument(COLLECTIONS.USERS, result.user.uid, newUser);
            console.log("AuthContext: Created new user profile");
          } else {
            // Update last login
            await saveDocument(COLLECTIONS.USERS, result.user.uid, {
              lastLogin: new Date(),
              photoURL: result.user.photoURL,
            });
            console.log("AuthContext: Updated existing user profile");
          }
        } catch (firestoreErr) {
          // Firestore permission error - user is still authenticated, just can't save profile
          console.warn(
            "AuthContext: Could not save user profile to Firestore (permissions). User is still logged in.",
            firestoreErr,
          );
        }

        // Set user state directly from Google auth result
        const googleUser: EBursarUser = {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName,
          photoURL: result.user.photoURL,
          phoneNumber: result.user.phoneNumber,
          role: "admin", // Default role for Google sign-in
          schoolId: "",
          schoolName: "",
          permissions: ["all"],
          isActive: true,
          lastLogin: new Date(),
        };
        setUser(googleUser);
        console.log("AuthContext: Google sign-in complete, user set");
      }
    } catch (err: any) {
      console.error("AuthContext: Google sign-in error:", err);
      const errorMessage = err.message || getAuthErrorMessage(err.code);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Google redirect result on page load
  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        const result = await getGoogleRedirectResult();
        if (result && result.user) {
          // Check if user profile exists in Firestore
          const existingProfile = await fetchDocument<EBursarUser>(
            COLLECTIONS.USERS,
            result.user.uid,
          );

          if (!existingProfile) {
            // Create new user profile for Google sign-in
            const newUser: Partial<EBursarUser> = {
              uid: result.user.uid,
              email: result.user.email,
              displayName: result.user.displayName,
              photoURL: result.user.photoURL,
              phoneNumber: result.user.phoneNumber,
              role: "viewer", // Default role
              schoolId: "",
              permissions: [],
              isActive: true,
              createdAt: new Date(),
              lastLogin: new Date(),
            };

            await saveDocument(COLLECTIONS.USERS, result.user.uid, newUser);
          } else {
            // Update last login
            await saveDocument(COLLECTIONS.USERS, result.user.uid, {
              lastLogin: new Date(),
              photoURL: result.user.photoURL, // Update photo in case it changed
            });
          }
        }
      } catch (err: any) {
        console.error("Google redirect error:", err);
        setError(getAuthErrorMessage(err.code));
      }
    };

    handleRedirectResult();
  }, []);

  // Send Email Verification
  const handleSendEmailVerification = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await sendVerificationEmail();
    } catch (err: any) {
      const errorMessage =
        "Failed to send verification email. Please try again.";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Logout
  const logout = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Clear demo mode if active
      if (isDemoMode) {
        setIsDemoMode(false);
        localStorage.removeItem("ebursar_demo_mode");
        setUser(null);
        setIsLoading(false);
        return;
      }

      await signOutUser();
      setUser(null);
    } catch (err: any) {
      setError("Failed to sign out");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Register
  const register = async (
    email: string,
    password: string,
    displayName: string,
    schoolId: string,
  ) => {
    try {
      setIsLoading(true);
      setError(null);

      const credential = await createUser(email, password, displayName);

      // Create user profile in Firestore
      const newUser: Partial<EBursarUser> = {
        uid: credential.user.uid,
        email: credential.user.email,
        displayName,
        role: "viewer", // Default role, admin will upgrade
        schoolId,
        permissions: [],
        isActive: true,
        createdAt: new Date(),
      };

      await saveDocument(COLLECTIONS.USERS, credential.user.uid, newUser);
    } catch (err: any) {
      const errorMessage = getAuthErrorMessage(err.code);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Forgot Password
  const forgotPassword = async (email: string) => {
    try {
      setIsLoading(true);
      setError(null);
      await resetPassword(email);
    } catch (err: any) {
      const errorMessage = getAuthErrorMessage(err.code);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Clear Error
  const clearError = () => setError(null);

  // Refresh User
  const refreshUser = async () => {
    if (firebaseUser) {
      const userProfile = await fetchDocument<EBursarUser>(
        COLLECTIONS.USERS,
        firebaseUser.uid,
      );
      if (userProfile) {
        setUser({
          ...userProfile,
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || userProfile.displayName,
          photoURL: firebaseUser.photoURL,
          phoneNumber: firebaseUser.phoneNumber,
        });
      }
    }
  };

  // Check Permission
  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    if (user.role === "admin") return true;
    return (
      user.permissions.includes(permission) || user.permissions.includes("all")
    );
  };

  // Check Role
  const hasRole = (
    role: EBursarUser["role"] | EBursarUser["role"][],
  ): boolean => {
    if (!user) return false;
    if (Array.isArray(role)) {
      return role.includes(user.role);
    }
    return user.role === role;
  };

  const value: AuthContextType = {
    user,
    firebaseUser,
    isLoading,
    isAuthenticated: !!user,
    isDemoMode,
    error,
    login,
    loginAsDemo,
    logout,
    register,
    signInWithGoogle,
    forgotPassword,
    sendEmailVerification: handleSendEmailVerification,
    clearError,
    refreshUser,
    hasPermission,
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useFirebaseAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useFirebaseAuth must be used within an AuthProvider");
  }
  return context;
}

// ============================================================================
// HELPERS
// ============================================================================

function getAuthErrorMessage(code: string): string {
  const errorMessages: Record<string, string> = {
    "auth/invalid-email": "Invalid email address.",
    "auth/user-disabled": "This account has been disabled.",
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/email-already-in-use": "An account already exists with this email.",
    "auth/weak-password": "Password should be at least 6 characters.",
    "auth/operation-not-allowed": "This sign-in method is not allowed.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
    "auth/network-request-failed":
      "Network error. Please check your connection.",
    "auth/invalid-credential": "Invalid email or password.",
  };

  return errorMessages[code] || "An error occurred. Please try again.";
}

// ============================================================================
// PERMISSIONS
// ============================================================================

export const PERMISSIONS = {
  // Students
  STUDENTS_VIEW: "students:view",
  STUDENTS_CREATE: "students:create",
  STUDENTS_EDIT: "students:edit",
  STUDENTS_DELETE: "students:delete",

  // Payments
  PAYMENTS_VIEW: "payments:view",
  PAYMENTS_RECORD: "payments:record",
  PAYMENTS_REVERSE: "payments:reverse",
  PAYMENTS_EXPORT: "payments:export",

  // Reports
  REPORTS_VIEW: "reports:view",
  REPORTS_GENERATE: "reports:generate",
  REPORTS_EXPORT: "reports:export",

  // Settings
  SETTINGS_VIEW: "settings:view",
  SETTINGS_EDIT: "settings:edit",

  // Users
  USERS_VIEW: "users:view",
  USERS_MANAGE: "users:manage",

  // Audit
  AUDIT_VIEW: "audit:view",
} as const;

export const ROLE_PERMISSIONS: Record<EBursarUser["role"], string[]> = {
  admin: ["all"],
  bursar: [
    PERMISSIONS.STUDENTS_VIEW,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.PAYMENTS_RECORD,
    PERMISSIONS.PAYMENTS_EXPORT,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_GENERATE,
    PERMISSIONS.REPORTS_EXPORT,
  ],
  registrar: [
    PERMISSIONS.STUDENTS_VIEW,
    PERMISSIONS.STUDENTS_CREATE,
    PERMISSIONS.STUDENTS_EDIT,
    PERMISSIONS.PAYMENTS_VIEW,
  ],
  teacher: [PERMISSIONS.STUDENTS_VIEW, PERMISSIONS.PAYMENTS_VIEW],
  viewer: [
    PERMISSIONS.STUDENTS_VIEW,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.REPORTS_VIEW,
  ],
};
