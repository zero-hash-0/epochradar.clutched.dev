export type EligibilityStatus = "eligible" | "likely" | "not_eligible" | "unknown";
export type ProviderEligibilityStatus = "eligible" | "not_eligible" | "unknown";
export type AirdropLifecycleStatus = "upcoming" | "active" | "snapshot_taken" | "ended";
export type VerificationMethod =
  | "claim_api"
  | "distributor_program"
  | "manual_verified"
  | "unverified";

export type PastAirdrop = {
  signature: string;
  date: string;
  timestamp: number;
  mint: string;
  mintShort: string;
  symbol: string;
  amount: number;
  decimals: number;
  uiAmount: number;
  senderAddress: string | null;
  isLikelyAirdrop: boolean;
  reason: string;
  confidence: number;
  usdValue?: number;
};
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
  tokenMints: string[];
  tokenBalances: Array<{
    mint: string;
    symbol: string;
    uiAmount: number;
    decimals: number;
  }>;
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
  status: AirdropLifecycleStatus;
  officialClaimUrl: string;
  sourceUrl: string;
  trustedDomains?: string[];
  timeline?: AirdropTimeline;
  riskLevel: "low" | "medium" | "high";
  verificationMethod?: VerificationMethod;
  distributorProgramId?: string;
  claimApiEndpoint?: string;
  snapshotProofType?: string;
  lastVerifiedAt?: string;
  sourceConfidence?: number;
  verificationConfig?: Record<string, unknown>;
  verified?: boolean;
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

export type AirdropClaimableAmount = {
  mint?: string;
  symbol: string;
  uiAmount: number;
  usdValue?: number;
  verified: boolean;
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
  verificationMethod: VerificationMethod;
  verified: boolean;
  claimActionEnabled: boolean;
  claimableAmounts?: AirdropClaimableAmount[];
  verifiedUsdTotal?: number;
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
