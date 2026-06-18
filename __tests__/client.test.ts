import { QuorumForgeClient } from "../src/client";
import { BoardModule } from "../src/board";
import { ProposalsModule } from "../src/proposals";
import { NotAMemberError, InvalidThresholdError } from "../src/errors";
import type { BoardConfig, Proposal, BoardStats } from "../src/types";

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock("../src/board");
jest.mock("../src/proposals");

const MockBoardModule = BoardModule as jest.MockedClass<typeof BoardModule>;
const MockProposalsModule = ProposalsModule as jest.MockedClass<typeof ProposalsModule>;

// ─── Fixtures ────────────────────────────────────────────────────────────────

const { Keypair } = jest.requireActual("@stellar/stellar-sdk");
const keypairA = Keypair.random();
const keypairB = Keypair.random();

const boardFixture: BoardConfig = {
  members: [keypairA.publicKey(), keypairB.publicKey()],
  threshold: 2,
  createdAt: BigInt(1000),
};

const proposalFixture: Proposal = {
  proposalId: BigInt(1),
  proposer: keypairA.publicKey(),
  proposalType: "ResolveIssue",
  payload: {
    type: "ResolveIssue",
    issueNumber: 42,
    contributor: keypairB.publicKey(),
    amount: "100",
    assetContractId: "CASSET",
  },
  signatures: [],
  status: "Pending",
  createdAt: BigInt(1000),
  expiresAt: BigInt(9999),
  executedAt: null,
};

