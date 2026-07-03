import type { Keypair } from "@stellar/stellar-sdk";

// ─── Network ────────────────────────────────────────────────────────────────

export type Network = "testnet" | "mainnet" | "futurenet";

export const RPC_URLS: Record<Network, string> = {
  testnet: "https://soroban-testnet.stellar.org",
  mainnet: "https://soroban-mainnet.stellar.org",
  futurenet: "https://rpc-futurenet.stellar.org",
};

// ─── Client Config ───────────────────────────────────────────────────────────

export interface ClientConfig {
  contractId: string;
  network: Network;
  /** Overrides the default RPC URL for the chosen network. */
  sorobanRpcUrl?: string;
  /** Required for any mutating operation. */
  keypair?: Keypair;
}

// ─── Board ───────────────────────────────────────────────────────────────────

export interface BoardConfig {
  members: string[];
  threshold: number;
  createdAt: bigint;
}

export interface InitializeBoardParams {
  members: string[];
  threshold: number;
}

export interface BoardStats {
  totalProposals: bigint;
  executedProposals: bigint;
  pendingProposals: bigint;
  cancelledProposals: bigint;
  expiredProposals: bigint;
  treasuryBalance: string;
}

// ─── Proposals ───────────────────────────────────────────────────────────────

export type ProposalType =
  | "ResolveIssue"
  | "TransferFunds"
  | "AddMember"
  | "RemoveMember"
  | "UpdateThreshold";

export type ProposalStatus = "Pending" | "Executed" | "Expired" | "Cancelled";

export type ProposalPayload =
  | { type: "ResolveIssue"; issueNumber: number; contributor: string; amount: string; assetContractId: string }
  | { type: "TransferFunds"; recipient: string; amount: string; assetContractId: string; memo: string }
  | { type: "AddMember"; newMember: string }
  | { type: "RemoveMember"; member: string }
  | { type: "UpdateThreshold"; newThreshold: number };

export interface Proposal {
  proposalId: bigint;
  proposer: string;
  proposalType: ProposalType;
  payload: ProposalPayload;
  signatures: string[];
  status: ProposalStatus;
  createdAt: bigint;
  expiresAt: bigint;
  executedAt: bigint | null;
  /** Human-readable description stored on-chain alongside the typed payload. */
  description: string;
}

// ─── Operation Params ────────────────────────────────────────────────────────

/**
 * Parameters shared by all proposal types.
 * `description` is stored on-chain and displayed to signers.
 */
type CreateProposalBase = {
  description: string;
  ttlSeconds?: number;
};

export type CreateProposalParams = CreateProposalBase &
  (
    | { type: "ResolveIssue"; issueNumber: number; contributor: string; amount: string; assetContractId: string }
    | { type: "TransferFunds"; recipient: string; amount: string; assetContractId: string; memo: string }
    | { type: "AddMember"; newMember: string }
    | { type: "RemoveMember"; member: string }
    | { type: "UpdateThreshold"; newThreshold: number }
  );

// ─── Results ─────────────────────────────────────────────────────────────────

export interface TxResult {
  txHash: string;
}

export interface CreateProposalResult {
  proposalId: bigint;
  txHash: string;
}

export interface SignProposalResult {
  txHash: string;
  executed: boolean;
}
