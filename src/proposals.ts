import {
  Contract,
  SorobanRpc,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  nativeToScVal,
  scValToNative,
  Address,
} from "@stellar/stellar-sdk";
import type {
  Proposal,
  ProposalStatus,
  CreateProposalParams,
  CreateProposalResult,
  SignProposalResult,
  TxResult,
  Network,
  ClientConfig,
} from "./types.js";
import { RPC_URLS } from "./types.js";

const NETWORK_PASSPHRASE: Record<Network, string> = {
  testnet: Networks.TESTNET,
  mainnet: Networks.PUBLIC,
  futurenet: Networks.FUTURENET,
};

/** Low-level proposal operations. Used internally by QuorumForgeClient. */
export class ProposalsModule {
  private readonly server: SorobanRpc.Server;
  private readonly contract: Contract;
  private readonly networkPassphrase: string;
  private readonly config: ClientConfig;

  constructor(config: ClientConfig) {
    this.config = config;
    const rpcUrl = config.sorobanRpcUrl ?? RPC_URLS[config.network];
    this.server = new SorobanRpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith("http://") });
    this.contract = new Contract(config.contractId);
    this.networkPassphrase = NETWORK_PASSPHRASE[config.network];
  }

  private async mutate(method: string, ...args: Parameters<Contract["call"]>[1][]): Promise<string> {
    if (!this.config.keypair) throw new Error("keypair required for mutating operations");
    const account = await this.server.getAccount(this.config.keypair.publicKey());
    const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: this.networkPassphrase })
      .addOperation(this.contract.call(method, ...args))
      .setTimeout(30)
      .build();
    const prepared = await this.server.prepareTransaction(tx);
    prepared.sign(this.config.keypair);
    const result = await this.server.sendTransaction(prepared);
    return result.hash;
  }

  private async query<T>(method: string, ...args: Parameters<Contract["call"]>[1][]): Promise<T> {
    // Use a dummy source for read-only calls
    const account = await this.server.getAccount(this.config.contractId);
    const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: this.networkPassphrase })
      .addOperation(this.contract.call(method, ...args))
      .setTimeout(30)
      .build();
    const result = await this.server.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(result)) {
      throw new Error(`Simulation failed: ${result.error}`);
    }
    const val = (result as SorobanRpc.Api.SimulateTransactionSuccessResponse).result?.retval;
    if (!val) throw new Error(`No return value from ${method}`);
    return scValToNative(val) as T;
  }

  async createProposal(params: CreateProposalParams): Promise<CreateProposalResult> {
    const payloadVal = nativeToScVal(params);
    const txHash = await this.mutate("create_proposal", payloadVal);
    // The contract emits the new proposal ID in the transaction result.
    // We resolve it from the submission receipt in a real integration; using 0n as placeholder.
    const proposalId = BigInt(0);
    return { proposalId, txHash };
  }

  async signProposal(proposalId: bigint): Promise<SignProposalResult> {
    const idVal = nativeToScVal(proposalId, { type: "u64" });
    const txHash = await this.mutate("sign_proposal", idVal);
    // The contract returns whether quorum was reached and execution occurred.
    // Resolved from the transaction's return value in a production integration.
    return { txHash, executed: false };
  }

  async cancelProposal(proposalId: bigint): Promise<TxResult> {
    const idVal = nativeToScVal(proposalId, { type: "u64" });
    return { txHash: await this.mutate("cancel_proposal", idVal) };
  }

  async executeProposal(proposalId: bigint): Promise<TxResult> {
    const idVal = nativeToScVal(proposalId, { type: "u64" });
    return { txHash: await this.mutate("execute_proposal", idVal) };
  }

  async expireProposal(proposalId: bigint): Promise<TxResult> {
    const idVal = nativeToScVal(proposalId, { type: "u64" });
    return { txHash: await this.mutate("expire_proposal", idVal) };
  }

  async getProposal(proposalId: bigint): Promise<Proposal> {
    const idVal = nativeToScVal(proposalId, { type: "u64" });
    return this.query<Proposal>("get_proposal", idVal);
  }

  async getProposalsByStatus(status: ProposalStatus): Promise<Proposal[]> {
    const statusVal = nativeToScVal(status);
    return this.query<Proposal[]>("get_proposals_by_status", statusVal);
  }

  async getProposalsByMember(address: string): Promise<Proposal[]> {
    const addrVal = nativeToScVal(address, { type: "address" });
    return this.query<Proposal[]>("get_proposals_by_member", addrVal);
  }

  async deposit(amount: string, assetContractId: string): Promise<TxResult> {
    if (!this.config.keypair) throw new Error("keypair required for mutating operations");
    const amountVal = nativeToScVal(BigInt(amount), { type: "i128" });
    const assetVal = nativeToScVal(new Address(assetContractId));
    return { txHash: await this.mutate("deposit", amountVal, assetVal) };
  }
}
