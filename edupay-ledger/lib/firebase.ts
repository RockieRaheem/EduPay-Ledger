/**
 * Firebase Configuration for EduPay Ledger
 * School Fee Management System for Ugandan Schools
 *
 * This module provides:
 * - Firebase App initialization with offline persistence
 * - Authentication (Email/Password + Phone for Uganda)
 * - Firestore Database with offline support
 * - Cloud Functions for backend operations
 * - Cloud Storage for documents and receipts
 * - Analytics for usage tracking
 */

import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import {
  getAuth,
  Auth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  signOut,
  onAuthStateChanged,
  RecaptchaVerifier,
  User as FirebaseUser,
  UserCredential,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from "firebase/auth";
import {
  getFirestore,
  Firestore,
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  Timestamp,
  serverTimestamp,
  writeBatch,
  runTransaction,
  onSnapshot,
  DocumentReference,
  CollectionReference,
  QueryConstraint,
} from "firebase/firestore";
import {
  getFunctions,
  Functions,
  connectFunctionsEmulator,
  httpsCallable,
} from "firebase/functions";
import {
  getStorage,
  FirebaseStorage,
  connectStorageEmulator,
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { getAnalytics, Analytics, isSupported } from "firebase/analytics";

// ============================================================================
// FIREBASE CONFIGURATION
// ============================================================================

/**
 * Validates that required Firebase environment variables are set in production
 */
function validateFirebaseConfig(): void {
  if (process.env.NODE_ENV === "production") {
    const required = [
      "NEXT_PUBLIC_FIREBASE_API_KEY",
      "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
      "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
      "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
      "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
      "NEXT_PUBLIC_FIREBASE_APP_ID",
    ];

    const missing = required.filter((key) => !process.env[key]);

    if (missing.length > 0) {
      console.error(
        `Missing required Firebase environment variables: ${missing.join(", ")}\n` +
          "Please configure these in your .env.local file or deployment environment.",
      );
    }
  }
}

// Run validation on import
validateFirebaseConfig();

/**
 * Firebase project configuration for EduPay Ledger
 *
 * SECURITY: All values MUST come from environment variables.
 * No hardcoded credentials are allowed.
 *
 * To configure:
 * 1. Create a .env.local file with your Firebase project credentials
 * 2. Or set environment variables in your deployment platform
 *
 * Required variables:
 * - NEXT_PUBLIC_FIREBASE_API_KEY
 * - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
 * - NEXT_PUBLIC_FIREBASE_PROJECT_ID
 * - NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
 * - NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
 * - NEXT_PUBLIC_FIREBASE_APP_ID
 * - NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID (optional, for analytics)
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "",
};

// ============================================================================
// FIREBASE INSTANCES
// ============================================================================

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let functions: Functions;
let storage: FirebaseStorage;
let analytics: Analytics | null = null;

/**
 * Initialize all Firebase services
 * Handles SSR (server-side rendering) and CSR (client-side rendering) appropriately
 */
export function initializeFirebase() {
  // Skip initialization if API key is not configured
  if (!firebaseConfig.apiKey) {
    console.warn(
      "Firebase API key not configured. Running in offline/mock mode.\n" +
        "To enable Firebase, add NEXT_PUBLIC_FIREBASE_API_KEY to your .env.local file.",
    );
    return;
  }

  if (getApps().length === 0) {
    // Initialize Firebase App
    app = initializeApp(firebaseConfig);

    // Initialize Auth
    auth = getAuth(app);

    // Initialize Firestore with offline persistence (client-side only)
    if (typeof window !== "undefined") {
      try {
        db = initializeFirestore(app, {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
        });
      } catch (e) {
        // Firestore already initialized, get existing instance
        db = getFirestore(app);
      }
    } else {
      db = getFirestore(app);
    }

    // Initialize Functions
    functions = getFunctions(app);

    // Initialize Storage
    storage = getStorage(app);

    // Initialize Analytics (client-side only, check if supported)
    // Only initialize if measurement ID is configured (analytics requires it)
    if (
      typeof window !== "undefined" &&
      firebaseConfig.apiKey &&
      firebaseConfig.measurementId
    ) {
      isSupported()
        .then((supported) => {
          if (supported) {
            try {
              analytics = getAnalytics(app);
            } catch (e) {
              // Analytics initialization failed - this is non-critical
              console.warn("Firebase Analytics initialization skipped:", e);
            }
          }
        })
        .catch((e) => {
          // isSupported check failed - this is non-critical
          console.warn("Firebase Analytics not supported:", e);
        });
    }

    // Connect to emulators in development (optional)
    if (
      process.env.NODE_ENV === "development" &&
      process.env.NEXT_PUBLIC_USE_EMULATORS === "true"
    ) {
      connectAuthEmulator(auth, "http://localhost:9099", {
        disableWarnings: true,
      });
      connectFirestoreEmulator(db, "localhost", 8080);
      connectFunctionsEmulator(functions, "localhost", 5001);
      connectStorageEmulator(storage, "localhost", 9199);
      console.log("🔧 Connected to Firebase Emulators");
    }

    console.log("✅ Firebase initialized successfully for EduPay Ledger");
  } else {
    // Get existing instances
    app = getApps()[0];
    auth = getAuth(app);
    db = getFirestore(app);
    functions = getFunctions(app);
    storage = getStorage(app);
  }

  return { app, auth, db, functions, storage, analytics };
}

// Initialize on module load (client-side only)
if (typeof window !== "undefined") {
  initializeFirebase();
}

// Export Firebase instances
export { app, auth, db, functions, storage, analytics };

// ============================================================================
// AUTHENTICATION HELPERS
// ============================================================================

/**
 * Sign in with email and password
 */
export async function signInWithEmail(
  email: string,
  password: string,
): Promise<UserCredential> {
  const { auth } = initializeFirebase();
  return signInWithEmailAndPassword(auth, email, password);
}

/**
 * Create a new user account
 */
export async function createUser(
  email: string,
  password: string,
  displayName: string,
): Promise<UserCredential> {
  const { auth } = initializeFirebase();
  const credential = await createUserWithEmailAndPassword(
    auth,
    email,
    password,
  );
  if (credential.user) {
    await updateProfile(credential.user, { displayName });
  }
  return credential;
}

/**
 * Send password reset email
 */
export async function resetPassword(email: string): Promise<void> {
  const { auth } = initializeFirebase();
  return sendPasswordResetEmail(auth, email);
}

/**
 * Sign out the current user
 */

export async function signOutUser(): Promise<void> {
  const { auth } = initializeFirebase();
  return signOut(auth);
}

/**
 * Listen to authentication state changes
 */
export function onAuthChange(
  callback: (user: FirebaseUser | null) => void,
): () => void {
  const { auth } = initializeFirebase();
  return onAuthStateChanged(auth, callback);
}

/**
 * Get the current authenticated user
 */
export function getCurrentUser(): FirebaseUser | null {
  const { auth } = initializeFirebase();
  return auth.currentUser;
}

// ============================================================================
// GOOGLE AUTHENTICATION
// ============================================================================

/**
 * Google Auth Provider instance
 */
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("email");
googleProvider.addScope("profile");
googleProvider.setCustomParameters({
  prompt: "select_account",
});

/**
 * Sign in with Google using popup (primary method)
 */
export async function signInWithGoogle(): Promise<UserCredential> {
  const { auth } = initializeFirebase();
  try {
    console.log("🔵 Starting Google sign-in with popup...");
    console.log("🔵 Auth domain:", firebaseConfig.authDomain);
    console.log(
      "🔵 Current URL:",
      typeof window !== "undefined" ? window.location.href : "SSR",
    );

    const result = await signInWithPopup(auth, googleProvider);
    console.log("✅ Google sign-in successful:", result.user.email);
    return result;
  } catch (error: any) {
    console.error("❌ Google sign-in error code:", error.code);
    console.error("❌ Google sign-in error message:", error.message);
    console.error("❌ Full error:", error);

    // Handle specific errors
    if (error.code === "auth/popup-blocked") {
      console.log("⚠️ Popup blocked, trying redirect...");
      await signInWithRedirect(auth, googleProvider);
      throw new Error("Popup blocked. Redirecting to Google sign-in...");
    }

    if (error.code === "auth/popup-closed-by-user") {
      throw new Error("Sign-in cancelled. Please try again.");
    }

    if (error.code === "auth/cancelled-popup-request") {
      throw new Error("Another sign-in is in progress.");
    }

    if (error.code === "auth/unauthorized-domain") {
      throw new Error(
        "This domain is not authorized. Please add localhost to Firebase Console → Authentication → Settings → Authorized domains.",
      );
    }

    throw error;
  }
}

/**
 * Get result from redirect sign-in (call on page load)
 */
export async function getGoogleRedirectResult(): Promise<UserCredential | null> {
  const { auth } = initializeFirebase();
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      console.log("Got redirect result:", result.user.email);
    }
    return result;
  } catch (error: any) {
    console.error("Redirect result error:", error);
    throw error;
  }
}

