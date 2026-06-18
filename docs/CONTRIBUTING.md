# Contributing to quorumforge-sdk

First off — thank you for taking the time to contribute. This is an open-source project and every contribution matters, whether it's a bug report, a feature suggestion, a documentation fix, or a pull request.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Testing Guidelines](#testing-guidelines)
- [Releasing](#releasing)

---

## Code of Conduct

This project follows the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/) Code of Conduct. By participating you agree to uphold it. Please report unacceptable behaviour to the maintainers via GitHub Issues (mark as confidential) or email listed in `SECURITY.md`.

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9

### Setup

```bash
git clone https://github.com/quorumforge/quorumforge-sdk.git
cd quorumforge-sdk
npm install
```

### Verify everything works

```bash
npm test          # run Jest test suite
npm run lint      # TypeScript type check
npm run build     # compile with tsup
```

---

## Development Workflow

1. **Fork** the repository and create your branch from `main`:
   ```bash
   git checkout -b feat/my-feature
   # or
   git checkout -b fix/bug-description
   ```

2. **Make your changes** — see the [Architecture doc](./ARCHITECTURE.md) for a map of where things live.

3. **Add or update tests** in `__tests__/`. Every new public method needs coverage.

4. **Run tests and the type checker** before opening a PR:
   ```bash
   npm test
   npm run lint
   ```

5. **Open a Pull Request** against `main` using the PR template.

---

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`

Examples:
```
feat(proposals): add expireProposal method
fix(board): throw InvalidThresholdError when threshold is 0
docs: update README GitHub Actions example
test(client): add 2-of-3 auto-execute flow test
```

---

## Pull Request Process

1. Fill out the PR template fully.
2. Make sure `npm test` passes with no failures.
3. Make sure `npm run lint` passes with no errors.
4. Request a review from at least one maintainer.
5. Address all review comments before the PR is merged.
6. A maintainer will squash-merge into `main`.

---

## Testing Guidelines

- All tests live in `__tests__/`.
- Mock `@stellar/stellar-sdk`'s `SorobanRpc.Server` at the module level — do not make live RPC calls in tests.
- Cover:
  - **Happy paths** — the expected success case.
  - **Error paths** — not a member, already signed, simulation failure, etc.
  - **Edge cases** — threshold boundaries, empty proposal arrays, BigInt IDs.
- Aim to keep test files < 300 lines. If they grow larger, split by concern.

Run with coverage:
```bash
npm run test:coverage
```

---

## Releasing

Releases are handled by maintainers only:

1. Bump the version in `package.json` following [semver](https://semver.org/).
2. Update `CHANGELOG.md` with the new version section.
3. Commit: `chore(release): v0.x.y`.
4. Tag: `git tag v0.x.y`.
5. Push tag: `git push --tags`.
6. CI publishes to npm automatically via `npm run prepublishOnly` (which runs `npm run build`).

---

## Project Structure Quick-Reference

```
src/
  client.ts       ← public API
  board.ts        ← board module (internal)
  proposals.ts    ← proposals module (internal)
  types.ts        ← all types and enums
  errors.ts       ← custom error classes
__tests__/
  client.test.ts
  board.test.ts
  proposals.test.ts
docs/
  ARCHITECTURE.md
  CONTRIBUTING.md  ← you are here
  SECURITY.md
  CHANGELOG.md
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for a deeper walkthrough.
