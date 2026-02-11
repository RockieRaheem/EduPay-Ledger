/**
 * Public Payment Verification Page
 *
 * Allows anyone to verify payment receipts against the Stellar blockchain.
 * This provides transparency and trust for fee payments.
 *
 * @module app/verify
 * @version 1.0.0
 */

"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui";
import { StellarVerifiedIcon, StellarTxLink } from "@/components/stellar";

// =============================================================================
// Types
// =============================================================================

interface VerificationResult {
  success: boolean;
  verified: boolean;
  timestamp?: string;
  network?: string;
  txHash?: string;
  explorerUrl?: string;
  memoHash?: string;
  error?: string;
  details?: {
    receiptNumber?: string;
    schoolId?: string;
    amount?: number;
    verifiedAt: string;
  };
}

type VerificationType = "receipt" | "hash";

// =============================================================================
// Component
// =============================================================================

function VerifyPageContent() {
  const searchParams = useSearchParams();

  // Form state
  const [verificationType, setVerificationType] =
    useState<VerificationType>("receipt");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [txHash, setTxHash] = useState("");

  // Result state
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill from URL params
  useEffect(() => {
    const hashParam = searchParams.get("hash");
    const receiptParam = searchParams.get("receipt");
    const schoolParam = searchParams.get("school");

    if (hashParam) {
      setVerificationType("hash");
      setTxHash(hashParam);
    } else if (receiptParam) {
      setVerificationType("receipt");
      setReceiptNumber(receiptParam);
      if (schoolParam) {
        setSchoolId(schoolParam);
      }
    }
  }, [searchParams]);

  const handleVerify = useCallback(async () => {
    setError(null);
    setResult(null);
    setIsLoading(true);

    try {
      let url = "/api/verify?";

      if (verificationType === "hash") {
        if (!txHash.trim()) {
          throw new Error("Transaction hash is required");
        }
        url += `type=hash&txHash=${encodeURIComponent(txHash.trim())}`;
      } else {
        if (!receiptNumber.trim()) {
          throw new Error("Receipt number is required");
        }
        if (!schoolId.trim()) {
          throw new Error("School ID is required");
        }
        url += `type=receipt&receiptNumber=${encodeURIComponent(receiptNumber.trim())}&schoolId=${encodeURIComponent(schoolId.trim())}`;
      }

      const response = await fetch(url);
      const data: VerificationResult = await response.json();

      setResult(data);

      if (!data.success && data.error) {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message || "Verification failed");
    } finally {
      setIsLoading(false);
    }
  }, [verificationType, txHash, receiptNumber, schoolId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">₿</span>
            </div>
            <span className="text-xl font-bold text-white">eBursar</span>
          </Link>
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            Secured by Stellar Blockchain
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
            Verify Payment
          </h1>
          <p className="text-slate-400 max-w-md mx-auto">
            Verify that a school fee payment has been recorded on the Stellar
            blockchain, providing an immutable audit trail.
          </p>
        </div>

        {/* Verification Form */}
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6 md:p-8 backdrop-blur-sm">
          {/* Verification Type Toggle */}
          <div className="flex rounded-lg bg-slate-900/50 p-1 mb-6">
            <button
              type="button"
              onClick={() => setVerificationType("receipt")}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                verificationType === "receipt"
                  ? "bg-emerald-500 text-white shadow-lg"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              By Receipt
            </button>
            <button
              type="button"
              onClick={() => setVerificationType("hash")}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                verificationType === "hash"
                  ? "bg-emerald-500 text-white shadow-lg"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              By Transaction
            </button>
          </div>

          {/* Form Fields */}
          {verificationType === "receipt" ? (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="receiptNumber"
                  className="block text-sm font-medium text-slate-300 mb-2"
                >
                  Receipt Number
                </label>
                <input
                  id="receiptNumber"
                  type="text"
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                  placeholder="e.g., RCP-20240115-A1B2"
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div>
                <label
                  htmlFor="schoolId"
                  className="block text-sm font-medium text-slate-300 mb-2"
                >
                  School ID
                </label>
                <input
                  id="schoolId"
                  type="text"
                  value={schoolId}
                  onChange={(e) => setSchoolId(e.target.value)}
                  placeholder="e.g., school_abc123"
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>
          ) : (
            <div>
              <label
                htmlFor="txHash"
                className="block text-sm font-medium text-slate-300 mb-2"
              >
                Stellar Transaction Hash
              </label>
              <input
                id="txHash"
                type="text"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder="64 character hex string"
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-mono text-sm"
              />
            </div>
          )}

          {/* Verify Button */}
          <Button
            onClick={handleVerify}
            loading={isLoading}
            disabled={isLoading}
            fullWidth
            className="mt-6"
          >
            {isLoading ? "Verifying..." : "Verify Payment"}
          </Button>

          {/* Error */}
          {error && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="mt-6 p-6 bg-slate-900/50 rounded-xl border border-slate-600/50">
              {result.verified ? (
                <div className="text-center">
                  <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center">
                      <StellarVerifiedIcon className="w-10 h-10 text-emerald-400" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-emerald-400 mb-2">
                    Payment Verified ✓
                  </h3>
                  <p className="text-slate-400 text-sm mb-4">
                    This payment has been anchored to the Stellar blockchain.
                  </p>

                  <div className="space-y-3 text-left bg-slate-800/50 rounded-lg p-4">
                    {result.txHash && (
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-slate-400 text-sm">
                          Transaction:
                        </span>
                        <StellarTxLink
                          txHash={result.txHash}
                          network={result.network as "TESTNET" | "PUBLIC"}
                        />
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-sm">Network:</span>
                      <span className="text-white font-medium">
                        {result.network}
                      </span>
                    </div>
                    {result.timestamp && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-sm">
                          Anchored:
                        </span>
                        <span className="text-white">
                          {new Date(result.timestamp).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {result.memoHash && (
                      <div>
                        <span className="text-slate-400 text-sm block mb-1">
                          Proof Hash:
                        </span>
                        <code className="text-xs text-emerald-400 bg-slate-900 px-2 py-1 rounded block overflow-x-auto">
                          {result.memoHash}
                        </code>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center">
                      <svg
                        className="w-10 h-10 text-amber-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-amber-400 mb-2">
                    Not Verified
                  </h3>
                  <p className="text-slate-400 text-sm">
                    {result.error ||
                      "This payment could not be verified on the blockchain."}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <div className="text-center">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-lg flex items-center justify-center mx-auto mb-3">
              <svg
                className="w-6 h-6 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <h4 className="text-white font-medium mb-1">Immutable</h4>
            <p className="text-slate-400 text-sm">
              Once recorded, payment proofs cannot be altered or deleted.
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mx-auto mb-3">
              <svg
                className="w-6 h-6 text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            </div>
            <h4 className="text-white font-medium mb-1">Transparent</h4>
            <p className="text-slate-400 text-sm">
              Anyone can verify payments using receipt numbers.
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mx-auto mb-3">
              <svg
                className="w-6 h-6 text-purple-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h4 className="text-white font-medium mb-1">Timestamped</h4>
            <p className="text-slate-400 text-sm">
              Each payment has a blockchain-confirmed timestamp.
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center text-slate-500 text-sm">
          <p>
            Powered by{" "}
            <a
              href="https://stellar.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:underline"
            >
              Stellar Network
            </a>
          </p>
          <p className="mt-2">
            <Link href="/" className="text-slate-400 hover:text-white">
              ← Back to eBursar
            </Link>
          </p>
        </footer>
      </main>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400"></div>
        </div>
      }
    >
      <VerifyPageContent />
    </Suspense>
  );
}
