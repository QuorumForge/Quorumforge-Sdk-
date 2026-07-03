# Quickstart — QuorumForge SDK

This guide shows how to install the SDK, connect to a deployed contract, and perform the most common governance operations in under 5 minutes.

---

## Installation

```bash
npm install quorumforge-sdk
# or
yarn add quorumforge-sdk
```

---

## 1. Create a Client

```ts
import { QuorumForgeClient } from "quorumforge-sdk";
import { Keypair } from "@stellar/stellar-sdk";

const keypair = Keypair.fromSecret("SXXXXX...");

const client = new QuorumForgeClient({
  contractId: "CXXXXXX...",          // deployed contract ID
  network: "testnet",                // "testnet" | "mainnet" | "futurenet"
  keypair,                           // required for mutating operations
});
```

For read-only usage (queries only), omit `keypair`:

```ts
const client = new QuorumForgeClient({
  contractId: "CXXXXXX...",
  network: "testnet",
});
```

---

## 2. Initialize a Board (one-time)

```ts
await client.initializeBoard({
  members: [alice.publicKey(), bob.publicKey(), carol.publicKey()],
  threshold: 2, // 2-of-3 required
});
```

This can only be called once. Subsequent calls will throw.

---

## 3. Create a Proposal

```ts
const { proposalId, txHash } = await client.createProposal({
  type: "TransferFunds",
  description: "Pay Q3 infrastructure grant to @alice",
  recipient: alice.publicKey(),
  amount: "5000000000",   // 500 USDC in stroops (7 decimal places)
  assetContractId: "CUSDC...",
  memo: "Q3 infra grant",
});

console.log(`Proposal #${proposalId} created — tx: ${txHash}`);
```

---

## 4. Sign a Proposal

```ts
const { txHash, executed } = await client.signProposal(proposalId);

if (executed) {
  console.log("Quorum reached — proposal executed automatically.");
} else {
  console.log("Signature recorded. Waiting for more signers.");
}
```

Auto-execution happens atomically when the final threshold signature is added.

---

## 5. Watch for Resolution

```ts
// Polls every 5s until the proposal is no longer Pending
const finalProposal = await client.watchProposal(proposalId);
console.log(`Proposal resolved with status: ${finalProposal.status}`);
```

---

## 6. Query Proposals

```ts
// All pending proposals
const pending = await client.getActiveProposals();

// Proposals involving a specific member
const aliceProposals = await client.getProposalsByMember(alice.publicKey());

// Board statistics
const stats = await client.getStats();
console.log(`${stats.executedProposals}/${stats.totalProposals} proposals executed`);
```

---

## 7. Formatting Helpers

```ts
import {
  formatProposalStatus,
  formatProposalType,
  formatTokenAmount,
  formatTimeRemaining,
  isProposalActive,
  signaturesNeeded,
} from "quorumforge-sdk";

formatProposalStatus("Executed");              // "✅ Executed"
formatProposalType("TransferFunds");           // "Transfer Funds"
formatTokenAmount("5000000000", "USDC");       // "500.00 USDC"
formatTimeRemaining(proposal.expiresAt);       // "2d remaining"
isProposalActive(proposal);                    // true | false
signaturesNeeded(proposal, board.threshold);   // 1
```

---

## 8. Error Handling

All SDK errors extend `QuorumForgeError` and carry a `code` string:

```ts
import {
  NotAMemberError,
  AlreadySignedError,
  ProposalExpiredError,
  InvalidThresholdError,
  withRetry,
} from "quorumforge-sdk";

try {
  await client.signProposal(1n);
} catch (err) {
  if (err instanceof NotAMemberError) {
    console.error("Not a board member:", err.message);
  } else if (err instanceof AlreadySignedError) {
    console.warn("Already signed this proposal.");
  }
}
```

Use `withRetry` to handle transient RPC failures:

```ts
import { withRetry } from "quorumforge-sdk";

const board = await withRetry(() => client.getBoard());
```

---

## Network Configuration

| Network | RPC URL |
|---|---|
| `testnet` | `https://soroban-testnet.stellar.org` |
| `mainnet` | `https://soroban-mainnet.stellar.org` |
| `futurenet` | `https://rpc-futurenet.stellar.org` |

Override with `sorobanRpcUrl` in the client config if you use a private node.
