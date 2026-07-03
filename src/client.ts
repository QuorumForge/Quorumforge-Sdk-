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

  /**
   * Returns `true` if `address` has already signed the given proposal.
   * Useful for disabling the sign button in UI without fetching the full proposal.
   */
  async hasSignedProposal(proposalId: bigint, address: string): Promise<boolean> {
    const proposal = await this.proposals.getProposal(proposalId);
    return proposal.signatures.includes(address);
  }

  // ─── Treasury ──────────────────────────────────────────────────────────────

  /** Deposit `amount` of a Soroban asset into the governance treasury. */
  async deposit(amount: string, assetContractId: string): Promise<TxResult> {
    return this.proposals.deposit(amount, assetContractId);
  }
}