// ============================================================================
// EMAIL VERIFICATION
// ============================================================================

/**
 * Send email verification to current user
 */
export async function sendVerificationEmail(): Promise<void> {
  const { auth } = initializeFirebase();
  if (auth.currentUser) {
    return sendEmailVerification(auth.currentUser);
  }
  throw new Error("No user is currently signed in");
}

/**
 * Check if current user's email is verified
 */
export function isEmailVerified(): boolean {
  const { auth } = initializeFirebase();
  return auth.currentUser?.emailVerified ?? false;
}

// ============================================================================
// PASSWORD MANAGEMENT
// ============================================================================

/**
 * Update user's password (requires recent authentication)
 */
export async function updateUserPassword(newPassword: string): Promise<void> {
  const { auth } = initializeFirebase();
  if (auth.currentUser) {
    return updatePassword(auth.currentUser, newPassword);
  }
  throw new Error("No user is currently signed in");
}

/**
 * Reauthenticate user before sensitive operations
 */
export async function reauthenticateUser(
  email: string,
  password: string,
): Promise<UserCredential> {
  const { auth } = initializeFirebase();
  if (auth.currentUser) {
    const credential = EmailAuthProvider.credential(email, password);
    return reauthenticateWithCredential(auth.currentUser, credential);
  }
  throw new Error("No user is currently signed in");
}

