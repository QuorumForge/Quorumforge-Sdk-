# quorumforge-sdk

[![npm version](https://img.shields.io/npm/v/quorumforge-sdk.svg)](https://www.npmjs.com/package/quorumforge-sdk)
[![npm downloads](https://img.shields.io/npm/dm/quorumforge-sdk.svg)](https://www.npmjs.com/package/quorumforge-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Build](https://github.com/quorumforge/quorumforge-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/quorumforge/quorumforge-sdk/actions)

A TypeScript SDK for the **QuorumForge** multi-sig governance system on [Soroban](https://soroban.stellar.org). Abstracts all smart contract interaction so any project can embed **N-of-M maintainer governance** into GitHub Actions, bots, CLIs, or custom dashboards — in minutes, not days.

---

## What is QuorumForge?

QuorumForge is an on-chain governance primitive built on Stellar's Soroban smart contract platform. It lets a group of N maintainers govern shared resources — issue bounties, treasury transfers, membership changes — through a transparent, auditable, N-of-M multi-signature proposal system.

This SDK is the developer-facing layer that abstracts the Soroban contract into clean TypeScript method calls.

---

## Live Testnet Reference

| | |
|---|---|
| **Contract ID** | `CANU3HVHBFRT2CSZ73ZVDYKYNZMRP6J65KGO4QOTVA45AKORFA46UQ3V` |
| **Network** | `testnet` |
| **RPC** | `https://soroban-testnet.stellar.org` |
| **Live demo UI** | [quorumforge-app.vercel.app](https://quorumforge-app.vercel.app/board/CANU3HVHBFRT2CSZ73ZVDYKYNZMRP6J65KGO4QOTVA45AKORFA46UQ3V) |
| **Explorer** | [stellar.expert](https://stellar.expert/explorer/testnet/contract/CANU3HVHBFRT2CSZ73ZVDYKYNZMRP6J65KGO4QOTVA45AKORFA46UQ3V) |

```ts
const client = new QuorumForgeClient({
  contractId: "CANU3HVHBFRT2CSZ73ZVDYKYNZMRP6J65KGO4QOTVA45AKORFA46UQ3V",
  network: "testnet",
});
const board = await client.getBoard();
```

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Complete 2-of-3 Governance Flow](#complete-2-of-3-governance-flow)
- [API Reference](#api-reference)
  - [QuorumForgeClient](#quorumforgeclient)
  - [Board Methods](#board-methods)
  - [Proposal Methods](#proposal-methods)
  - [Query Methods](#query-methods)
  - [Treasury Methods](#treasury-methods)
- [Types](#types)
- [Error Handling](#error-handling)
- [GitHub Actions Integration](#github-actions-integration)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [Security](#security)
- [Changelog](#changelog)
- [License](#license)

---

## Features

- ✅ Full TypeScript — strict types, IDE autocomplete, `.d.ts` declarations
- ✅ ESM + CJS dual build (Node ≥ 18, bundlers, Deno)
- ✅ N-of-M multi-sig proposal lifecycle: create → sign → auto-execute
- ✅ Five proposal types: `ResolveIssue`, `TransferFunds`, `AddMember`, `RemoveMember`, `UpdateThreshold`
- ✅ Typed, descriptive error classes — catch by type or by `.code` string
- ✅ Client-side membership guard — fails fast before hitting the network
- ✅ Supports `testnet`, `mainnet`, and `futurenet`
- ✅ Custom RPC URL override (for local Stellar `quickstart` node)
- ✅ Zero configuration — sensible defaults for every network

---

## Installation

```bash
npm install quorumforge-sdk
# or
yarn add quorumforge-sdk
# or
pnpm add quorumforge-sdk
```

**Peer dependency:** `@stellar/stellar-sdk` is a direct dependency — no extra install needed.

---

## Quick Start

```ts
import { QuorumForgeClient } from "quorumforge-sdk";
import { Keypair } from "@stellar/stellar-sdk";

const client = new QuorumForgeClient({
  contractId: "CCONTRACT_ID_HERE",
  network: "testnet",
  keypair: Keypair.fromSecret(process.env.QUORUMFORGE_SECRET!),
});

// Fetch current board state (no keypair needed for reads)
const board = await client.getBoard();
console.log("Members:", board.members);
console.log("Threshold:", board.threshold);

// Check if an address is a member
const isMember = await client.isMember("GADDRESS...");
```

---

## Complete 2-of-3 Governance Flow

This example walks through the full lifecycle of an issue bounty proposal with a 3-member board requiring 2 signatures.

```ts
import { QuorumForgeClient, NotAMemberError, ProposalExpiredError } from "quorumforge-sdk";
import { Keypair } from "@stellar/stellar-sdk";

const CONTRACT_ID = "CCONTRACT_ID_HERE";
const ASSET_CONTRACT = "CASSET_CONTRACT_ID_HERE";

// Three board members
const memberA = Keypair.fromSecret(process.env.MEMBER_A_SECRET!);
const memberB = Keypair.fromSecret(process.env.MEMBER_B_SECRET!);
const memberC = Keypair.fromSecret(process.env.MEMBER_C_SECRET!);

// ── Step 1: Initialize the board (run once) ───────────────────────────────────

const admin = new QuorumForgeClient({ contractId: CONTRACT_ID, network: "testnet", keypair: memberA });

const { txHash: initHash } = await admin.initializeBoard({
  members: [memberA.publicKey(), memberB.publicKey(), memberC.publicKey()],
  threshold: 2, // 2-of-3
});
console.log("Board initialized:", initHash);

// ── Step 2: Member A creates a proposal to resolve GitHub issue #42 ───────────

const clientA = new QuorumForgeClient({ contractId: CONTRACT_ID, network: "testnet", keypair: memberA });

const { proposalId, txHash: createHash } = await clientA.createProposal({
  type: "ResolveIssue",
  issueNumber: 42,
  contributor: "GCONTRIBUTOR_ADDRESS",
  amount: "1000000000", // 100 XLM in stroops
  assetContractId: ASSET_CONTRACT,
});
console.log(`Proposal #${proposalId} created:`, createHash);

// ── Step 3: Member A signs (1/2 — quorum not yet reached) ────────────────────

const signA = await clientA.signProposal(proposalId);
console.log("Signed by A, executed:", signA.executed); // false

// ── Step 4: Member B signs (2/2 — quorum reached, auto-executes) ─────────────

const clientB = new QuorumForgeClient({ contractId: CONTRACT_ID, network: "testnet", keypair: memberB });

const signB = await clientB.signProposal(proposalId);
console.log("Signed by B, executed:", signB.executed); // true ✅
console.log("Execution tx:", signB.txHash);

// ── Step 5: Verify final state ────────────────────────────────────────────────

const proposal = await clientA.getProposal(proposalId);
console.log("Status:", proposal.status);       // "Executed"
console.log("Signatures:", proposal.signatures); // [memberA.publicKey(), memberB.publicKey()]

const stats = await clientA.getStats();
console.log("Total proposals:", stats.totalProposals);
console.log("Executed:", stats.executedProposals);
```

---

## API Reference

### QuorumForgeClient

```ts
new QuorumForgeClient(config: ClientConfig)
```

| Config field | Type | Required | Description |
|---|---|---|---|
| `contractId` | `string` | ✅ | Deployed QuorumForge contract ID |
| `network` | `"testnet" \| "mainnet" \| "futurenet"` | ✅ | Target network |
| `sorobanRpcUrl` | `string` | ❌ | Override default RPC URL |
| `keypair` | `Keypair` | ❌ | Required for all mutating operations |

---

### Board Methods

#### `initializeBoard(params)`

Sets up a new governance board. Run once per contract deployment.

```ts
await client.initializeBoard({
  members: ["GADDR1", "GADDR2", "GADDR3"],
  threshold: 2,
});
// Returns: { txHash: string }
```

Throws `InvalidThresholdError` if `threshold < 1` or `threshold > members.length`.

---

#### `getBoard()`

Fetches the current board configuration.

```ts
const board = await client.getBoard();
// Returns: { members: string[], threshold: number, createdAt: bigint }
```

---

#### `isMember(address)`

Returns `true` if the given address is a current board member.

```ts
await client.isMember("GADDR1"); // true | false
```

---

#### `getStats()`

Returns aggregate proposal statistics and treasury balance.

```ts
const stats = await client.getStats();
// Returns: BoardStats
```

---

### Proposal Methods

#### `createProposal(params)`

Creates a new governance proposal. The calling keypair must be a board member.

```ts
// Resolve a GitHub issue (pay a contributor)
const { proposalId, txHash } = await client.createProposal({
  type: "ResolveIssue",
  issueNumber: 42,
  contributor: "GCONTRIB",
  amount: "1000000000",
  assetContractId: "CASSET",
});

// Transfer funds from treasury
await client.createProposal({
  type: "TransferFunds",
  recipient: "GRECIPIENT",
  amount: "500000000",
  assetContractId: "CASSET",
  memo: "Q2 infrastructure costs",
});

// Add a new board member
await client.createProposal({ type: "AddMember", newMember: "GNEWMEMBER" });

// Remove a board member
await client.createProposal({ type: "RemoveMember", member: "GADDR" });

// Update the signing threshold
await client.createProposal({ type: "UpdateThreshold", newThreshold: 3 });
```

Returns `{ proposalId: bigint, txHash: string }`.  
Throws `NotAMemberError` if keypair is not a board member.

---

#### `signProposal(proposalId)`

Signs an open proposal. Auto-executes when the threshold is reached.

```ts
const { txHash, executed } = await client.signProposal(proposalId);
if (executed) {
  console.log("Proposal auto-executed on this signature!");
}
```

Throws `NotAMemberError` if keypair is not a board member.

---

#### `cancelProposal(proposalId)`

Cancels an open proposal. Only the original proposer can cancel.

```ts
await client.cancelProposal(proposalId);
```

---

#### `executeProposal(proposalId)`

Manually triggers execution of a proposal that has already reached quorum.

```ts
await client.executeProposal(proposalId);
```

---

#### `expireProposal(proposalId)`

Marks an expired proposal (past its TTL) as `Expired` on-chain.

```ts
await client.expireProposal(proposalId);
```

---

### Query Methods

#### `getProposal(proposalId)`

```ts
const proposal = await client.getProposal(BigInt(1));
// Returns: Proposal
```

#### `getProposalsByStatus(status)`

```ts
const pending = await client.getProposalsByStatus("Pending");
const executed = await client.getProposalsByStatus("Executed");
```

#### `getProposalsByMember(address)`

```ts
const mine = await client.getProposalsByMember("GADDR");
```

---

### Treasury Methods

#### `deposit(amount, assetContractId)`

Deposits a Soroban asset into the governance treasury.

```ts
await client.deposit("5000000000", "CASSET_CONTRACT");
```

---

## Types

All types are exported from the package root:

```ts
import type {
  ClientConfig,
  BoardConfig,
  BoardStats,
  Proposal,
  ProposalPayload,
  ProposalType,
  ProposalStatus,
  InitializeBoardParams,
  CreateProposalParams,
  CreateProposalResult,
  SignProposalResult,
  TxResult,
  Network,
} from "quorumforge-sdk";
```

### `ProposalType`

```ts
type ProposalType =
  | "ResolveIssue"
  | "TransferFunds"
  | "AddMember"
  | "RemoveMember"
  | "UpdateThreshold"
```

### `ProposalStatus`

```ts
type ProposalStatus = "Pending" | "Executed" | "Expired" | "Cancelled"
```

### `Proposal`

```ts
interface Proposal {
  proposalId: bigint
  proposer: string
  proposalType: ProposalType
  payload: ProposalPayload
  signatures: string[]
  status: ProposalStatus
  createdAt: bigint
  expiresAt: bigint
  executedAt: bigint | null
}
```

---

## Error Handling

All SDK errors extend `QuorumForgeError` which carries a `code` string for programmatic handling.

```ts
import {
  QuorumForgeError,
  NotAMemberError,
  AlreadySignedError,
  ProposalNotFoundError,
  QuorumNotReachedError,
  ProposalExpiredError,
  ProposalAlreadyExecutedError,
  InvalidThresholdError,
  InsufficientTreasuryError,
} from "quorumforge-sdk";

try {
  await client.signProposal(proposalId);
} catch (err) {
  if (err instanceof NotAMemberError) {
    console.error("Your keypair is not a board member.");
  } else if (err instanceof AlreadySignedError) {
    console.error("You have already signed this proposal.");
  } else if (err instanceof QuorumForgeError) {
    // Catch-all for any SDK error
    console.error(err.code, err.message);
  } else {
    throw err; // re-throw non-SDK errors
  }
}
```

| Error class | `.code` | When thrown |
|---|---|---|
| `NotAMemberError` | `NOT_A_MEMBER` | Keypair is not a board member |
| `AlreadySignedError` | `ALREADY_SIGNED` | Member has already signed this proposal |
| `ProposalNotFoundError` | `PROPOSAL_NOT_FOUND` | Proposal ID does not exist |
| `QuorumNotReachedError` | `QUORUM_NOT_REACHED` | Manual execute called before quorum |
| `ProposalExpiredError` | `PROPOSAL_EXPIRED` | Proposal TTL has elapsed |
| `ProposalAlreadyExecutedError` | `ALREADY_EXECUTED` | Proposal was already executed |
| `InvalidThresholdError` | `INVALID_THRESHOLD` | Threshold out of range for member count |
| `InsufficientTreasuryError` | `INSUFFICIENT_TREASURY` | Treasury balance too low for transfer |

---

## GitHub Actions Integration

Automatically create a `ResolveIssue` proposal whenever a GitHub issue is closed and labelled `bounty`.

### Workflow file

```yaml
# .github/workflows/quorumforge-bounty.yml
name: QuorumForge — Create Bounty Proposal

on:
  issues:
    types: [closed]

jobs:
  create-proposal:
    if: contains(github.event.issue.labels.*.name, 'bounty')
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - run: npm ci

      - name: Create ResolveIssue proposal
        env:
          QUORUMFORGE_SECRET: ${{ secrets.QUORUMFORGE_SECRET }}
          CONTRACT_ID: ${{ secrets.QUORUMFORGE_CONTRACT_ID }}
          ASSET_CONTRACT: ${{ secrets.QUORUMFORGE_ASSET_CONTRACT }}
          CONTRIBUTOR: ${{ github.event.issue.user.login }}
          ISSUE_NUMBER: ${{ github.event.issue.number }}
        run: node scripts/create-bounty-proposal.mjs
```

### Script (`scripts/create-bounty-proposal.mjs`)

```js
import { QuorumForgeClient } from "quorumforge-sdk";
import { Keypair } from "@stellar/stellar-sdk";

// Map GitHub username to Stellar address — store in your own registry
const CONTRIBUTOR_REGISTRY = {
  "alice": "GADDRALICE...",
  "bob":   "GADDRBOBBBB...",
};

const contributor = CONTRIBUTOR_REGISTRY[process.env.CONTRIBUTOR];
if (!contributor) {
  console.log(`No Stellar address for ${process.env.CONTRIBUTOR} — skipping.`);
  process.exit(0);
}

const client = new QuorumForgeClient({
  contractId: process.env.CONTRACT_ID,
  network: "mainnet",
  keypair: Keypair.fromSecret(process.env.QUORUMFORGE_SECRET),
});

const { proposalId, txHash } = await client.createProposal({
  type: "ResolveIssue",
  issueNumber: Number(process.env.ISSUE_NUMBER),
  contributor,
  amount: "1000000000", // 100 XLM — adjust per-issue or read from issue label
  assetContractId: process.env.ASSET_CONTRACT,
});

console.log(`✅ Proposal #${proposalId} created for issue #${process.env.ISSUE_NUMBER}`);
console.log(`   Tx hash: ${txHash}`);
console.log(`   Awaiting ${await client.getBoard().then(b => b.threshold)} signatures.`);
```

### Required GitHub Secrets

| Secret | Description |
|---|---|
| `QUORUMFORGE_SECRET` | Secret key for the bot's Stellar keypair (must be a board member) |
| `QUORUMFORGE_CONTRACT_ID` | Deployed QuorumForge contract ID |
| `QUORUMFORGE_ASSET_CONTRACT` | Soroban asset contract ID for the bounty token |

> **Tip:** The bot's keypair only needs to be a member for `createProposal`. You can use a dedicated bot member separate from the human signers so the bot can create proposals but human approval is still required for execution.

---

## Configuration

### Networks and RPC URLs

| Network | Default RPC |
|---|---|
| `testnet` | `https://soroban-testnet.stellar.org` |
| `mainnet` | `https://soroban-mainnet.stellar.org` |
| `futurenet` | `https://rpc-futurenet.stellar.org` |

Override for local development:

```ts
const client = new QuorumForgeClient({
  contractId: "C...",
  network: "testnet",
  sorobanRpcUrl: "http://localhost:8000/soroban/rpc", // stellar/quickstart
});
```

### Read-Only Client

Omit `keypair` for a read-only client (queries only):

```ts
const readOnly = new QuorumForgeClient({
  contractId: "C...",
  network: "mainnet",
  // no keypair — safe to use in frontend/public dashboards
});

const proposals = await readOnly.getProposalsByStatus("Pending");
```

---

## Project Structure

```
quorumforge-sdk/
├── src/
│   ├── index.ts          — public barrel export
│   ├── client.ts         — QuorumForgeClient (public API)
│   ├── board.ts          — BoardModule (internal)
│   ├── proposals.ts      — ProposalsModule (internal)
│   ├── types.ts          — all types and enums
│   └── errors.ts         — custom error classes
├── __tests__/
│   ├── client.test.ts
│   ├── board.test.ts
│   └── proposals.test.ts
├── docs/
│   ├── ARCHITECTURE.md   — internal design and layer responsibilities
│   ├── CONTRIBUTING.md   — how to contribute
│   ├── SECURITY.md       — vulnerability reporting and keypair guidance
│   └── CHANGELOG.md      — version history
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── README.md
```

---

## Documentation

| Document | Description |
|---|---|
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Internal design, layer responsibilities, transaction flow, build output |
| [CONTRIBUTING.md](./docs/CONTRIBUTING.md) | Development setup, commit conventions, PR process, testing guidelines |
| [SECURITY.md](./docs/SECURITY.md) | Vulnerability reporting, keypair handling best practices |
| [CHANGELOG.md](./docs/CHANGELOG.md) | Version history and planned features |

---

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](./docs/CONTRIBUTING.md) before opening a pull request.

```bash
git clone https://github.com/quorumforge/quorumforge-sdk.git
cd quorumforge-sdk
npm install
npm test
```

---

## Security

Please read [SECURITY.md](./docs/SECURITY.md) for the vulnerability reporting policy and keypair security guidance.

**Never commit your Stellar secret key.** Use GitHub Secrets, environment variables, or a secrets manager.

---

## Changelog

See [CHANGELOG.md](./docs/CHANGELOG.md) for the full version history.

---

## License

[MIT](LICENSE) © QuorumForge Contributors
