/**
 * Stellar Payment Verification API
 *
 * Public API endpoint for verifying payment proofs on the Stellar blockchain.
 * Supports verification by receipt number or Stellar transaction hash.
 *
 * @module api/verify
 * @version 1.0.0
 * @author eBursar Development Team
 */

import { NextRequest, NextResponse } from "next/server";
import { getTransactionByHash, getStellarHealthStatus } from "@/lib/stellar";

// =============================================================================
// Types
// =============================================================================

interface VerifyByHashRequest {
  type: "hash";
  txHash: string;
}

interface VerifyByReceiptRequest {
  type: "receipt";
  receiptNumber: string;
  amount?: number;
}

type VerifyRequest = VerifyByHashRequest | VerifyByReceiptRequest;

interface VerifyResponse {
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
    amount?: number;
    verifiedAt: string;
  };
}

// =============================================================================
// Constants
// =============================================================================

const STELLAR_NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK || "TESTNET";
const EXPLORER_URL =
  STELLAR_NETWORK === "PUBLIC"
    ? "https://stellar.expert/explorer/public/tx"
    : "https://stellar.expert/explorer/testnet/tx";

// Rate limiting (in-memory, per-IP)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 30; // 30 requests per minute

// =============================================================================
// Rate Limiting
// =============================================================================

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }

  record.count++;
  return true;
}

// =============================================================================
// Validation
// =============================================================================

function validateTxHash(hash: string): boolean {
  // Stellar transaction hashes are 64 character hex strings
  return /^[a-fA-F0-9]{64}$/.test(hash);
}

function validateReceiptNumber(receipt: string): boolean {
  // Receipt format: RCP-YYYYMMDD-XXXX or similar
  return (
    /^[A-Z]{2,4}-\d{8}-[A-Z0-9]{4,8}$/i.test(receipt) || receipt.length > 5
  );
}

function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>"']/g, "");
}

// =============================================================================
// Handlers
// =============================================================================

/**
 * Verify a payment by Stellar transaction hash
 */
async function verifyByHash(txHash: string): Promise<VerifyResponse> {
  if (!validateTxHash(txHash)) {
    return {
      success: false,
      verified: false,
      error:
        "Invalid transaction hash format. Expected 64 character hex string.",
    };
  }

  try {
    const transaction = await getTransactionByHash(txHash);

    if (!transaction) {
      return {
        success: true,
        verified: false,
        error: "Transaction not found on blockchain",
      };
    }

    return {
      success: true,
      verified: transaction.successful,
      timestamp: transaction.createdAt,
      network: STELLAR_NETWORK,
      txHash: transaction.hash,
      explorerUrl: `${EXPLORER_URL}/${transaction.hash}`,
      memoHash: transaction.memoValue,
      details: {
        verifiedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("[Verify API] Error verifying by hash:", error);
    return {
      success: false,
      verified: false,
      error: "Failed to verify transaction",
    };
  }
}

/**
 * Verify a payment by receipt number
 */
async function verifyByReceipt(
  receiptNumber: string,
  amount?: number,
): Promise<VerifyResponse> {
  if (!validateReceiptNumber(receiptNumber)) {
    return {
      success: false,
      verified: false,
      error: "Invalid receipt number format",
    };
  }

  try {
    // Import the database service for receipt lookup
    const { verifyByReceiptNumber } =
      await import("@/lib/services/stellar.service");

    const result = await verifyByReceiptNumber(
      sanitizeInput(receiptNumber),
      amount,
    );

    if (result.isVerified) {
      return {
        success: true,
        verified: true,
        timestamp: result.anchoredAt,
        network: STELLAR_NETWORK,
        explorerUrl: result.explorerUrl,
        details: {
          receiptNumber,
          amount,
          verifiedAt: new Date().toISOString(),
        },
      };
    }

    return {
      success: true,
      verified: false,
      error: result.message || "No blockchain anchor found for this receipt",
    };
  } catch (error) {
    console.error("[Verify API] Error verifying by receipt:", error);
    return {
      success: false,
      verified: false,
      error: "Failed to verify receipt",
    };
  }
}

// =============================================================================
// API Routes
// =============================================================================

/**
 * GET /api/verify?type=hash&txHash=xxx
 * GET /api/verify?type=receipt&receiptNumber=xxx&amount=xxx
 *
 * Public endpoint for verifying payments
 */
export async function GET(
  request: NextRequest,
): Promise<NextResponse<VerifyResponse>> {
  const ip = request.headers.get("x-forwarded-for") || "unknown";

  // Rate limiting
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      {
        success: false,
        verified: false,
        error: "Too many requests. Please try again later.",
      },
      { status: 429 },
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type");

  if (type === "hash") {
    const txHash = searchParams.get("txHash");

    if (!txHash) {
      return NextResponse.json(
        {
          success: false,
          verified: false,
          error: "txHash parameter is required",
        },
        { status: 400 },
      );
    }

    const result = await verifyByHash(sanitizeInput(txHash));
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  }

  if (type === "receipt") {
    const receiptNumber = searchParams.get("receiptNumber");
    const amount = searchParams.get("amount");

    if (!receiptNumber) {
      return NextResponse.json(
        {
          success: false,
          verified: false,
          error: "receiptNumber parameter is required",
        },
        { status: 400 },
      );
    }

    const result = await verifyByReceipt(
      sanitizeInput(receiptNumber),
      amount ? parseFloat(amount) : undefined,
    );
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  }

  return NextResponse.json(
    {
      success: false,
      verified: false,
      error: "Invalid verification type. Use 'hash' or 'receipt'.",
    },
    { status: 400 },
  );
}

/**
 * POST /api/verify
 *
 * Public endpoint for verifying payments with request body
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<VerifyResponse>> {
  const ip = request.headers.get("x-forwarded-for") || "unknown";

  // Rate limiting
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      {
        success: false,
        verified: false,
        error: "Too many requests. Please try again later.",
      },
      { status: 429 },
    );
  }

  try {
    const body: VerifyRequest = await request.json();

    if (body.type === "hash") {
      if (!body.txHash) {
        return NextResponse.json(
          {
            success: false,
            verified: false,
            error: "txHash is required",
          },
          { status: 400 },
        );
      }

      const result = await verifyByHash(sanitizeInput(body.txHash));
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    if (body.type === "receipt") {
      if (!body.receiptNumber) {
        return NextResponse.json(
          {
            success: false,
            verified: false,
            error: "receiptNumber is required",
          },
          { status: 400 },
        );
      }

      const result = await verifyByReceipt(
        sanitizeInput(body.receiptNumber),
        body.amount,
      );
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    return NextResponse.json(
      {
        success: false,
        verified: false,
        error: "Invalid verification type. Use 'hash' or 'receipt'.",
      },
      { status: 400 },
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        verified: false,
        error: "Invalid request body",
      },
      { status: 400 },
    );
  }
}

/**
 * Health check for Stellar integration
 */
export async function OPTIONS(): Promise<NextResponse> {
  const health = await getStellarHealthStatus();

  return NextResponse.json(
    {
      status: health.isConnected ? "healthy" : "degraded",
      network: health.network,
      horizon: health.isConnected,
    },
    {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    },
  );
}
