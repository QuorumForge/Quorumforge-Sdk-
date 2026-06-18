# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| `0.x`   | ✅ Current development branch |

Once `1.0.0` is released, only the latest minor release on the current major will receive security patches.

---

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead:

1. Email the maintainers at **security@quorumforge.dev** (or open a [private GitHub security advisory](https://github.com/quorumforge/quorumforge-sdk/security/advisories/new)).
2. Include:
   - A clear description of the vulnerability.
   - Steps to reproduce or a minimal proof-of-concept.
   - The potential impact (data exposure, funds at risk, governance bypass, etc.).
3. You will receive an acknowledgement within **48 hours** and a status update within **7 days**.

We follow a **90-day coordinated disclosure** window. We will work with you to understand and fix the issue before any public disclosure.

---

## Security Considerations for SDK Users

### Keypair Handling

The SDK accepts a `Keypair` object containing a **secret key**. This key signs all on-chain transactions.

- **Never hardcode** a secret key in source code.
- In GitHub Actions: store the secret key in **GitHub Secrets** and load it via `process.env`.
- In CLIs: load from a `.env` file that is **gitignored**, or from a secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.).
- The SDK never logs or serialises your keypair.

```bash
# .env (gitignored)
QUORUMFORGE_SECRET=S...

# GitHub Actions secret: QUORUMFORGE_SECRET
```

```ts
import { Keypair } from "@stellar/stellar-sdk";
const keypair = Keypair.fromSecret(process.env.QUORUMFORGE_SECRET!);
```

### Member Guard

`createProposal` and `signProposal` both verify the calling keypair is a current board member before sending a transaction. This prevents accidental submission of governance transactions from the wrong key. The check is client-side (not a replacement for the on-chain contract guard).

### RPC URL

If you override `sorobanRpcUrl`, ensure you are connecting to a trusted node. A malicious RPC endpoint could:
- Return fabricated simulation results.
- Refuse to relay your transactions.

For production: use the official Stellar Foundation endpoints or a node you operate yourself.

### Dependency Security

This SDK depends on `@stellar/stellar-sdk`. Pin the version in your `package.json` (`^12.3.0`) and run `npm audit` regularly. We will bump the stellar-sdk dependency promptly when security patches are released.

---

## Known Limitations

- **Client-side membership check only.** The on-chain contract enforces all governance rules. The SDK's membership pre-check is a developer convenience, not a security boundary.
- **No built-in rate limiting.** If you embed this SDK in a bot, implement your own rate limiting to avoid flooding the RPC endpoint or the on-chain contract.
- **BigInt serialisation.** If you serialise SDK return values to JSON, use a replacer that handles `BigInt` (e.g. `.toString()`). JavaScript's `JSON.stringify` throws on `BigInt` by default.
