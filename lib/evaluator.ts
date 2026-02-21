import { clusterApiUrl, Connection, PublicKey } from "@solana/web3.js";
import { AIRDROP_RULES } from "@/lib/airdrops";
import { evaluateClaimSafety } from "@/lib/claimSafety";
import { buildProvider } from "@/lib/airdropProviders/providers";
import { isTrustedClaimDomain } from "@/lib/airdropProviders/trustedDomains";
import { AirdropEvaluation, AirdropRule } from "@/lib/types";

const MAINNET_URL = process.env.SOLANA_RPC_URL || clusterApiUrl("mainnet-beta");

function toUiStatus(status: "eligible" | "not_eligible" | "unknown"): AirdropEvaluation["status"] {
  if (status === "eligible") {
    return "eligible";
  }
  if (status === "not_eligible") {
    return "not_eligible";
  }
  return "unknown";
}

export async function evaluateWalletAirdrops(
  walletAddress: string,
  rules: AirdropRule[] = AIRDROP_RULES,
): Promise<AirdropEvaluation[]> {
  const wallet = new PublicKey(walletAddress);
  const connection = new Connection(MAINNET_URL, "confirmed");

  const evaluated = await Promise.all(
    rules.map(async (rule) => {
      const claimSafety = evaluateClaimSafety(rule);
      const trustedDomains = rule.trustedDomains || [];
      const claimDomainTrusted = isTrustedClaimDomain(rule.officialClaimUrl, trustedDomains);
      const provider = buildProvider({ rule, claimDomainTrusted });
      const providerResult = await provider.checkEligibility(wallet, connection);

      const verifiedUsdTotal = (providerResult.claimableAmount || []).reduce((sum, item) => {
        return sum + (item.usdValue || 0);
      }, 0);

      return {
        id: rule.id,
        project: rule.project,
        status: toUiStatus(providerResult.status),
        confidence: providerResult.confidence,
        reason: providerResult.reason,
        network: rule.network,
        category: rule.category,
        airdropStatus: rule.status,
        officialClaimUrl: rule.officialClaimUrl,
        sourceUrl: rule.sourceUrl,
        riskLevel: rule.riskLevel,
        verificationMethod: rule.verificationMethod || "unverified",
        verified: (rule.verificationMethod || "unverified") !== "unverified",
        claimActionEnabled:
          rule.status !== "upcoming" &&
          providerResult.status === "eligible" &&
          claimDomainTrusted &&
          claimSafety.grade !== "risky",
        claimableAmounts: providerResult.claimableAmount,
        verifiedUsdTotal: verifiedUsdTotal > 0 ? verifiedUsdTotal : undefined,
        estimatedValue: rule.estimatedValue,
        description: rule.description,
        tags: rule.tags,
        timeline: rule.timeline,
        proof: {
          met: providerResult.status === "eligible" ? ["Provider verified"] : [],
          unmet: providerResult.status === "unknown" ? ["No verified provider"] : [],
        },
        claimSafety,
      } satisfies AirdropEvaluation;
    }),
  );

  return evaluated.sort((a, b) => b.confidence - a.confidence);
}
