import { Connection, PublicKey } from "@solana/web3.js";
import { AirdropRule } from "@/lib/types";
import { AirdropProvider, ProviderBuildContext, ProviderEligibilityResult } from "@/lib/airdropProviders/types";

type ClaimApiResponse = {
  eligible?: boolean;
  claimable?: Array<{ symbol: string; amount: number; mint?: string; usd?: number }>;
  reason?: string;
};

class UnsupportedAirdropProvider implements AirdropProvider {
  id: string;
  project: string;
  status: AirdropRule["status"];
  officialClaimUrl: string;
  trustedDomains: string[];

  constructor(rule: AirdropRule) {
    this.id = rule.id;
    this.project = rule.project;
    this.status = rule.status;
    this.officialClaimUrl = rule.officialClaimUrl;
    this.trustedDomains = rule.trustedDomains || [];
  }

  async checkEligibility(): Promise<ProviderEligibilityResult> {
    return {
      status: "unknown",
      confidence: 0,
      reason: "No verified provider for this project yet. Marked unknown intentionally.",
    };
  }
}

class ClaimApiAirdropProvider implements AirdropProvider {
  id: string;
  project: string;
  status: AirdropRule["status"];
  officialClaimUrl: string;
  trustedDomains: string[];

  constructor(private readonly rule: AirdropRule, private readonly claimDomainTrusted: boolean) {
    this.id = rule.id;
    this.project = rule.project;
    this.status = rule.status;
    this.officialClaimUrl = rule.officialClaimUrl;
    this.trustedDomains = rule.trustedDomains || [];
  }

  async checkEligibility(wallet: PublicKey): Promise<ProviderEligibilityResult> {
    if (!this.rule.claimApiEndpoint) {
      return {
        status: "unknown",
        confidence: 0,
        reason: "Claim API endpoint not configured.",
      };
    }

    if (!this.claimDomainTrusted) {
      return {
        status: "unknown",
        confidence: 0,
        reason: "Claim URL domain is not trusted for this project.",
      };
    }

    try {
      const endpoint = new URL(this.rule.claimApiEndpoint);
      endpoint.searchParams.set("wallet", wallet.toBase58());
      const response = await fetch(endpoint.toString(), {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) {
        return {
          status: "unknown",
          confidence: 15,
          reason: `Claim API error (${response.status}).`,
        };
      }

      const payload = (await response.json()) as ClaimApiResponse;
      const eligible = Boolean(payload.eligible);
      const claimableAmount = (payload.claimable || [])
        .filter((item) => typeof item.amount === "number" && item.amount > 0 && Boolean(item.symbol))
        .map((item) => ({
          mint: item.mint,
          symbol: item.symbol,
          uiAmount: item.amount,
          usdValue: typeof item.usd === "number" ? item.usd : undefined,
          verified: true,
        }));

      if (!eligible) {
        return {
          status: "not_eligible",
          confidence: 90,
          claimableAmount,
          reason: payload.reason || "Official claim API reports wallet is not eligible.",
        };
      }

      return {
        status: "eligible",
        confidence: 95,
        claimableAmount,
        reason: payload.reason || "Eligibility verified by official project claim API.",
      };
    } catch {
      return {
        status: "unknown",
        confidence: 10,
        reason: "Unable to reach claim API endpoint.",
      };
    }
  }
}

class ManualVerifiedProvider implements AirdropProvider {
  id: string;
  project: string;
  status: AirdropRule["status"];
  officialClaimUrl: string;
  trustedDomains: string[];

  constructor(rule: AirdropRule) {
    this.id = rule.id;
    this.project = rule.project;
    this.status = rule.status;
    this.officialClaimUrl = rule.officialClaimUrl;
    this.trustedDomains = rule.trustedDomains || [];
  }

  async checkEligibility(_wallet: PublicKey, _connection: Connection): Promise<ProviderEligibilityResult> {
    return {
      status: "unknown",
      confidence: 0,
      reason: "Manual verified project configured, but no machine-verifiable method attached yet.",
    };
  }
}

export function buildProvider(context: ProviderBuildContext): AirdropProvider {
  const { rule, claimDomainTrusted } = context;

  if (rule.verificationMethod === "claim_api") {
    return new ClaimApiAirdropProvider(rule, claimDomainTrusted);
  }

  if (rule.verificationMethod === "manual_verified") {
    return new ManualVerifiedProvider(rule);
  }

  return new UnsupportedAirdropProvider(rule);
}
