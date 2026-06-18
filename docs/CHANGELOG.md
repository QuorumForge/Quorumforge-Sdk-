# Changelog

All notable changes to `quorumforge-sdk` will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- WebSocket subscription support for on-chain proposal events.
- `QuorumForgeClient.watchProposal(id, callback)` for real-time status updates.
- Multi-contract support: manage multiple governance contracts from one client instance.
- CLI companion (`@quorumforge/cli`) wrapping the SDK.

---

## [0.1.0] — 2026-06-18

### Added
- Initial public release.
- `QuorumForgeClient` class — single entry point for all SDK operations.
- **Board operations:** `initializeBoard`, `getBoard`, `isMember`, `getStats`.
- **Proposal lifecycle:** `createProposal`, `signProposal`, `cancelProposal`, `executeProposal`, `expireProposal`.
- **Proposal queries:** `getProposal`, `getProposalsByStatus`, `getProposalsByMember`.
- **Treasury:** `deposit`.
- `ProposalType` union: `ResolveIssue`, `TransferFunds`, `AddMember`, `RemoveMember`, `UpdateThreshold`.
- `ProposalStatus` union: `Pending`, `Executed`, `Expired`, `Cancelled`.
- 8 custom error classes: `NotAMemberError`, `AlreadySignedError`, `ProposalNotFoundError`, `QuorumNotReachedError`, `ProposalExpiredError`, `ProposalAlreadyExecutedError`, `InvalidThresholdError`, `InsufficientTreasuryError`.
- Client-side membership guard on all mutating proposal operations.
- Full TypeScript support: ESM + CJS dual build, `.d.ts` declarations.
- Jest test suite covering board, proposals, and client layers.
- Documentation: `README.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`.
- GitHub Actions integration example.

[Unreleased]: https://github.com/quorumforge/quorumforge-sdk/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/quorumforge/quorumforge-sdk/releases/tag/v0.1.0
