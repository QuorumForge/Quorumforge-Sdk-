'use strict';

var stellarSdk = require('@stellar/stellar-sdk');

// src/board.ts

// src/errors.ts
var QuorumForgeError = class extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
    this.name = this.constructor.name;
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
  }
};
var NotAMemberError = class extends QuorumForgeError {
  constructor(address) {
    super(`Address ${address} is not a board member.`, "NOT_A_MEMBER");
  }
};
var AlreadySignedError = class extends QuorumForgeError {
  constructor(proposalId, address) {
    super(`Member ${address} has already signed proposal #${proposalId}.`, "ALREADY_SIGNED");
  }
};
var ProposalNotFoundError = class extends QuorumForgeError {
  constructor(proposalId) {
    super(`Proposal #${proposalId} not found.`, "PROPOSAL_NOT_FOUND");
  }
};
var QuorumNotReachedError = class extends QuorumForgeError {
  constructor(current, required) {
    super(`Quorum not reached: ${current}/${required} signatures.`, "QUORUM_NOT_REACHED");
  }
};
var ProposalExpiredError = class extends QuorumForgeError {
  constructor(proposalId) {
    super(`Proposal #${proposalId} has expired.`, "PROPOSAL_EXPIRED");
  }
};
var ProposalAlreadyExecutedError = class extends QuorumForgeError {
  constructor(proposalId) {
    super(`Proposal #${proposalId} has already been executed.`, "ALREADY_EXECUTED");
  }
};
var InvalidThresholdError = class extends QuorumForgeError {
  constructor(threshold, memberCount) {
    super(
      `Threshold ${threshold} is invalid for a board of ${memberCount} members. Must be between 1 and ${memberCount}.`,
      "INVALID_THRESHOLD"
    );
  }
};
var InsufficientTreasuryError = class extends QuorumForgeError {
  constructor(required, available) {
    super(
      `Insufficient treasury balance: required ${required}, available ${available}.`,
      "INSUFFICIENT_TREASURY"
    );
  }
};