const statsFixture: BoardStats = {
  totalProposals: BigInt(3),
  executedProposals: BigInt(1),
  pendingProposals: BigInt(1),
  cancelledProposals: BigInt(0),
  expiredProposals: BigInt(1),
  treasuryBalance: "5000",
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("QuorumForgeClient", () => {
  let client: QuorumForgeClient;
  let boardMock: jest.Mocked<BoardModule>;
  let proposalsMock: jest.Mocked<ProposalsModule>;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new QuorumForgeClient({
      contractId: "CCONTRACT",
      network: "testnet",
      keypair: keypairA,
    });
    boardMock = MockBoardModule.mock.instances[0] as jest.Mocked<BoardModule>;
    proposalsMock = MockProposalsModule.mock.instances[0] as jest.Mocked<ProposalsModule>;
  });

  // ─── Board ──────────────────────────────────────────────────────────────────

  describe("initializeBoard", () => {
    it("delegates to BoardModule", async () => {
      boardMock.initializeBoard.mockResolvedValueOnce({ txHash: "hash_init" });
      const result = await client.initializeBoard({ members: [keypairA.publicKey()], threshold: 1 });
      expect(result.txHash).toBe("hash_init");
      expect(boardMock.initializeBoard).toHaveBeenCalledWith({ members: [keypairA.publicKey()], threshold: 1 });
    });
  });

  describe("getBoard", () => {
    it("returns board config", async () => {
      boardMock.getBoard.mockResolvedValueOnce(boardFixture);
      const result = await client.getBoard();
      expect(result.members).toHaveLength(2);
      expect(result.threshold).toBe(2);
    });
  });

  describe("isMember", () => {
    it("returns true for existing member", async () => {
      boardMock.isMember.mockResolvedValueOnce(true);
      expect(await client.isMember(keypairA.publicKey())).toBe(true);
    });

    it("returns false for non-member", async () => {
      boardMock.isMember.mockResolvedValueOnce(false);
      expect(await client.isMember(Keypair.random().publicKey())).toBe(false);
    });
  });

  // ─── Create Proposal ────────────────────────────────────────────────────────

  describe("createProposal", () => {
    it("succeeds when caller is a member", async () => {
      boardMock.isMember.mockResolvedValueOnce(true);
      proposalsMock.createProposal.mockResolvedValueOnce({ proposalId: BigInt(1), txHash: "hash_create" });
      const result = await client.createProposal({
        type: "ResolveIssue",
        issueNumber: 42,
        contributor: keypairB.publicKey(),
        amount: "100",
        assetContractId: "CASSET",
      });
      expect(result.txHash).toBe("hash_create");
      expect(result.proposalId).toBe(BigInt(1));
    });

    it("throws NotAMemberError when caller is not a member", async () => {
      boardMock.isMember.mockResolvedValueOnce(false);
      await expect(
        client.createProposal({ type: "AddMember", newMember: "GNEW" })
      ).rejects.toThrow(NotAMemberError);
    });
  });

  // ─── Sign Proposal ──────────────────────────────────────────────────────────

  describe("signProposal", () => {
    it("returns txHash and executed=false before quorum", async () => {
      boardMock.isMember.mockResolvedValueOnce(true);
      proposalsMock.signProposal.mockResolvedValueOnce({ txHash: "hash_sign", executed: false });
      const result = await client.signProposal(BigInt(1));
      expect(result.executed).toBe(false);
    });

    it("returns executed=true when quorum is reached", async () => {
      boardMock.isMember.mockResolvedValueOnce(true);
      proposalsMock.signProposal.mockResolvedValueOnce({ txHash: "hash_sign", executed: true });
      const result = await client.signProposal(BigInt(1));
      expect(result.executed).toBe(true);
    });

    it("throws NotAMemberError for non-member signer", async () => {
      boardMock.isMember.mockResolvedValueOnce(false);
      await expect(client.signProposal(BigInt(1))).rejects.toThrow(NotAMemberError);
    });
  });

  // ─── Full 2-of-3 Flow ───────────────────────────────────────────────────────

  describe("2-of-3 governance flow", () => {
    it("auto-executes on second signature in a 2-of-3 board", async () => {
      // Member A creates a proposal
      boardMock.isMember.mockResolvedValueOnce(true);
      proposalsMock.createProposal.mockResolvedValueOnce({ proposalId: BigInt(1), txHash: "hash_create" });
      const { proposalId } = await client.createProposal({ type: "AddMember", newMember: "GNEW" });

      // Member A signs
      boardMock.isMember.mockResolvedValueOnce(true);
      proposalsMock.signProposal.mockResolvedValueOnce({ txHash: "hash_sign_a", executed: false });
      const signA = await client.signProposal(proposalId);
      expect(signA.executed).toBe(false);

      // Member B signs — quorum reached, auto-executes
      boardMock.isMember.mockResolvedValueOnce(true);
      proposalsMock.signProposal.mockResolvedValueOnce({ txHash: "hash_sign_b", executed: true });
      const signB = await client.signProposal(proposalId);
      expect(signB.executed).toBe(true);
      expect(signB.txHash).toBe("hash_sign_b");
    });
  });

  // ─── Cancel / Execute / Expire ──────────────────────────────────────────────

  describe("cancelProposal", () => {
    it("delegates to ProposalsModule", async () => {
      proposalsMock.cancelProposal.mockResolvedValueOnce({ txHash: "hash_cancel" });
      const result = await client.cancelProposal(BigInt(1));
      expect(result.txHash).toBe("hash_cancel");
    });
  });

  describe("executeProposal", () => {
    it("delegates to ProposalsModule", async () => {
      proposalsMock.executeProposal.mockResolvedValueOnce({ txHash: "hash_exec" });
      const result = await client.executeProposal(BigInt(1));
      expect(result.txHash).toBe("hash_exec");
    });
  });

  describe("expireProposal", () => {
    it("delegates to ProposalsModule", async () => {
      proposalsMock.expireProposal.mockResolvedValueOnce({ txHash: "hash_expire" });
      const result = await client.expireProposal(BigInt(1));
      expect(result.txHash).toBe("hash_expire");
    });
  });

  // ─── Queries ────────────────────────────────────────────────────────────────

  describe("getProposal", () => {
    it("returns proposal by id", async () => {
      proposalsMock.getProposal.mockResolvedValueOnce(proposalFixture);
      const result = await client.getProposal(BigInt(1));
      expect(result.proposalId).toBe(BigInt(1));
    });
  });

  describe("getProposalsByStatus", () => {
    it("returns pending proposals", async () => {
      proposalsMock.getProposalsByStatus.mockResolvedValueOnce([proposalFixture]);
      const results = await client.getProposalsByStatus("Pending");
      expect(results).toHaveLength(1);
    });
  });

  describe("getProposalsByMember", () => {
    it("returns proposals for member", async () => {
      proposalsMock.getProposalsByMember.mockResolvedValueOnce([proposalFixture]);
      const results = await client.getProposalsByMember(keypairA.publicKey());
      expect(results).toHaveLength(1);
    });
  });

  describe("getStats", () => {
    it("returns aggregated board stats", async () => {
      boardMock.getStats.mockResolvedValueOnce(statsFixture);
      const stats = await client.getStats();
      expect(stats.totalProposals).toBe(BigInt(3));
      expect(stats.treasuryBalance).toBe("5000");
    });
  });

  // ─── Treasury ────────────────────────────────────────────────────────────────

  describe("deposit", () => {
    it("delegates to ProposalsModule and returns txHash", async () => {
      proposalsMock.deposit.mockResolvedValueOnce({ txHash: "hash_deposit" });
      const result = await client.deposit("1000", "CASSET");
      expect(result.txHash).toBe("hash_deposit");
    });
  });
});
