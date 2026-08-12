import {
  formatProposalStatus,
  formatProposalType,
  truncateAddress,
  formatTokenAmount,
  formatTimeRemaining,
  formatTimestamp,
  isProposalActive,
  isExpired,
  isMajority,
  signaturesNeeded,
  validateTtl,
  isValidContractId,
  formatSignatureCount,
  getRpcUrl,
  paginateProposals,
  sortProposalsByDate,
  groupProposalsByType,
} from "../src/utils";
import type { Proposal } from "../src/types";
import { MIN_TTL_SECONDS, MAX_TTL_SECONDS } from "../src/types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NOW_SEC = BigInt(Math.floor(Date.now() / 1000));

function makeProposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    proposalId: BigInt(1),
    proposer: "GABC",
    proposalType: "ResolveIssue",
    payload: { type: "ResolveIssue", issueNumber: 1, contributor: "GXYZ", amount: "100", assetContractId: "CASSET" },
    signatures: [],
    status: "Pending",
    createdAt: NOW_SEC - BigInt(100),
    expiresAt: NOW_SEC + BigInt(3600),
    executedAt: null,
    cancelledAt: null,
    description: "Test proposal",
    ...overrides,
  };
}

// ─── formatProposalStatus ──────────────────────────────────────────────────────

describe("formatProposalStatus", () => {
  it("formats Pending", () => expect(formatProposalStatus("Pending")).toBe("⏳ Pending"));
  it("formats Executed", () => expect(formatProposalStatus("Executed")).toBe("✅ Executed"));
  it("formats Expired", () => expect(formatProposalStatus("Expired")).toBe("🕐 Expired"));
  it("formats Cancelled", () => expect(formatProposalStatus("Cancelled")).toBe("🚫 Cancelled"));
});

// ─── formatProposalType ──────────────────────────────────────────────────────

describe("formatProposalType", () => {
  it("formats ResolveIssue", () => expect(formatProposalType("ResolveIssue")).toBe("Resolve Issue"));
  it("formats TransferFunds", () => expect(formatProposalType("TransferFunds")).toBe("Transfer Funds"));
  it("formats AddMember", () => expect(formatProposalType("AddMember")).toBe("Add Member"));
  it("formats RemoveMember", () => expect(formatProposalType("RemoveMember")).toBe("Remove Member"));
  it("formats UpdateThreshold", () => expect(formatProposalType("UpdateThreshold")).toBe("Update Threshold"));
});

// ─── truncateAddress ─────────────────────────────────────────────────────────

describe("truncateAddress", () => {
  it("truncates a long address", () => {
    const addr = "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWX";
    const result = truncateAddress(addr, 4);
    expect(result).toContain("...");
    expect(result.length).toBeLessThan(addr.length);
  });

  it("returns short address unchanged", () => {
    expect(truncateAddress("GABC", 4)).toBe("GABC");
  });
});

// ─── formatTokenAmount ───────────────────────────────────────────────────────

describe("formatTokenAmount", () => {
  it("converts 10_000_000 base units to 1.00 XLM", () => {
    expect(formatTokenAmount("10000000", "XLM")).toContain("1.00");
  });

  it("accepts bigint input", () => {
    expect(formatTokenAmount(BigInt(10_000_000), "XLM")).toContain("1.00");
  });
});

// ─── formatTimeRemaining ──────────────────────────────────────────────────────

describe("formatTimeRemaining", () => {
  it('returns "Expired" for past timestamps', () => {
    expect(formatTimeRemaining(NOW_SEC - BigInt(1))).toBe("Expired");
  });

  it("shows minutes for < 1 hour remaining", () => {
    const result = formatTimeRemaining(NOW_SEC + BigInt(600));
    expect(result).toMatch(/\d+m/);
  });

  it("shows hours for < 1 day remaining", () => {
    const result = formatTimeRemaining(NOW_SEC + BigInt(7200));
    expect(result).toMatch(/\d+h/);
  });

  it("shows days for >= 1 day remaining", () => {
    const result = formatTimeRemaining(NOW_SEC + BigInt(86400 * 2));
    expect(result).toMatch(/\d+d/);
  });
});

// ─── formatTimestamp ────────────────────────────────────────────────────────

describe("formatTimestamp", () => {
  it("returns a non-empty string for a valid timestamp", () => {
    const result = formatTimestamp(BigInt(1700000000));
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(5);
  });
});

// ─── isProposalActive ─────────────────────────────────────────────────────────

describe("isProposalActive", () => {
  it("returns true for a pending, non-expired proposal", () => {
    expect(isProposalActive(makeProposal())).toBe(true);
  });

  it("returns false for an executed proposal", () => {
    expect(isProposalActive(makeProposal({ status: "Executed" }))).toBe(false);
  });

  it("returns false for an expired timestamp", () => {
    expect(isProposalActive(makeProposal({ expiresAt: NOW_SEC - BigInt(1) }))).toBe(false);
  });
});