// src/board.ts
var NETWORK_PASSPHRASE = {
  testnet: stellarSdk.Networks.TESTNET,
  mainnet: stellarSdk.Networks.PUBLIC,
  futurenet: stellarSdk.Networks.FUTURENET
};
var BoardModule = class {
  constructor(config) {
    this.config = config;
    const rpcUrl = config.sorobanRpcUrl ?? "";
    this.server = new stellarSdk.SorobanRpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith("http://") });
    this.contract = new stellarSdk.Contract(config.contractId);
    this.networkPassphrase = NETWORK_PASSPHRASE[config.network];
  }
  async initializeBoard(params) {
    if (!this.config.keypair) throw new Error("keypair required for mutating operations");
    const { members, threshold } = params;
    if (threshold < 1 || threshold > members.length) {
      throw new InvalidThresholdError(threshold, members.length);
    }
    const account = await this.server.getAccount(this.config.keypair.publicKey());
    const membersVal = stellarSdk.nativeToScVal(members, { type: "address" });
    const thresholdVal = stellarSdk.nativeToScVal(threshold, { type: "u32" });
    const tx = new stellarSdk.TransactionBuilder(account, { fee: stellarSdk.BASE_FEE, networkPassphrase: this.networkPassphrase }).addOperation(this.contract.call("initialize_board", membersVal, thresholdVal)).setTimeout(30).build();
    const prepared = await this.server.prepareTransaction(tx);
    prepared.sign(this.config.keypair);
    const result = await this.server.sendTransaction(prepared);
    return { txHash: result.hash };
  }
  async getBoard() {
    const result = await this.server.simulateTransaction(
      new stellarSdk.TransactionBuilder(
        await this.server.getAccount(this.config.contractId),
        { fee: stellarSdk.BASE_FEE, networkPassphrase: this.networkPassphrase }
      ).addOperation(this.contract.call("get_board")).setTimeout(30).build()
    );
    if (stellarSdk.SorobanRpc.Api.isSimulationError(result)) {
      throw new Error(`Simulation failed: ${result.error}`);
    }
    const val = result.result?.retval;
    if (!val) throw new Error("No return value from get_board");
    return stellarSdk.scValToNative(val);
  }
  async isMember(address) {
    const board = await this.getBoard();
    return board.members.includes(address);
  }
  async getStats() {
    const result = await this.server.simulateTransaction(
      new stellarSdk.TransactionBuilder(
        await this.server.getAccount(this.config.contractId),
        { fee: stellarSdk.BASE_FEE, networkPassphrase: this.networkPassphrase }
      ).addOperation(this.contract.call("get_stats")).setTimeout(30).build()
    );
    if (stellarSdk.SorobanRpc.Api.isSimulationError(result)) {
      throw new Error(`Simulation failed: ${result.error}`);
    }
    const val = result.result?.retval;
    if (!val) throw new Error("No return value from get_stats");
    return stellarSdk.scValToNative(val);
  }
};
var NETWORK_PASSPHRASE2 = {
  testnet: stellarSdk.Networks.TESTNET,
  mainnet: stellarSdk.Networks.PUBLIC,
  futurenet: stellarSdk.Networks.FUTURENET
};
var ProposalsModule = class {
  constructor(config) {
    this.config = config;
    const rpcUrl = config.sorobanRpcUrl ?? "";
    this.server = new stellarSdk.SorobanRpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith("http://") });
    this.contract = new stellarSdk.Contract(config.contractId);
    this.networkPassphrase = NETWORK_PASSPHRASE2[config.network];
  }
  async mutate(method, ...args) {
    if (!this.config.keypair) throw new Error("keypair required for mutating operations");
    const account = await this.server.getAccount(this.config.keypair.publicKey());
    const tx = new stellarSdk.TransactionBuilder(account, { fee: stellarSdk.BASE_FEE, networkPassphrase: this.networkPassphrase }).addOperation(this.contract.call(method, ...args)).setTimeout(30).build();
    const prepared = await this.server.prepareTransaction(tx);
    prepared.sign(this.config.keypair);
    const result = await this.server.sendTransaction(prepared);
    return result.hash;
  }
  async query(method, ...args) {
    const account = await this.server.getAccount(this.config.contractId);
    const tx = new stellarSdk.TransactionBuilder(account, { fee: stellarSdk.BASE_FEE, networkPassphrase: this.networkPassphrase }).addOperation(this.contract.call(method, ...args)).setTimeout(30).build();
    const result = await this.server.simulateTransaction(tx);
    if (stellarSdk.SorobanRpc.Api.isSimulationError(result)) {
      throw new Error(`Simulation failed: ${result.error}`);
    }
    const val = result.result?.retval;
    if (!val) throw new Error(`No return value from ${method}`);
    return stellarSdk.scValToNative(val);
  }
  async createProposal(params) {
    const payloadVal = stellarSdk.nativeToScVal(params);
    const txHash = await this.mutate("create_proposal", payloadVal);
    const proposalId = BigInt(0);
    return { proposalId, txHash };
  }
  async signProposal(proposalId) {
    const idVal = stellarSdk.nativeToScVal(proposalId, { type: "u64" });
    const txHash = await this.mutate("sign_proposal", idVal);
    return { txHash, executed: false };
  }
  async cancelProposal(proposalId) {
    const idVal = stellarSdk.nativeToScVal(proposalId, { type: "u64" });
    return { txHash: await this.mutate("cancel_proposal", idVal) };
  }
  async executeProposal(proposalId) {
    const idVal = stellarSdk.nativeToScVal(proposalId, { type: "u64" });
    return { txHash: await this.mutate("execute_proposal", idVal) };
  }
  async expireProposal(proposalId) {
    const idVal = stellarSdk.nativeToScVal(proposalId, { type: "u64" });
    return { txHash: await this.mutate("expire_proposal", idVal) };
  }
  async getProposal(proposalId) {
    const idVal = stellarSdk.nativeToScVal(proposalId, { type: "u64" });
    return this.query("get_proposal", idVal);
  }
  async getProposalsByStatus(status) {
    const statusVal = stellarSdk.nativeToScVal(status);
    return this.query("get_proposals_by_status", statusVal);
  }
  async getProposalsByMember(address) {
    const addrVal = stellarSdk.nativeToScVal(address, { type: "address" });
    return this.query("get_proposals_by_member", addrVal);
  }
  async deposit(amount, assetContractId) {
    if (!this.config.keypair) throw new Error("keypair required for mutating operations");
    const amountVal = stellarSdk.nativeToScVal(BigInt(amount), { type: "i128" });
    const assetVal = stellarSdk.nativeToScVal(new stellarSdk.Address(assetContractId));
    return { txHash: await this.mutate("deposit", amountVal, assetVal) };
  }
};

