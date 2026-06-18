import { Keypair } from '@stellar/stellar-sdk';

type Network = "testnet" | "mainnet" | "futurenet";
declare const RPC_URLS: Record<Network, string>;
interface ClientConfig {
    contractId: string;
    network: Network;
    /** Overrides the default RPC URL for the chosen network. */
    sorobanRpcUrl?: string;
    /** Required for any mutating operation. */
    keypair?: Keypair;
}
interface BoardConfig {
    members: string[];
    threshold: number;
    createdAt: bigint;
}
interface InitializeBoardParams {
    members: string[];
    threshold: number;
}
interface BoardStats {
    totalProposals: bigint;
    executedProposals: bigint;
    pendingProposals: bigint;
    cancelledProposals: bigint;
    expiredProposals: bigint;
    treasuryBalance: string;
}
type ProposalType = "ResolveIssue" | "TransferFunds" | "AddMember" | "RemoveMember" | "UpdateThreshold";
type ProposalStatus = "Pending" | "Executed" | "Expired" | "Cancelled";
type ProposalPayload = {
    type: "ResolveIssue";
    issueNumber: number;
    contributor: string;
    amount: string;
    assetContractId: string;
} | {
    type: "TransferFunds";
    recipient: string;
    amount: string;
    assetContractId: string;
    memo: string;
} | {
    type: "AddMember";
    newMember: string;
} | {
    type: "RemoveMember";
    member: string;
} | {
    type: "UpdateThreshold";
    newThreshold: number;
};
interface Proposal {
    proposalId: bigint;
    proposer: string;
    proposalType: ProposalType;
    payload: ProposalPayload;
    signatures: string[];
    status: ProposalStatus;
    createdAt: bigint;
    expiresAt: bigint;
    executedAt: bigint | null;
}
type CreateProposalParams = {
    type: "ResolveIssue";
    issueNumber: number;
    contributor: string;
    amount: string;
    assetContractId: string;
} | {
    type: "TransferFunds";
    recipient: string;
    amount: string;
    assetContractId: string;
    memo: string;
} | {
    type: "AddMember";
    newMember: string;
} | {
    type: "RemoveMember";
    member: string;
} | {
    type: "UpdateThreshold";
    newThreshold: number;
};
interface TxResult {
    txHash: string;
}
interface CreateProposalResult {
    proposalId: bigint;
    txHash: string;
}
interface SignProposalResult {
    txHash: string;
    executed: boolean;
}

/**
 * QuorumForgeClient — the primary entry point for all SDK operations.
 *
 * @example
 * ```ts
 * import { QuorumForgeClient } from "quorumforge-sdk";
 * import { Keypair } from "@stellar/stellar-sdk";
 *
 * const client = new QuorumForgeClient({
 *   contractId: "C...",
 *   network: "testnet",
 *   keypair: Keypair.fromSecret("S..."),
 * });
 *
 * await client.initializeBoard({ members: [a, b, c], threshold: 2 });
 * const { proposalId } = await client.createProposal({ type: "ResolveIssue", ... });
 * await client.signProposal(proposalId); // member 1
 * await client.signProposal(proposalId); // member 2 — auto-executes at quorum
 * ```
 */
declare class QuorumForgeClient {
    private readonly board;
    private readonly proposals;
    readonly config: ClientConfig;
    constructor(config: ClientConfig);
    /** Initialise a new governance board with the given members and signing threshold. */
    initializeBoard(params: InitializeBoardParams): Promise<TxResult>;
    /** Fetch the current board configuration (members, threshold, createdAt). */
    getBoard(): Promise<BoardConfig>;
    /** Returns `true` if `address` is a current board member. */
    isMember(address: string): Promise<boolean>;
    /**
     * Create a new proposal. The calling keypair must be a board member.
     * @throws {NotAMemberError} if the keypair is not a board member.
     */
    createProposal(params: CreateProposalParams): Promise<CreateProposalResult>;
    /**
     * Sign a proposal. Auto-executes if signing reaches the threshold.
     * @throws {NotAMemberError} if the keypair is not a board member.
     */
    signProposal(proposalId: bigint): Promise<SignProposalResult>;
    /** Cancel an open proposal. Only the original proposer can cancel. */
    cancelProposal(proposalId: bigint): Promise<TxResult>;
    /** Manually trigger execution of a proposal that has reached quorum. */
    executeProposal(proposalId: bigint): Promise<TxResult>;
    /** Mark a proposal as expired after its TTL has elapsed. */
    expireProposal(proposalId: bigint): Promise<TxResult>;
    /** Fetch a single proposal by ID. */
    getProposal(proposalId: bigint): Promise<Proposal>;
    /** Fetch all proposals matching a given status. */
    getProposalsByStatus(status: ProposalStatus): Promise<Proposal[]>;
    /** Fetch all proposals created or signed by a member address. */
    getProposalsByMember(address: string): Promise<Proposal[]>;
    /** Fetch aggregate board statistics. */
    getStats(): Promise<BoardStats>;
    /** Deposit `amount` of a Soroban asset into the governance treasury. */
    deposit(amount: string, assetContractId: string): Promise<TxResult>;
}

declare class QuorumForgeError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
declare class NotAMemberError extends QuorumForgeError {
    constructor(address: string);
}
declare class AlreadySignedError extends QuorumForgeError {
    constructor(proposalId: bigint, address: string);
}
declare class ProposalNotFoundError extends QuorumForgeError {
    constructor(proposalId: bigint);
}
declare class QuorumNotReachedError extends QuorumForgeError {
    constructor(current: number, required: number);
}
declare class ProposalExpiredError extends QuorumForgeError {
    constructor(proposalId: bigint);
}
declare class ProposalAlreadyExecutedError extends QuorumForgeError {
    constructor(proposalId: bigint);
}
declare class InvalidThresholdError extends QuorumForgeError {
    constructor(threshold: number, memberCount: number);
}
declare class InsufficientTreasuryError extends QuorumForgeError {
    constructor(required: string, available: string);
}

export { AlreadySignedError, type BoardConfig, type BoardStats, type ClientConfig, type CreateProposalParams, type CreateProposalResult, type InitializeBoardParams, InsufficientTreasuryError, InvalidThresholdError, type Network, NotAMemberError, type Proposal, ProposalAlreadyExecutedError, ProposalExpiredError, ProposalNotFoundError, type ProposalPayload, type ProposalStatus, type ProposalType, QuorumForgeClient, QuorumForgeError, QuorumNotReachedError, RPC_URLS, type SignProposalResult, type TxResult };
