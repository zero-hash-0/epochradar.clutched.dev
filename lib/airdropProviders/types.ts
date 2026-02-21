import { Connection, PublicKey } from "@solana/web3.js";
import { AirdropClaimableAmount, AirdropLifecycleStatus, AirdropRule, ProviderEligibilityStatus } from "@/lib/types";

export type ProviderEligibilityResult = {
  status: ProviderEligibilityStatus;
  confidence: number;
  reason: string;
  proof?: Record<string, unknown>;
  claimableAmount?: AirdropClaimableAmount[];
};

export interface AirdropProvider {
  id: string;
  project: string;
  status: AirdropLifecycleStatus;
  officialClaimUrl: string;
  trustedDomains: string[];
  checkEligibility(wallet: PublicKey, connection: Connection): Promise<ProviderEligibilityResult>;
}

export type ProviderBuildContext = {
  rule: AirdropRule;
  claimDomainTrusted: boolean;
};