// src/client.ts
var QuorumForgeClient = class {
  constructor(config) {
    this.config = config;
    this.board = new BoardModule(config);
    this.proposals = new ProposalsModule(config);
  }
  // ─── Board ─────────────────────────────────────────────────────────────────
  /** Initialise a new governance board with the given members and signing threshold. */
  async initializeBoard(params) {
    return this.board.initializeBoard(params);
  }
  /** Fetch the current board configuration (members, threshold, createdAt). */
  async getBoard() {
    return this.board.getBoard();
  }
  /** Returns `true` if `address` is a current board member. */
  async isMember(address) {
    return this.board.isMember(address);
  }
  // ─── Proposals ─────────────────────────────────────────────────────────────
  /**
   * Create a new proposal. The calling keypair must be a board member.
   * @throws {NotAMemberError} if the keypair is not a board member.
   */
  async createProposal(params) {
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
  async signProposal(proposalId) {
    if (this.config.keypair) {
      const member = await this.board.isMember(this.config.keypair.publicKey());
      if (!member) throw new NotAMemberError(this.config.keypair.publicKey());
    }
    return this.proposals.signProposal(proposalId);
  }
  /** Cancel an open proposal. Only the original proposer can cancel. */
  async cancelProposal(proposalId) {
    return this.proposals.cancelProposal(proposalId);
  }
  /** Manually trigger execution of a proposal that has reached quorum. */
  async executeProposal(proposalId) {
    return this.proposals.executeProposal(proposalId);
  }
  /** Mark a proposal as expired after its TTL has elapsed. */
  async expireProposal(proposalId) {
    return this.proposals.expireProposal(proposalId);
  }
  // ─── Queries ───────────────────────────────────────────────────────────────
  /** Fetch a single proposal by ID. */
  async getProposal(proposalId) {
    return this.proposals.getProposal(proposalId);
  }
  /** Fetch all proposals matching a given status. */
  async getProposalsByStatus(status) {
    return this.proposals.getProposalsByStatus(status);
  }
  /** Fetch all proposals created or signed by a member address. */
  async getProposalsByMember(address) {
    return this.proposals.getProposalsByMember(address);
  }
  /** Fetch aggregate board statistics. */
  async getStats() {
    return this.board.getStats();
  }
  // ─── Treasury ──────────────────────────────────────────────────────────────
  /** Deposit `amount` of a Soroban asset into the governance treasury. */
  async deposit(amount, assetContractId) {
    return this.proposals.deposit(amount, assetContractId);
  }
};

// src/types.ts
var RPC_URLS = {
  testnet: "https://soroban-testnet.stellar.org",
  mainnet: "https://soroban-mainnet.stellar.org",
  futurenet: "https://rpc-futurenet.stellar.org"
};

exports.AlreadySignedError = AlreadySignedError;
exports.InsufficientTreasuryError = InsufficientTreasuryError;
exports.InvalidThresholdError = InvalidThresholdError;
exports.NotAMemberError = NotAMemberError;
exports.ProposalAlreadyExecutedError = ProposalAlreadyExecutedError;
exports.ProposalExpiredError = ProposalExpiredError;
exports.ProposalNotFoundError = ProposalNotFoundError;
exports.QuorumForgeClient = QuorumForgeClient;
exports.QuorumForgeError = QuorumForgeError;
exports.QuorumNotReachedError = QuorumNotReachedError;
exports.RPC_URLS = RPC_URLS;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map