function normalizeHost(hostname: string) {
  return hostname.toLowerCase().replace(/^www\./, "");
}

export function isTrustedClaimDomain(claimUrl: string, trustedDomains: string[]) {
  let claimHost = "";
  try {
    const parsed = new URL(claimUrl);
    if (parsed.protocol !== "https:") {
      return false;
    }
    claimHost = normalizeHost(parsed.hostname);
  } catch {
    return false;
  }

  if (!claimHost) {
    return false;
  }

  const trusted = trustedDomains.map((domain) => normalizeHost(domain)).filter(Boolean);
  if (trusted.length === 0) {
    return false;
  }

  return trusted.some((domain) => claimHost === domain || claimHost.endsWith(`.${domain}`));
}
