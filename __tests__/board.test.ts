import { BoardModule } from "../src/board";
import { InvalidThresholdError } from "../src/errors";
import type { ClientConfig, BoardConfig, BoardStats } from "../src/types";

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

const mockSendTransaction = jest.fn().mockResolvedValue({ hash: "tx_board_hash" });
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

const boardFixture: BoardConfig = {
  members: [keypair.publicKey()],
  threshold: 1,
  createdAt: BigInt(42),
};

const statsFixture: BoardStats = {
  totalProposals: BigInt(5),
  executedProposals: BigInt(3),
  pendingProposals: BigInt(1),
  cancelledProposals: BigInt(0),
  expiredProposals: BigInt(1),
  treasuryBalance: "9000",
  totalSignatures: BigInt(4),
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("BoardModule", () => {
  let board: BoardModule;

  beforeEach(() => {
    jest.clearAllMocks();
    _simulateIsError = false;
    _simulateResult = { result: { retval: {} } };
    _nativeResult = null;
    board = new BoardModule(config);
  });

  describe("initializeBoard", () => {
    it("sends transaction and returns txHash", async () => {
      const result = await board.initializeBoard({
        members: [keypair.publicKey(), Keypair.random().publicKey()],
        threshold: 1,
      });
      expect(result.txHash).toBe("tx_board_hash");
      expect(mockSendTransaction).toHaveBeenCalledTimes(1);
    });

    it("throws InvalidThresholdError when threshold > members.length", async () => {
      await expect(
        board.initializeBoard({ members: ["G1", "G2"], threshold: 3 })
      ).rejects.toThrow(InvalidThresholdError);
    });

    it("throws InvalidThresholdError when threshold < 1", async () => {
      await expect(
        board.initializeBoard({ members: ["G1", "G2"], threshold: 0 })
      ).rejects.toThrow(InvalidThresholdError);
    });

    it("accepts threshold equal to members.length (unanimous)", async () => {
      const result = await board.initializeBoard({
        members: [keypair.publicKey()],
        threshold: 1,
      });
      expect(result.txHash).toBe("tx_board_hash");
    });

    it("throws when keypair is absent", async () => {
      const noKeyConfig: ClientConfig = {
        contractId: config.contractId,
        network: config.network,
      };
      const b = new BoardModule(noKeyConfig);
      await expect(
        b.initializeBoard({ members: ["G1"], threshold: 1 })
      ).rejects.toThrow("keypair required");
    });

    it("throws when duplicate members are provided", async () => {
      const addr = keypair.publicKey();
      await expect(
        board.initializeBoard({ members: [addr, addr], threshold: 1 })
      ).rejects.toThrow("Duplicate member");
    });
  });

  describe("getBoard", () => {
    it("returns board config from simulation result", async () => {
      _nativeResult = boardFixture;
      const result = await board.getBoard();
      expect(result).toEqual(boardFixture);
    });

    it("throws when simulation returns error", async () => {
      _simulateIsError = true;
      _simulateResult = { error: "bad sim" };
      await expect(board.getBoard()).rejects.toThrow("Simulation failed");
    });

    it("throws when no retval returned", async () => {
      _simulateResult = { result: null };
      await expect(board.getBoard()).rejects.toThrow("No return value");
    });
  });

  describe("isMember", () => {
    it("returns true when address is in board members", async () => {
      jest.spyOn(board, "getBoard").mockResolvedValueOnce(boardFixture);
      expect(await board.isMember(keypair.publicKey())).toBe(true);
    });

    it("returns false when address is not in board members", async () => {
      jest.spyOn(board, "getBoard").mockResolvedValueOnce(boardFixture);
      expect(await board.isMember(Keypair.random().publicKey())).toBe(false);
    });
  });

  describe("getStats", () => {
    it("returns stats from simulation", async () => {
      _nativeResult = statsFixture;
      const result = await board.getStats();
      expect(result).toEqual(statsFixture);
    });

    it("throws on simulation error", async () => {
      _simulateIsError = true;
      _simulateResult = { error: "network error" };
      await expect(board.getStats()).rejects.toThrow("Simulation failed");
    });
  });

  describe("getMemberCount", () => {
    it("returns numeric member count from simulation", async () => {
      _nativeResult = 3;
      const result = await board.getMemberCount();
      expect(typeof result).toBe("number");
    });
  });
});
