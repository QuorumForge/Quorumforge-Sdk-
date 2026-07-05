import type { ProposalStatus, ProposalType, Proposal } from "./types.js";

// ─── Status Formatting ───────────────────────────────────────────────────────

/**
 * Returns a human-readable label for a proposal status.
 * @example formatProposalStatus("Pending") → "⏳ Pending"
 */
export function formatProposalStatus(status: ProposalStatus): string {
  const labels: Record<ProposalStatus, string> = {
    Pending: "⏳ Pending",
    Executed: "✅ Executed",
    Expired: "🕐 Expired",
    Cancelled: "🚫 Cancelled",
  };
  return labels[status] ?? status;
}

/**
 * Returns a human-readable label for a proposal type.
 */
export function formatProposalType(type: ProposalType): string {
  const labels: Record<ProposalType, string> = {
    ResolveIssue: "Resolve Issue",
    TransferFunds: "Transfer Funds",
    AddMember: "Add Member",
    RemoveMember: "Remove Member",
    UpdateThreshold: "Update Threshold",
  };
  return labels[type] ?? type;
}

// ─── Address Formatting ──────────────────────────────────────────────────────

/**
 * Truncates a Stellar public key for display.
 * @example truncateAddress("GABCDEF...XYZ", 4) → "GABCD...RXYZ"
 */
export function truncateAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars + 1)}...${address.slice(-chars)}`;
}

// ─── Amount Formatting ───────────────────────────────────────────────────────

/**
 * Converts a raw on-chain amount (stored as stroops/base units) to a
 * human-readable decimal string.
 * @param raw - Amount in base units (7 decimal places for Stellar tokens)
 * @param symbol - Token symbol appended to the output
 */
export function formatTokenAmount(raw: string | bigint, symbol = "XLM"): string {
  const units = Number(raw) / 1e7;
  return `${units.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 7,
  })} ${symbol}`;
}

// ─── Time Helpers ────────────────────────────────────────────────────────────

/**
 * Returns a human-readable time-remaining string from a Unix timestamp (seconds).
 * Returns "Expired" if the timestamp is in the past.
 */
export function formatTimeRemaining(expiresAt: bigint): string {
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (expiresAt <= now) return "Expired";
  const secondsLeft = Number(expiresAt - now);
  const hours = Math.floor(secondsLeft / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  if (hours > 24) return `${Math.floor(hours / 24)}d remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}

// ─── Proposal Helpers ────────────────────────────────────────────────────────

/**
 * Returns `true` if the proposal is still open for signatures and has not expired.
 */
export function isProposalActive(proposal: Proposal): boolean {
  const now = BigInt(Math.floor(Date.now() / 1000));
  return proposal.status === "Pending" && proposal.expiresAt > now;
}

/**
 * Returns `true` if the proposal's expiry timestamp is in the past.
 */
export function isExpired(proposal: Proposal): boolean {
  const now = BigInt(Math.floor(Date.now() / 1000));
  return proposal.expiresAt <= now;
}

/**
 * Returns the number of additional signatures needed to reach quorum.
 * Returns 0 if already at or past the threshold.
 */
export function signaturesNeeded(proposal: Proposal, threshold: number): number {
  return Math.max(0, threshold - proposal.signatures.length);
}

// ─── RPC Retry ───────────────────────────────────────────────────────────────

/**
 * Retries an async function with exponential backoff on failure.
 * Useful for wrapping Soroban RPC calls that may transiently fail.
 *
 * @param fn        - Async function to retry
 * @param maxRetries - Maximum number of attempts (default: 3)
 * @param baseDelayMs - Initial backoff delay in ms, doubles on each retry (default: 500)
 *
 * @example
 * const board = await withRetry(() => client.getBoard());
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 500
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise((res) => setTimeout(res, baseDelayMs * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError;
}
