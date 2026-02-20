export type EligibilityStatus = "eligible" | "likely" | "not_eligible" | "unknown";
export type SafetyGrade = "safe" | "caution" | "risky";

export type AirdropTimeline = {
  announcedAt?: string;
  snapshotAt?: string;
  claimOpensAt?: string;
  claimEndsAt?: string;
};

export type WalletProfile = {
  address: string;
  solBalance: number;
  tokenSymbols: string[];
  tokenAccountsCount: number;
  nftApproxCount: number;
  recentTransactionCount: number;
  accountAgeDays?: number;
  lastActiveDays?: number;
};

export type AirdropRule = {
  id: string;
  project: string;
  network: "solana";
  category: "defi" | "nft" | "infrastructure" | "consumer";
  status: "upcoming" | "active" | "snapshot_taken" | "ended";
  officialClaimUrl: string;
  sourceUrl: string;
  trustedDomains?: string[];
  timeline?: AirdropTimeline;
  riskLevel: "low" | "medium" | "high";
  estimatedValue?: string;
  description?: string;
  tags?: string[];
  checks: {
    minSolBalance?: number;
    minTokenAccounts?: number;
    minRecentTransactions?: number;
    requiresAnyTokens?: string[];
    minNftCount?: number;
    maxLastActiveDays?: number;
  };
};

export type AirdropEvaluation = {
  id: string;
  project: string;
  status: EligibilityStatus;
  confidence: number;
  reason: string;
  network: "solana";
  category: AirdropRule["category"];
  airdropStatus: AirdropRule["status"];
  officialClaimUrl: string;
  sourceUrl: string;
  riskLevel: AirdropRule["riskLevel"];
  estimatedValue?: string;
  description?: string;
  tags?: string[];
  timeline?: AirdropTimeline;
  proof: {
    met: string[];
    unmet: string[];
  };
  claimSafety: {
    grade: SafetyGrade;
    reasons: string[];
    hostname: string;
  };
};