/**
 * Validate password strength
 * Requirements:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  score: number;
  errors: string[];
  strength: "weak" | "fair" | "good" | "strong";
} {
  const errors: string[] = [];
  let score = 0;

  // Length check
  if (password.length >= 8) {
    score += 1;
  } else {
    errors.push("At least 8 characters required");
  }

  if (password.length >= 12) {
    score += 1;
  }

  // Uppercase check
  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    errors.push("At least one uppercase letter required");
  }

  // Lowercase check
  if (/[a-z]/.test(password)) {
    score += 1;
  } else {
    errors.push("At least one lowercase letter required");
  }

  // Number check
  if (/[0-9]/.test(password)) {
    score += 1;
  } else {
    errors.push("At least one number required");
  }

  // Special character check
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    score += 1;
  } else {
    errors.push("At least one special character required (!@#$%^&*...)");
  }

  // Determine strength
  let strength: "weak" | "fair" | "good" | "strong" = "weak";
  if (score >= 6) strength = "strong";
  else if (score >= 4) strength = "good";
  else if (score >= 3) strength = "fair";

  return {
    isValid: errors.length === 0,
    score,
    errors,
    strength,
  };
}

// ============================================================================
// PHONE AUTHENTICATION (Uganda)
// ============================================================================

/**
 * Setup reCAPTCHA verifier for phone authentication
 */
export function setupRecaptcha(containerId: string): RecaptchaVerifier {
  const { auth } = initializeFirebase();
  return new RecaptchaVerifier(auth, containerId, {
    size: "invisible",
    callback: () => {
      console.log("reCAPTCHA solved");
    },
  });
}

