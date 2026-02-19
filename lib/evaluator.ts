import { AIRDROP_RULES } from "@/lib/airdrops";
import { AirdropEvaluation, AirdropRule, WalletProfile } from "@/lib/types";
import { evaluateClaimSafety } from "@/lib/claimSafety";

function checkRule(rule: AirdropRule, profile: WalletProfile) {
  let score = 0;
  let checks = 0;
  const met: string[] = [];
  const unmet: string[] = [];

  const pass = (label: string) => {
    score += 1;
    checks += 1;
    met.push(label);
  };

  const fail = (label: string) => {
    checks += 1;
    unmet.push(label);
  };

  if (rule.checks.minSolBalance !== undefined) {
    if (profile.solBalance >= rule.checks.minSolBalance) {
      pass(`SOL >= ${rule.checks.minSolBalance}`);
    } else {
      fail(`SOL below ${rule.checks.minSolBalance}`);
    }
  }

  if (rule.checks.minTokenAccounts !== undefined) {
    if (profile.tokenAccountsCount >= rule.checks.minTokenAccounts) {
      pass(`Token accounts >= ${rule.checks.minTokenAccounts}`);
    } else {
      fail(`Token accounts below ${rule.checks.minTokenAccounts}`);
    }
  }

  if (rule.checks.minRecentTransactions !== undefined) {
    if (profile.recentTransactionCount >= rule.checks.minRecentTransactions) {
      pass(`Recent tx >= ${rule.checks.minRecentTransactions}`);
    } else {
      fail(`Recent tx below ${rule.checks.minRecentTransactions}`);
    }
  }

  if (rule.checks.minNftCount !== undefined) {
    if (profile.nftApproxCount >= rule.checks.minNftCount) {
      pass(`NFT count >= ${rule.checks.minNftCount}`);
    } else {
      fail(`NFT count below ${rule.checks.minNftCount}`);
    }
  }

  if (rule.checks.requiresAnyTokens && rule.checks.requiresAnyTokens.length) {
    const hasAny = rule.checks.requiresAnyTokens.some((t) =>
      profile.tokenSymbols.includes(t),
    );
    if (hasAny) {
      pass(`Has one token in [${rule.checks.requiresAnyTokens.join(", ")}]`);
    } else {
      fail(`Missing tokens: [${rule.checks.requiresAnyTokens.join(", ")}]`);
    }
  }

  if (rule.checks.maxLastActiveDays !== undefined) {
    if (
      profile.lastActiveDays !== undefined &&
      profile.lastActiveDays <= rule.checks.maxLastActiveDays
    ) {
      pass(`Active within ${rule.checks.maxLastActiveDays} days`);
    } else {
      fail(`Not active within ${rule.checks.maxLastActiveDays} days`);
    }
  }

  const ratio = checks === 0 ? 0 : score / checks;

  if (ratio >= 0.8) {
    return {
      status: "eligible" as const,
      confidence: Math.round(ratio * 100),
      reason: `${met.length} checks passed, ${unmet.length} missed`,
      proof: { met, unmet },
    };
  }

  if (ratio >= 0.5) {
    return {
      status: "likely" as const,
      confidence: Math.round(ratio * 100),
      reason: `${met.length} checks passed, ${unmet.length} missed`,
      proof: { met, unmet },
    };
  }

  if (checks > 0) {
    return {
      status: "not_eligible" as const,
      confidence: Math.round(ratio * 100),
      reason: `${met.length} checks passed, ${unmet.length} missed`,
      proof: { met, unmet },
    };
  }

  return {
    status: "unknown" as const,
    confidence: 0,
    reason: "No applicable checks",
    proof: { met, unmet },
  };
}

export function evaluateWalletAirdrops(
  profile: WalletProfile,
  rules: AirdropRule[] = AIRDROP_RULES,
): AirdropEvaluation[] {
  return rules.map((rule) => {
    const { status, confidence, reason, proof } = checkRule(rule, profile);
    const claimSafety = evaluateClaimSafety(rule);

    return {
      id: rule.id,
      project: rule.project,
      status,
      confidence,
      reason,
      network: rule.network,
      category: rule.category,
      airdropStatus: rule.status,
      officialClaimUrl: rule.officialClaimUrl,
      sourceUrl: rule.sourceUrl,
      riskLevel: rule.riskLevel,
      timeline: rule.timeline,
      proof,
      claimSafety,
    };
  }).sort((a, b) => b.confidence - a.confidence);
}
