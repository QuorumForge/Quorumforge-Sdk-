import { BoardModule } from "./board.js";
import { ProposalsModule } from "./proposals.js";
import type {
  ClientConfig,
  BoardConfig,
  BoardStats,
  InitializeBoardParams,
  CreateProposalParams,
  CreateProposalResult,
  SignProposalResult,
  TxResult,
  Proposal,
  ProposalStatus,
} from "./types.js";
import { NotAMemberError } from "./errors.js";

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
export class QuorumForgeClient {
  private readonly board: BoardModule;
  private readonly proposals: ProposalsModule;
  readonly config: ClientConfig;

  constructor(config: ClientConfig) {
    this.config = config;
    this.board = new BoardModule(config);
    this.proposals = new ProposalsModule(config);
  }

  /**
   * Creates a new `QuorumForgeClient` for read-only usage (no keypair).
   * Suitable for dashboards and indexers that only need to query state.
   */
  static readonly(config: Omit<ClientConfig, "keypair">): QuorumForgeClient {
    return new QuorumForgeClient(config);
  }

  // ─── Board ─────────────────────────────────────────────────────────────────

  /** Initialise a new governance board with the given members and signing threshold. */
  async initializeBoard(params: InitializeBoardParams): Promise<TxResult> {
    return this.board.initializeBoard(params);
  }

  /** Fetch the current board configuration (members, threshold, createdAt). */
  async getBoard(): Promise<BoardConfig> {
    return this.board.getBoard();
  }

  /** Returns `true` if `address` is a current board member. */
  async isMember(address: string): Promise<boolean> {
    return this.board.isMember(address);
  }

  // ─── Proposals ─────────────────────────────────────────────────────────────

  /**
   * Create a new proposal. The calling keypair must be a board member.
   * @throws {NotAMemberError} if the keypair is not a board member.
   */
  async createProposal(params: CreateProposalParams): Promise<CreateProposalResult> {
    if (this.config.keypair) {
      const member = await this.board.isMember(this.config.keypair.publicKey());
      if (!member) throw new NotAMemberError(this.config.keypair.publicKey());
    }
    return this.proposals.createProposal(params);
  }

  /**
   * Sign a proposal. Auto-executes if signing reaches the threshold.
   * @throws {NotAMemberError} if the keypair is not a board member.
   */
  async signProposal(proposalId: bigint): Promise<SignProposalResult> {
    if (this.config.keypair) {
      const member = await this.board.isMember(this.config.keypair.publicKey());
      if (!member) throw new NotAMemberError(this.config.keypair.publicKey());
    }
    return this.proposals.signProposal(proposalId);
  }

  /** Cancel an open proposal. Only the original proposer can cancel. */
  async cancelProposal(proposalId: bigint): Promise<TxResult> {
    return this.proposals.cancelProposal(proposalId);
  }

  /** Manually trigger execution of a proposal that has reached quorum. */
  async executeProposal(proposalId: bigint): Promise<TxResult> {
    return this.proposals.executeProposal(proposalId);
  }

  /** Mark a proposal as expired after its TTL has elapsed. */
  async expireProposal(proposalId: bigint): Promise<TxResult> {
    return this.proposals.expireProposal(proposalId);
  }

  // ─── Queries ───────────────────────────────────────────────────────────────

  /** Fetch a single proposal by ID. */
  async getProposal(proposalId: bigint): Promise<Proposal> {
    return this.proposals.getProposal(proposalId);
  }

  /** Fetch all proposals matching a given status. */
  async getProposalsByStatus(status: ProposalStatus): Promise<Proposal[]> {
    return this.proposals.getProposalsByStatus(status);
  }

  /**
   * Returns all proposals that are currently `Pending` (open for signatures).
   * Equivalent to `getProposalsByStatus("Pending")`.
   */
  async getActiveProposals(): Promise<Proposal[]> {
    return this.proposals.getProposalsByStatus("Pending");
  }

  /** Fetch all proposals created or signed by a member address. */
  async getProposalsByMember(address: string): Promise<Proposal[]> {
    return this.proposals.getProposalsByMember(address);
  }

  /** Fetch aggregate board statistics. */
  async getStats(): Promise<BoardStats> {
    return this.board.getStats();
  }

  /** Returns the total number of proposals ever created on this board. */
  async getProposalCount(): Promise<bigint> {
    return this.board.getProposalCount();
  }

  /** Returns the current number of board members. */
  async getMemberCount(): Promise<number> {
    return this.board.getMemberCount();
  }

  /**
   * Returns `true` if `address` has already signed the given proposal.
   * Useful for disabling the sign button in UI without fetching the full proposal.
   * Returns `false` (instead of throwing) if the proposal does not exist.
   */
  async hasSignedProposal(proposalId: bigint, address: string): Promise<boolean> {
    try {
      const proposal = await this.proposals.getProposal(proposalId);
      return proposal.signatures.includes(address);
    } catch {
      return false;
    }
  }

  // ─── Treasury ──────────────────────────────────────────────────────────────

  /** Deposit `amount` of a Soroban asset into the governance treasury. */
  async deposit(amount: string, assetContractId: string): Promise<TxResult> {
    return this.proposals.deposit(amount, assetContractId);
  }

  // ─── Polling ───────────────────────────────────────────────────────────────

  /**
   * Polls a proposal at a fixed interval until its status changes from `Pending`,
   * then resolves with the final proposal state. Rejects after `timeoutMs`.
   *
   * @param proposalId - ID of the proposal to watch
   * @param intervalMs - Polling interval in milliseconds (default: 5000)
   * @param timeoutMs  - Maximum time to wait before rejecting (default: 300_000 = 5 min)
   *
   * @example
   * const final = await client.watchProposal(1n);
   * console.log(final.status); // "Executed" | "Cancelled" | "Expired"
   */
  /**
   * Polls a proposal at a fixed interval until its status changes from `Pending`,
   * then resolves with the final proposal state. Rejects after `timeoutMs`.
   *
   * @param proposalId   - ID of the proposal to watch
   * @param intervalMs   - Polling interval in milliseconds (default: 5000)
   * @param timeoutMs    - Maximum time to wait before rejecting (default: 300_000 = 5 min)
   * @param onPoll       - Optional callback invoked on each poll with the current proposal
   *
   * @example
   * const final = await client.watchProposal(1n, 3000, 60_000, (p) => {
   *   console.log("signatures so far:", p.signatures.length);
   * });
   */
  async watchProposal(
    proposalId: bigint,
    intervalMs = 5_000,
    timeoutMs = 300_000,
    onPoll?: (proposal: Proposal) => void
  ): Promise<Proposal> {
    const deadline = Date.now() + timeoutMs;
    return new Promise((resolve, reject) => {
      const poll = async () => {
        if (Date.now() >= deadline) {
          reject(new Error(`watchProposal timed out after ${timeoutMs}ms for proposal #${proposalId}`));
          return;
        }
        try {
          const proposal = await this.proposals.getProposal(proposalId);
          onPoll?.(proposal);
          if (proposal.status !== "Pending") {
            resolve(proposal);
          } else {
            setTimeout(poll, intervalMs);
          }
        } catch {
          setTimeout(poll, intervalMs); // retry on transient RPC errors
        }
      };
      poll();
    });
  }
}