/**
 * Sign in with phone number (Uganda format)
 * Automatically formats Uganda phone numbers with +256 country code
 */
export async function signInWithPhone(
  phoneNumber: string,
  recaptchaVerifier: RecaptchaVerifier,
) {
  const { auth } = initializeFirebase();
  // Ensure phone number has Uganda country code
  const formattedPhone = formatUgandaPhone(phoneNumber);
  return signInWithPhoneNumber(auth, formattedPhone, recaptchaVerifier);
}

/**
 * Format phone number to Uganda international format
 */
export function formatUgandaPhone(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");

  // If already has country code
  if (digits.startsWith("256")) {
    return `+${digits}`;
  }

  // Remove leading zero and add country code
  const localNumber = digits.startsWith("0") ? digits.slice(1) : digits;
  return `+256${localNumber}`;
}

// ============================================================================
// FIRESTORE DATABASE HELPERS
// ============================================================================

/**
 * Collection names for EduPay Ledger
 */
export const COLLECTIONS = {
  SCHOOLS: "schools",
  STUDENTS: "students",
  PAYMENTS: "payments",
  USERS: "users",
  AUDIT_LOGS: "audit_logs",
  FEE_STRUCTURES: "fee_structures",
  INSTALLMENT_RULES: "installment_rules",
  TERMS: "terms",
  CLASSES: "classes",
  SMS_LOGS: "sms_logs",
  RECEIPTS: "receipts",
  SETTINGS: "settings",
} as const;

/**
 * Get a document reference
 */
export function getDocRef(
  collectionName: string,
  docId: string,
): DocumentReference {
  const { db } = initializeFirebase();
  return doc(db, collectionName, docId);
}

/**
 * Get a collection reference
 */
export function getCollectionRef(collectionName: string): CollectionReference {
  const { db } = initializeFirebase();
  return collection(db, collectionName);
}

/**
 * Fetch a single document by ID
 */
export async function fetchDocument<T>(
  collectionName: string,
  docId: string,
): Promise<T | null> {
  const { db } = initializeFirebase();
  const docRef = doc(db, collectionName, docId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as T;
  }
  return null;
}

/**
 * Fetch all documents from a collection with optional query constraints
 * Supports both spread arguments and array of constraints
 */
export async function fetchCollection<T>(
  collectionName: string,
  queryConstraints: QueryConstraint[] = [],
): Promise<T[]> {
  const { db } = initializeFirebase();
  const collectionRef = collection(db, collectionName);
  const q =
    queryConstraints.length > 0
      ? query(collectionRef, ...queryConstraints)
      : query(collectionRef);
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as T[];
}

/**
 * Create or update a document
 */
export async function saveDocument<T extends Record<string, any>>(
  collectionName: string,
  docId: string,
  data: T,
  merge: boolean = true,
): Promise<void> {
  const { db } = initializeFirebase();
  const docRef = doc(db, collectionName, docId);
  await setDoc(
    docRef,
    {
      ...data,
      updatedAt: serverTimestamp(),
    },
    { merge },
  );
}

/**
 * Update specific fields in a document
 */
