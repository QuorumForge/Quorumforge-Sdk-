import { ProposalsModule } from "../src/proposals";
import type { ClientConfig, Proposal } from "../src/types";

// ─── Shared mock state ───────────────────────────────────────────────────────

let _simulateResult: unknown = null;
let _simulateIsError = false;
let _nativeResult: unknown = null;

const mockGetAccount = jest.fn().mockResolvedValue({
  accountId: () => "GABC",
  sequenceNumber: () => "1",
  incrementSequenceNumber: jest.fn(),
  sequence: "1",
});

const mockPrepareTransaction = jest.fn().mockImplementation((tx) => {
  (tx as { sign: jest.Mock }).sign = jest.fn();
  return Promise.resolve(tx);
});

const mockSendTransaction = jest.fn().mockResolvedValue({ hash: "tx_proposal_hash" });
const mockSimulateTransaction = jest.fn().mockImplementation(() => Promise.resolve(_simulateResult));

jest.mock("@stellar/stellar-sdk", () => {
  const actual = jest.requireActual<typeof import("@stellar/stellar-sdk")>("@stellar/stellar-sdk");
  return {
    ...actual,
    scValToNative: jest.fn().mockImplementation(() => _nativeResult),
    SorobanRpc: {
      ...actual.SorobanRpc,
      Server: jest.fn().mockImplementation(() => ({
        getAccount: mockGetAccount,
        prepareTransaction: mockPrepareTransaction,
        sendTransaction: mockSendTransaction,
        simulateTransaction: mockSimulateTransaction,
      })),
      Api: {
        ...actual.SorobanRpc?.Api,
        isSimulationError: jest.fn().mockImplementation(() => _simulateIsError),
      },
    },
    TransactionBuilder: jest.fn().mockImplementation(() => ({
      addOperation: jest.fn().mockReturnThis(),
      setTimeout: jest.fn().mockReturnThis(),
      build: jest.fn().mockReturnValue({ sign: jest.fn() }),
    })),
    Contract: jest.fn().mockImplementation(() => ({
      call: jest.fn().mockReturnValue({}),
    })),
  };
});

// ─── Fixtures ────────────────────────────────────────────────────────────────

const { Keypair } = jest.requireActual<typeof import("@stellar/stellar-sdk")>("@stellar/stellar-sdk");
const keypair = Keypair.random();

const config: ClientConfig = {
  contractId: "CCONTRACT",
  network: "testnet",
  keypair,
};

