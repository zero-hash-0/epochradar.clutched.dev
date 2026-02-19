"use client";

import { useEffect, useMemo, useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { AirdropEvaluation, WalletProfile } from "@/lib/types";
import StatusTabs from "@/components/StatusTabs";

type ApiResponse = {
  checkedAt: string;
  profile: WalletProfile;
  results: AirdropEvaluation[];
  safety: {
    readOnly: boolean;
    privateKeysRequested: boolean;
    note: string;
  };
};

type SolPriceResponse = {
  symbol: "SOL";
  priceUsd: number;
  change24h: number;
  asOf: string;
};

export default function AirdropCheckerClient() {
  const { connected, publicKey } = useWallet();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [solPrice, setSolPrice] = useState<SolPriceResponse | null>(null);

  const walletAddress = useMemo(() => publicKey?.toBase58() ?? null, [publicKey]);
  const summary = useMemo(() => {
    if (!data) {
      return null;
    }

    return {
      eligible: data.results.filter((r) => r.status === "eligible").length,
      likely: data.results.filter((r) => r.status === "likely").length,
      watchlist: data.results.filter((r) => r.status === "unknown").length,
      checkedAt: new Date(data.checkedAt).toLocaleString(),
    };
  }, [data]);

  const pulseMetrics = useMemo(
    () => [
      {
        label: "SOL/USD",
        value: solPrice ? `$${solPrice.priceUsd.toFixed(2)}` : "--",
        tone: "price",
      },
      {
        label: "24H",
        value: solPrice ? `${solPrice.change24h >= 0 ? "+" : ""}${solPrice.change24h.toFixed(2)}%` : "--",
        tone: solPrice ? (solPrice.change24h >= 0 ? "up" : "down") : "neutral",
      },
      { label: "Live TPS", value: "4,218", tone: "neutral" },
      { label: "Slot Time", value: "402ms", tone: "neutral" },
      { label: "Finality", value: "< 1s", tone: "neutral" },
    ],
    [solPrice],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadSolPrice = async () => {
      try {
        const res = await fetch("/api/sol-price", { cache: "no-store" });
        if (!res.ok) return;

        const payload = (await res.json()) as SolPriceResponse;
        if (!cancelled) {
          setSolPrice(payload);
        }
      } catch {
        // Keep ticker resilient; silently ignore transient failures.
      }
    };

    void loadSolPrice();
    const timer = setInterval(() => void loadSolPrice(), 30000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const runCheck = async () => {
    if (!walletAddress) {
      setError("Connect a wallet first.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });

      const payload = await res.json();

      if (!res.ok) {
        throw new Error(payload.error || "Failed to check eligibility");
      }

      setData(payload as ApiResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page">
      <section className="pulse-strip" aria-label="Solana network pulse">
        {pulseMetrics.map((item) => (
          <article key={item.label} className={`pulse-item ${item.tone ? `pulse-${item.tone}` : ""}`}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>

      <section className="hero">
        <div className="scan-frame" aria-hidden="true" />
        <p className="eyebrow">Solana Airdrop Checker</p>
        <h1>Check Availability</h1>
        <p className="subhead">
          Read-only wallet analysis. No seed phrases. No transaction signing required.
        </p>
        <p className="subhead">Manage rule definitions at <a href="/admin">/admin</a>.</p>
        <div className="hero-tags" aria-label="App safety highlights">
          <span>Read-only</span>
          <span>No signing</span>
          <span>Mainnet-ready</span>
        </div>
        <div className="command-deck" aria-label="System mode">
          <span>Validator Core</span>
          <span>On-Chain Hologram</span>
          <span>SVM Command Deck</span>
        </div>
        <div className="actions">
          {mounted ? (
            <WalletMultiButton />
          ) : (
            <button type="button" className="wallet-adapter-button" disabled>
              Loading wallet...
            </button>
          )}
          <button type="button" className="check-btn" onClick={runCheck} disabled={!connected || loading}>
            {loading ? "Checking Eligibility..." : "Check Eligibility"}
          </button>
        </div>
        {walletAddress ? <p className="wallet">Wallet: {walletAddress}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>

      {data ? (
        <>
          {summary ? (
            <section className="summary-grid" aria-label="Eligibility summary">
              <article>
                <span>Genesis Tier</span>
                <strong>{summary.eligible}</strong>
              </article>
              <article>
                <span>Epoch Tier</span>
                <strong>{summary.likely}</strong>
              </article>
              <article>
                <span>Pending Slot</span>
                <strong>{summary.watchlist}</strong>
              </article>
              <article>
                <span>Scan Time</span>
                <strong>{summary.checkedAt}</strong>
              </article>
            </section>
          ) : null}
          <section className="profile-panel">
            <h2>Wallet profile snapshot</h2>
            <div className="metrics-grid">
              <article>
                <span>SOL balance</span>
                <strong>{data.profile.solBalance.toFixed(4)}</strong>
              </article>
              <article>
                <span>Token accounts</span>
                <strong>{data.profile.tokenAccountsCount}</strong>
              </article>
              <article>
                <span>Approx NFTs</span>
                <strong>{data.profile.nftApproxCount}</strong>
              </article>
              <article>
                <span>Recent tx (100 max)</span>
                <strong>{data.profile.recentTransactionCount}</strong>
              </article>
            </div>
            <p className="safety-note">{data.safety.note}</p>
          </section>

          <StatusTabs results={data.results} />
        </>
      ) : null}
      <footer className="credit">Made with Love ❤️ by @notT0KY0</footer>
    </main>
  );
}