export async function updateDocument(
  collectionName: string,
  docId: string,
  data: Record<string, any>,
): Promise<void> {
  const { db } = initializeFirebase();
  const docRef = doc(db, collectionName, docId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a document
 */
export async function removeDocument(
  collectionName: string,
  docId: string,
): Promise<void> {
  const { db } = initializeFirebase();
  const docRef = doc(db, collectionName, docId);
  await deleteDoc(docRef);
}

/**
 * Batch write multiple documents
 */
export async function batchWrite(
  operations: Array<{
    type: "set" | "update" | "delete";
    collection: string;
    docId: string;
    data?: Record<string, any>;
  }>,
): Promise<void> {
  const { db } = initializeFirebase();
  const batch = writeBatch(db);

  operations.forEach((op) => {
    const docRef = doc(db, op.collection, op.docId);
    switch (op.type) {
      case "set":
        batch.set(
          docRef,
          { ...op.data, updatedAt: serverTimestamp() },
          { merge: true },
        );
        break;
      case "update":
        batch.update(docRef, { ...op.data, updatedAt: serverTimestamp() });
        break;
      case "delete":
        batch.delete(docRef);
        break;
    }
  });

  await batch.commit();
}

/**
 * Run a transaction
 */
export async function runFirestoreTransaction<T>(
  transactionFn: (transaction: any) => Promise<T>,
): Promise<T> {
  const { db } = initializeFirebase();
  return runTransaction(db, transactionFn);
}

/**
 * Subscribe to real-time updates on a document
 */
export function subscribeToDocument<T>(
  collectionName: string,
  docId: string,
  callback: (data: T | null) => void,
  onError?: (error: Error) => void,
): () => void {
  const { db } = initializeFirebase();
  const docRef = doc(db, collectionName, docId);

  return onSnapshot(
    docRef,
    (docSnap) => {
      if (docSnap.exists()) {
        callback({ id: docSnap.id, ...docSnap.data() } as T);
      } else {
        callback(null);
      }
    },
    (error) => {
      if (onError) onError(error);
      else console.error("Document subscription error:", error);
    },
  );
}

/**
 * Subscribe to real-time updates on a collection
 */
export function subscribeToCollection<T>(
  collectionName: string,
  queryConstraints: QueryConstraint[],
  callback: (data: T[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const { db } = initializeFirebase();
  const collectionRef = collection(db, collectionName);
  const q =
    queryConstraints.length > 0
      ? query(collectionRef, ...queryConstraints)
      : query(collectionRef);

  return onSnapshot(
    q,
    (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as T[];
      callback(data);
    },
    (error) => {
      if (onError) onError(error);
      else console.error("Collection subscription error:", error);
    },
  );
}

// ============================================================================
// CLOUD STORAGE HELPERS
// ============================================================================

/**
 * Upload a file to Firebase Storage
 */
export async function uploadFile(
  path: string,
  file: Blob | File,
  metadata?: { contentType?: string; customMetadata?: Record<string, string> },
): Promise<string> {
  const { storage } = initializeFirebase();
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, metadata);
  return getDownloadURL(storageRef);
}

/**
 * Get download URL for a file
 */
export async function getFileUrl(path: string): Promise<string> {
  const { storage } = initializeFirebase();
  const storageRef = ref(storage, path);
  return getDownloadURL(storageRef);
}

// ============================================================================
// CLOUD FUNCTIONS HELPERS
// ============================================================================

/**
 * Call a Cloud Function
 */
export async function callFunction<T = any, R = any>(
  functionName: string,
  data?: T,
): Promise<R> {
  const { functions } = initializeFirebase();
  const callable = httpsCallable<T, R>(functions, functionName);
  const result = await callable(data);
  return result.data;
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

/**
 * Log an action to the audit trail
 * @param action - The action type (CREATE, UPDATE, DELETE, etc.)
 * @param collection - The collection being modified
 * @param documentId - The ID of the document being modified
 * @param userId - The ID of the user performing the action
 * @param details - Additional details about the action
 */
export async function logAuditAction(
  action: string,
  collectionName: string,
  documentId: string,
  userId: string,
  details?: Record<string, any>,
): Promise<void> {
  const { db, auth } = initializeFirebase();
  const user = auth.currentUser;

  const auditLog = {
    action,
    collection: collectionName,
    documentId,
    details: details || {},
    userId: userId || user?.uid || "system",
    userEmail: user?.email || "system",
    timestamp: serverTimestamp(),
    ipAddress: typeof window !== "undefined" ? "client" : "server",
  };

  const logsRef = collection(db, COLLECTIONS.AUDIT_LOGS);
  await setDoc(doc(logsRef), auditLog);
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

// Re-export commonly used Firestore functions for convenience
export {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  Timestamp,
  serverTimestamp,
  writeBatch,
  runTransaction,
  onSnapshot,
};

// Export types
export type {
  FirebaseUser,
  UserCredential,
  DocumentReference,
  CollectionReference,
  QueryConstraint,
};