const proposalFixture: Proposal = {
  proposalId: BigInt(1),
  proposer: keypair.publicKey(),
  proposalType: "ResolveIssue",
  payload: {
    type: "ResolveIssue",
    issueNumber: 42,
    contributor: Keypair.random().publicKey(),
    amount: "100",
    assetContractId: "CASSET",
  },
  signatures: [keypair.publicKey()],
  status: "Pending",
  createdAt: BigInt(1000),
  expiresAt: BigInt(9999),
  executedAt: null,
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ProposalsModule", () => {
  let proposals: ProposalsModule;

  beforeEach(() => {
    jest.clearAllMocks();
    _simulateIsError = false;
    _simulateResult = { result: { retval: {} } };
    _nativeResult = null;
    proposals = new ProposalsModule(config);
  });

  describe("createProposal", () => {
    it("returns proposalId and txHash on success", async () => {
      const result = await proposals.createProposal({
        type: "ResolveIssue",
        issueNumber: 42,
        contributor: Keypair.random().publicKey(),
        amount: "100",
        assetContractId: "CASSET",
      });
      expect(result.txHash).toBe("tx_proposal_hash");
      expect(typeof result.proposalId).toBe("bigint");
    });

    it("creates TransferFunds proposal", async () => {
      const result = await proposals.createProposal({
        type: "TransferFunds",
        recipient: Keypair.random().publicKey(),
        amount: "500",
        assetContractId: "CASSET",
        memo: "Q2 infra",
      });
      expect(result.txHash).toBe("tx_proposal_hash");
    });

    it("creates AddMember proposal", async () => {
      const result = await proposals.createProposal({
        type: "AddMember",
        newMember: Keypair.random().publicKey(),
      });
      expect(result.txHash).toBe("tx_proposal_hash");
    });

    it("creates RemoveMember proposal", async () => {
      const result = await proposals.createProposal({
        type: "RemoveMember",
        member: Keypair.random().publicKey(),
      });
      expect(result.txHash).toBe("tx_proposal_hash");
    });

    it("creates UpdateThreshold proposal", async () => {
      const result = await proposals.createProposal({
        type: "UpdateThreshold",
        newThreshold: 3,
      });
      expect(result.txHash).toBe("tx_proposal_hash");
    });

    it("throws when keypair is absent", async () => {
      const p = new ProposalsModule({ ...config, keypair: undefined });
      await expect(
        p.createProposal({ type: "AddMember", newMember: "GNEW" })
      ).rejects.toThrow("keypair required");
    });
  });

  describe("signProposal", () => {
    it("returns txHash and executed flag", async () => {
      const result = await proposals.signProposal(BigInt(1));
      expect(result.txHash).toBe("tx_proposal_hash");
      expect(typeof result.executed).toBe("boolean");
    });

    it("throws when keypair is absent", async () => {
      const p = new ProposalsModule({ ...config, keypair: undefined });
      await expect(p.signProposal(BigInt(1))).rejects.toThrow("keypair required");
    });
  });

  describe("cancelProposal", () => {
    it("returns txHash", async () => {
      const result = await proposals.cancelProposal(BigInt(1));
      expect(result.txHash).toBe("tx_proposal_hash");
    });
  });

  describe("executeProposal", () => {
    it("returns txHash", async () => {
      const result = await proposals.executeProposal(BigInt(1));
      expect(result.txHash).toBe("tx_proposal_hash");
    });
  });

  describe("expireProposal", () => {
    it("returns txHash", async () => {
      const result = await proposals.expireProposal(BigInt(1));
      expect(result.txHash).toBe("tx_proposal_hash");
    });
  });

  describe("getProposal", () => {
    it("returns proposal from simulation", async () => {
      _nativeResult = proposalFixture;
      const result = await proposals.getProposal(BigInt(1));
      expect(result).toEqual(proposalFixture);
    });

    it("throws on simulation error", async () => {
      _simulateIsError = true;
      _simulateResult = { error: "not found" };
      await expect(proposals.getProposal(BigInt(999))).rejects.toThrow("Simulation failed");
    });
  });

  describe("getProposalsByStatus", () => {
    it("returns pending proposals", async () => {
      _nativeResult = [proposalFixture];
      const results = await proposals.getProposalsByStatus("Pending");
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe("Pending");
    });

    it("returns empty array when no proposals match", async () => {
      _nativeResult = [];
      const results = await proposals.getProposalsByStatus("Executed");
      expect(results).toEqual([]);
    });
  });

  describe("getProposalsByMember", () => {
    it("returns proposals for a given member", async () => {
      _nativeResult = [proposalFixture];
      const results = await proposals.getProposalsByMember(keypair.publicKey());
      expect(results).toHaveLength(1);
    });
  });

  describe("deposit", () => {
    // A valid Soroban contract address (56-char, starts with C)
    const VALID_ASSET = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";

    it("returns txHash on success", async () => {
      const result = await proposals.deposit("500", VALID_ASSET);
      expect(result.txHash).toBe("tx_proposal_hash");
    });

    it("throws when keypair is absent", async () => {
      const p = new ProposalsModule({ ...config, keypair: undefined });
      await expect(p.deposit("500", VALID_ASSET)).rejects.toThrow("keypair required");
    });
  });
});

  describe("getProposalsByMember — edge cases", () => {
    it("returns empty array when member has no proposals", async () => {
      _nativeResult = [];
      const results = await proposals.getProposalsByMember(Keypair.random().publicKey());
      expect(results).toEqual([]);
    });
  });
