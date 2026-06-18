import {
  Contract,
  SorobanRpc,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  nativeToScVal,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import type {
  BoardConfig,
  BoardStats,
  InitializeBoardParams,
  TxResult,
  Network,
  ClientConfig,
} from "./types.js";
import { InvalidThresholdError } from "./errors.js";

const NETWORK_PASSPHRASE: Record<Network, string> = {
  testnet: Networks.TESTNET,
  mainnet: Networks.PUBLIC,
  futurenet: Networks.FUTURENET,
};

/** Low-level board operations. Used internally by QuorumForgeClient. */
export class BoardModule {
  private readonly server: SorobanRpc.Server;
  private readonly contract: Contract;
  private readonly networkPassphrase: string;
  private readonly config: ClientConfig;

  constructor(config: ClientConfig) {
    this.config = config;
    const rpcUrl = config.sorobanRpcUrl ?? "";
    this.server = new SorobanRpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith("http://") });
    this.contract = new Contract(config.contractId);
    this.networkPassphrase = NETWORK_PASSPHRASE[config.network];
  }

  async initializeBoard(params: InitializeBoardParams): Promise<TxResult> {
    if (!this.config.keypair) throw new Error("keypair required for mutating operations");
    const { members, threshold } = params;

    if (threshold < 1 || threshold > members.length) {
      throw new InvalidThresholdError(threshold, members.length);
    }

    const account = await this.server.getAccount(this.config.keypair.publicKey());
    const membersVal = nativeToScVal(members, { type: "address" });
    const thresholdVal = nativeToScVal(threshold, { type: "u32" });

    const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: this.networkPassphrase })
      .addOperation(this.contract.call("initialize_board", membersVal, thresholdVal))
      .setTimeout(30)
      .build();

    const prepared = await this.server.prepareTransaction(tx);
    prepared.sign(this.config.keypair);
    const result = await this.server.sendTransaction(prepared);
    return { txHash: result.hash };
  }

  async getBoard(): Promise<BoardConfig> {
    const result = await this.server.simulateTransaction(
      new TransactionBuilder(
        await this.server.getAccount(this.config.contractId),
        { fee: BASE_FEE, networkPassphrase: this.networkPassphrase }
      )
        .addOperation(this.contract.call("get_board"))
        .setTimeout(30)
        .build()
    );

    if (SorobanRpc.Api.isSimulationError(result)) {
      throw new Error(`Simulation failed: ${result.error}`);
    }

    const val = (result as SorobanRpc.Api.SimulateTransactionSuccessResponse).result?.retval;
    if (!val) throw new Error("No return value from get_board");
    return scValToNative(val) as BoardConfig;
  }

  async isMember(address: string): Promise<boolean> {
    const board = await this.getBoard();
    return board.members.includes(address);
  }

  async getStats(): Promise<BoardStats> {
    const result = await this.server.simulateTransaction(
      new TransactionBuilder(
        await this.server.getAccount(this.config.contractId),
        { fee: BASE_FEE, networkPassphrase: this.networkPassphrase }
      )
        .addOperation(this.contract.call("get_stats"))
        .setTimeout(30)
        .build()
    );

    if (SorobanRpc.Api.isSimulationError(result)) {
      throw new Error(`Simulation failed: ${result.error}`);
    }

    const val = (result as SorobanRpc.Api.SimulateTransactionSuccessResponse).result?.retval;
    if (!val) throw new Error("No return value from get_stats");
    return scValToNative(val) as BoardStats;
  }
}
