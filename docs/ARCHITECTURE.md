# Architecture

This document describes the internal design of `quorumforge-sdk` — how it is structured, why each layer exists, and how the pieces fit together.

---

## Overview

```
Your Application
      │
      ▼
QuorumForgeClient          ← public API, single entry point
  ├── BoardModule           ← board init, composition queries, stats
  └── ProposalsModule       ← proposal lifecycle, treasury
         │
         ▼
  SorobanRpc.Server         ← @stellar/stellar-sdk
         │
         ▼
  QuorumForge Soroban Contract (on-chain)
```

The SDK is intentionally shallow: three public-facing layers, no hidden state, no singletons.

---

## Layer Responsibilities

### `QuorumForgeClient` (`src/client.ts`)

The only class consumers ever import. It:

- Validates pre-conditions (keypair membership) before delegating to modules.
- Owns a single `ClientConfig` used by both sub-modules.
- Is constructed once per contract + network pair and reused across calls.

It performs **no** network I/O itself — all calls are passed through to `BoardModule` or `ProposalsModule`.

### `BoardModule` (`src/board.ts`)

Handles everything related to the governance board's composition and metadata:

| Method | Contract Function |
|--------|------------------|
| `initializeBoard` | `initialize_board` |
| `getBoard` | `get_board` |
| `isMember` | derived from `get_board` |
| `getStats` | `get_stats` |

### `ProposalsModule` (`src/proposals.ts`)

Handles the full proposal lifecycle and treasury:

| Method | Contract Function |
|--------|------------------|
| `createProposal` | `create_proposal` |
| `signProposal` | `sign_proposal` |
| `cancelProposal` | `cancel_proposal` |
| `executeProposal` | `execute_proposal` |
| `expireProposal` | `expire_proposal` |
| `getProposal` | `get_proposal` |
| `getProposalsByStatus` | `get_proposals_by_status` |
| `getProposalsByMember` | `get_proposals_by_member` |
| `deposit` | `deposit` |

### `types.ts`

Single source of truth for all types and enums. No logic — purely structural. Consumers can import types from here for type-checking their own integrations.

### `errors.ts`

All SDK-thrown errors extend `QuorumForgeError`, which itself extends `Error`. Every error carries a `code` string for programmatic error handling without `instanceof` checks:

```ts
try {
  await client.signProposal(id);
} catch (err) {
  if (err instanceof QuorumForgeError) {
    console.error(err.code);
    // Possible codes:
    // "NOT_A_MEMBER" | "ALREADY_SIGNED" | "PROPOSAL_NOT_FOUND"
    // "QUORUM_NOT_REACHED" | "PROPOSAL_EXPIRED" | "ALREADY_EXECUTED"
    // "PROPOSAL_CANCELLED" | "INVALID_THRESHOLD" | "INSUFFICIENT_TREASURY"
    // "UNAUTHORIZED" | "NETWORK_ERROR" | "NOT_INITIALIZED"
    // "DUPLICATE_MEMBER" | "RPC_TIMEOUT"
  }
}
```

---

## Transaction Flow

All mutating operations follow this sequence:

```
1. client.keypair required check
2. BoardModule.isMember guard (for member-only ops)
3. server.getAccount(keypair.publicKey())    ← fetch sequence number
4. TransactionBuilder → addOperation(contract.call(...))
5. server.prepareTransaction(tx)             ← simulate + fee estimation
6. tx.sign(keypair)
7. server.sendTransaction(tx)               → { hash }
```

All read operations skip steps 3–7 and use `server.simulateTransaction` instead, sourced from the contract ID as a dummy account (no fee, no signature).

---

## Network Configuration

| Network | Default RPC |
|---------|-------------|
| `testnet` | `https://soroban-testnet.stellar.org` |
| `mainnet` | `https://soroban-mainnet.stellar.org` |
| `futurenet` | `https://rpc-futurenet.stellar.org` |

Pass `sorobanRpcUrl` in `ClientConfig` to override (useful for local Stellar network with `docker run stellar/quickstart`).

---

## Build Output

tsup produces three artefacts from `src/index.ts`:

| File | Format | Use case |
|------|--------|----------|
| `dist/index.js` | ESM | Node ≥18, bundlers, Deno |
| `dist/index.cjs` | CJS | CommonJS consumers |
| `dist/index.d.ts` | TypeScript declarations | IDE autocomplete, type checking |

Tree-shaking is enabled; importing only `QuorumForgeClient` won't bundle unused error classes.

---

## Design Decisions

**Why two internal modules instead of one?**  
`BoardModule` and `ProposalsModule` mirror the on-chain contract's logical separation. This makes it easier to add a `TreasuryModule` or `GovernanceModule` later without touching the public client surface.

**Why not expose `BoardModule`/`ProposalsModule` publicly?**  
The membership guard in `QuorumForgeClient` must run before any proposal mutation. Exposing the modules directly would let callers bypass that guard. Keeping them internal enforces correct usage.

**Why BigInt for IDs and timestamps?**  
Soroban `u64`/`i128` values exceed JavaScript's safe integer range. BigInt avoids silent precision loss.

**Why no singleton / global state?**  
The SDK is designed to work in multi-tenant bots and GitHub Actions where multiple contract IDs or networks may be active in the same process. Constructing one client per contract is cheap and safe.
