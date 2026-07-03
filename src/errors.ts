export class QuorumForgeError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = this.constructor.name;
    // Maintains proper stack trace in V8
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
  }
}

export class NotAMemberError extends QuorumForgeError {
  constructor(address: string) {
    super(`Address ${address} is not a board member.`, "NOT_A_MEMBER");
  }
}

export class AlreadySignedError extends QuorumForgeError {
  constructor(proposalId: bigint, address: string) {
    super(`Member ${address} has already signed proposal #${proposalId}.`, "ALREADY_SIGNED");
  }
}

export class ProposalNotFoundError extends QuorumForgeError {
  constructor(proposalId: bigint) {
    super(`Proposal #${proposalId} not found.`, "PROPOSAL_NOT_FOUND");
  }
}

export class QuorumNotReachedError extends QuorumForgeError {
  constructor(current: number, required: number) {
    super(`Quorum not reached: ${current}/${required} signatures.`, "QUORUM_NOT_REACHED");
  }
}

export class ProposalExpiredError extends QuorumForgeError {
  constructor(proposalId: bigint) {
    super(`Proposal #${proposalId} has expired.`, "PROPOSAL_EXPIRED");
  }
}

export class ProposalAlreadyExecutedError extends QuorumForgeError {
  constructor(proposalId: bigint) {
    super(`Proposal #${proposalId} has already been executed.`, "ALREADY_EXECUTED");
  }
}

export class InvalidThresholdError extends QuorumForgeError {
  constructor(threshold: number, memberCount: number) {
    super(
      `Threshold ${threshold} is invalid for a board of ${memberCount} members. Must be between 1 and ${memberCount}.`,
      "INVALID_THRESHOLD"
    );
  }
}

export class InsufficientTreasuryError extends QuorumForgeError {
  constructor(required: string, available: string) {
    super(
      `Insufficient treasury balance: required ${required}, available ${available}.`,
      "INSUFFICIENT_TREASURY"
    );
  }
}

export class UnauthorizedError extends QuorumForgeError {
  constructor(action: string) {
    super(`Unauthorized: you do not have permission to ${action}.`, "UNAUTHORIZED");
  }
}

export class NetworkError extends QuorumForgeError {
  constructor(message: string) {
    super(`Network error: ${message}`, "NETWORK_ERROR");
  }
}

export class ContractNotInitializedError extends QuorumForgeError {
  constructor() {
    super("Contract has not been initialized. Call initializeBoard first.", "NOT_INITIALIZED");
  }
}
