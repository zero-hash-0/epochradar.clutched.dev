import { AirdropRule, SafetyGrade } from "@/lib/types";

type ClaimSafety = {
  grade: SafetyGrade;
  reasons: string[];
  hostname: string;
};

function normalizeHost(hostname: string) {
  return hostname.toLowerCase().replace(/^www\./, "");
}

function matchesTrustedHost(hostname: string, trustedDomains: string[]) {
  const host = normalizeHost(hostname);

  return trustedDomains.some((trusted) => {
    const t = normalizeHost(trusted);
    return host === t || host.endsWith(`.${t}`);
  });
}

export function evaluateClaimSafety(rule: AirdropRule): ClaimSafety {
  const reasons: string[] = [];
  let score = 0;

  let claimUrl: URL;
  try {
    claimUrl = new URL(rule.officialClaimUrl);
  } catch {
    return {
      grade: "risky",
      reasons: ["Invalid claim URL format"],
      hostname: "invalid-url",
    };
  }

  const hostname = normalizeHost(claimUrl.hostname);
  const sourceHost = (() => {
    try {
      return normalizeHost(new URL(rule.sourceUrl).hostname);
    } catch {
      return "";
    }
  })();

  const trustedDomains = [
    ...(rule.trustedDomains || []),
    hostname,
    sourceHost && sourceHost !== "x.com" ? sourceHost : "",
  ].filter(Boolean);

  if (claimUrl.protocol === "https:") {
    score += 2;
    reasons.push("HTTPS enabled");
  } else {
    score -= 3;
    reasons.push("Non-HTTPS claim URL");
  }

  if (rule.officialClaimUrl.includes("@")) {
    score -= 3;
    reasons.push("URL contains @ symbol");
  }

  if (hostname.includes("xn--")) {
    score -= 2;
    reasons.push("Punycode domain detected");
  }

  if (matchesTrustedHost(hostname, trustedDomains)) {
    score += 2;
    reasons.push("Domain matches trusted host list");
  } else {
    score -= 2;
    reasons.push("Domain does not match trusted host list");
  }

  if (rule.riskLevel === "high") {
    score -= 1;
    reasons.push("Project marked high risk");
  }

  const grade: SafetyGrade = score >= 3 ? "safe" : score >= 0 ? "caution" : "risky";

  return {
    grade,
    reasons,
    hostname,
  };
}