// ─── isExpired ───────────────────────────────────────────────────────────────

describe("isExpired", () => {
  it("returns true when expiresAt is in the past", () => {
    expect(isExpired(makeProposal({ expiresAt: NOW_SEC - BigInt(1) }))).toBe(true);
  });

  it("returns false when expiresAt is in the future", () => {
    expect(isExpired(makeProposal())).toBe(false);
  });
});

// ─── isMajority ──────────────────────────────────────────────────────────────

describe("isMajority", () => {
  it("returns true when collected > half", () => expect(isMajority(2, 3)).toBe(true));
  it("returns false when collected = half", () => expect(isMajority(1, 2)).toBe(false));
  it("returns false when collected < half", () => expect(isMajority(1, 3)).toBe(false));
});

// ─── signaturesNeeded ────────────────────────────────────────────────────────

describe("signaturesNeeded", () => {
  it("returns remaining signatures needed", () => {
    const p = makeProposal({ signatures: ["A"] });
    expect(signaturesNeeded(p, 3)).toBe(2);
  });

  it("returns 0 when threshold already met", () => {
    const p = makeProposal({ signatures: ["A", "B", "C"] });
    expect(signaturesNeeded(p, 2)).toBe(0);
  });
});

// ─── validateTtl ─────────────────────────────────────────────────────────────

describe("validateTtl", () => {
  it("returns null for a valid TTL", () => expect(validateTtl(MIN_TTL_SECONDS)).toBeNull());
  it("returns error message for TTL too short", () => expect(validateTtl(100)).not.toBeNull());
  it("returns error message for TTL too long", () => expect(validateTtl(MAX_TTL_SECONDS + 1)).not.toBeNull());
});

// ─── isValidContractId ───────────────────────────────────────────────────────

describe("isValidContractId", () => {
  it("accepts a valid 56-char C-prefix contract ID", () => {
    expect(isValidContractId("C" + "A".repeat(55))).toBe(true);
  });

  it("rejects IDs starting with G", () => {
    expect(isValidContractId("G" + "A".repeat(55))).toBe(false);
  });

  it("rejects IDs that are too short", () => {
    expect(isValidContractId("CABC")).toBe(false);
  });
});

// ─── formatSignatureCount ────────────────────────────────────────────────────

describe("formatSignatureCount", () => {
  it("pluralises correctly", () => {
    expect(formatSignatureCount(2, 3)).toBe("2 / 3 signatures");
    expect(formatSignatureCount(1, 1)).toBe("1 / 1 signature");
  });
});

// ─── getRpcUrl ───────────────────────────────────────────────────────────────

describe("getRpcUrl", () => {
  it("returns testnet URL for testnet", () => {
    expect(getRpcUrl("testnet")).toContain("testnet");
  });

  it("falls back to testnet for unknown network", () => {
    expect(getRpcUrl("unknown")).toContain("testnet");
  });
});

// ─── paginateProposals ───────────────────────────────────────────────────────

describe("paginateProposals", () => {
  const items = Array.from({ length: 25 }, (_, i) => makeProposal({ proposalId: BigInt(i + 1) }));

  it("returns first page correctly", () => {
    const result = paginateProposals(items, 1, 10);
    expect(result.items).toHaveLength(10);
    expect(result.hasMore).toBe(true);
    expect(result.total).toBe(25);
  });

  it("returns last partial page", () => {
    const result = paginateProposals(items, 3, 10);
    expect(result.items).toHaveLength(5);
    expect(result.hasMore).toBe(false);
  });
});

// ─── sortProposalsByDate ──────────────────────────────────────────────────────

describe("sortProposalsByDate", () => {
  const a = makeProposal({ proposalId: 1n, createdAt: 100n });
  const b = makeProposal({ proposalId: 2n, createdAt: 200n });

  it("sorts desc by default", () => {
    const result = sortProposalsByDate([a, b]);
    expect(result[0]!.createdAt).toBe(200n);
  });

  it("sorts asc when specified", () => {
    const result = sortProposalsByDate([b, a], "asc");
    expect(result[0]!.createdAt).toBe(100n);
  });
});

// ─── groupProposalsByType ────────────────────────────────────────────────────

describe("groupProposalsByType", () => {
  it("groups proposals by type", () => {
    const proposals = [
      makeProposal({ proposalType: "ResolveIssue" }),
      makeProposal({ proposalType: "ResolveIssue" }),
      makeProposal({ proposalType: "AddMember" }),
    ];
    const grouped = groupProposalsByType(proposals);
    expect(grouped.get("ResolveIssue")).toHaveLength(2);
    expect(grouped.get("AddMember")).toHaveLength(1);
  });
});
