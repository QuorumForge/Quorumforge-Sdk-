# Changelog

All notable changes to `quorumforge-sdk` are documented here.
Follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added
- `client.getProposalCount()` — returns the total number of proposals ever created on the board.
- `client.hasSignedProposal(proposalId, address)` — checks whether an address has already signed a proposal without fetching the full proposal object.
- `client.getActiveProposals()` — convenience alias for `getProposalsByStatus("Pending")`.
- `client.watchProposal(proposalId, intervalMs?, timeoutMs?)` — polls a proposal until its status changes from `Pending`, then resolves. Retries on transient RPC errors.
- `board.getProposalCount()` — low-level call to the `get_proposal_count` contract entrypoint.
- `src/utils.ts` (new module, exported from the root):
  - `formatProposalStatus(status)` — emoji-prefixed status label.
  - `formatProposalType(type)` — human-readable type label.
  - `truncateAddress(address, chars?)` — shortens G-addresses for display.
  - `formatTokenAmount(raw, symbol?)` — converts stroops to a decimal string.
  - `formatTimeRemaining(expiresAt)` — human-readable countdown from a Unix timestamp.
  - `isProposalActive(proposal)` — returns `true` if status is Pending and not yet expired.
  - `signaturesNeeded(proposal, threshold)` — remaining signatures until quorum.
  - `withRetry(fn, maxRetries?, baseDelayMs?)` — exponential backoff retry wrapper for RPC calls.
- `errors.ts` additions:
  - `UnauthorizedError` — for permission-related failures.
  - `NetworkError` — for RPC/transport-level errors.
  - `ContractNotInitializedError` — for calls before `initialize` is invoked.
- `Proposal.description` field — mirrors the new on-chain `description` field.
- `CreateProposalParams.description` — required `description` string on all proposal types.
- `CreateProposalParams.ttlSeconds` — optional TTL override.

### Changed
- `CreateProposalParams` is now a discriminated union extended with a `CreateProposalBase` type, sharing `description` and `ttlSeconds` across all variants.

---

## [0.1.0] — 2025-06-01

### Added
- Initial release.
- `QuorumForgeClient` with `initializeBoard`, `createProposal`, `signProposal`, `cancelProposal`, `executeProposal`, `expireProposal`, `deposit`.
- Query methods: `getBoard`, `getProposal`, `getProposalsByStatus`, `getProposalsByMember`, `getStats`, `isMember`.
- `BoardModule` and `ProposalsModule` internal classes.
- Full error class hierarchy: `QuorumForgeError`, `NotAMemberError`, `AlreadySignedError`, `ProposalNotFoundError`, `QuorumNotReachedError`, `ProposalExpiredError`, `ProposalAlreadyExecutedError`, `InvalidThresholdError`, `InsufficientTreasuryError`.
- TypeScript type definitions for all contract types.
- Support for `testnet`, `mainnet`, and `futurenet` networks.

---

## [0.2.0] — Upcoming

### Added

- `validateTtl`, `isValidContractId`, `formatSignatureCount`, `getRpcUrl` utility functions.
- `paginateProposals`, `sortProposalsByDate`, `groupProposalsByType` helpers.
- `formatTimestamp` formats BigInt Unix timestamps as locale date strings.
- `withTimeout` wraps any promise with a configurable rejection deadline.
- `ProposalCancelledError` and `RpcTimeoutError` error classes.
- `PaginatedResult<T>` generic type for paginated responses.
- `totalSignatures` field on `BoardStats`.
- `onPoll` callback on `watchProposal` for real-time UI progress updates.

### Fixed

- Removed duplicate `ProposalNotFoundError` in `errors.ts`.
- `hasSignedProposal` returns `false` instead of throwing for unknown IDs.
- `initializeBoard` enforces `MAX_MEMBERS` cap and rejects duplicate members.
- `withRetry` backoff uses ±20% jitter to reduce thundering-herd risk.

### Changed

- `description` in `CreateProposalParams` is now optional.
- `tsconfig.json` adds `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`.
