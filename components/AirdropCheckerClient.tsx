"use client";

import { useEffect, useMemo, useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { AirdropEvaluation, WalletProfile } from "@/lib/types";
import StatusTabs from "@/components/StatusTabs";
import { AIRDROP_RULES } from "@/lib/airdrops";
import { evaluateWalletAirdrops } from "@/lib/evaluator";

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

type DiscoveryTickerItem = {
  id: string;
  title: string;
  url: string;
  sourceName: string;
};

type WalletProfileGroup = {
  id: string;
  name: string;
  wallets: string[];
  createdAt: string;
};

type WalletScan = {
  address: string;
  ok: boolean;
  error?: string;
  eligibleCount: number;
  likelyCount: number;
};

type GroupScanResult = {
  profileName: string;
  checkedAt: string;
  walletScans: WalletScan[];
  aggregateResults: AirdropEvaluation[];
};

const LOCAL_STORAGE_KEY = "airdrop_wallet_profiles_v1";

function isValidWalletAddress(address: string) {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

export default function AirdropCheckerClient() {
  const { connected, publicKey } = useWallet();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [solPrice, setSolPrice] = useState<SolPriceResponse | null>(null);
  const [tickerItems, setTickerItems] = useState<DiscoveryTickerItem[]>([]);
  const [shareBaseUrl, setShareBaseUrl] = useState("http://localhost:3000");
  const [profiles, setProfiles] = useState<WalletProfileGroup[]>([]);
  const [newProfileName, setNewProfileName] = useState("");
  const [newWalletAddress, setNewWalletAddress] = useState("");
  const [draftWallets, setDraftWallets] = useState<string[]>([]);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [runningProfileId, setRunningProfileId] = useState<string | null>(null);
  const [groupScan, setGroupScan] = useState<GroupScanResult | null>(null);
  const [chartRange, setChartRange] = useState<"1M" | "1Y" | "ALL">("ALL");
  const [onlyEligible, setOnlyEligible] = useState(true);

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
    if (typeof window !== "undefined") {
      setShareBaseUrl(window.location.origin);
      try {
        const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as WalletProfileGroup[];
          if (Array.isArray(parsed)) {
            setProfiles(parsed);
          }
        }
      } catch {
        // Ignore localStorage parse issues.
      }
    }
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(profiles));
    } catch {
      // Non-blocking persistence.
    }
  }, [profiles, mounted]);

  const demoProfiles = useMemo(() => {
    const builderProfile: WalletProfile = {
      address: "DemoBuilder1111111111111111111111111111111111",
      solBalance: 4.25,
      tokenSymbols: ["USDC", "JUP", "BONK", "DRFT"],
      tokenAccountsCount: 11,
      nftApproxCount: 3,
      recentTransactionCount: 72,
      accountAgeDays: 420,
      lastActiveDays: 2,
    };

    const newcomerProfile: WalletProfile = {
      address: "DemoNewbie11111111111111111111111111111111111",
      solBalance: 0.03,
      tokenSymbols: ["USDC"],
      tokenAccountsCount: 1,
      nftApproxCount: 0,
      recentTransactionCount: 4,
      accountAgeDays: 16,
      lastActiveDays: 1,
    };

    return {
      builder: builderProfile,
      newcomer: newcomerProfile,
    };
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

  useEffect(() => {
    let cancelled = false;

    const loadTicker = async () => {
      try {
        const res = await fetch("/api/discovery", { cache: "no-store" });
        if (!res.ok) return;
        const payload = (await res.json()) as { leads?: DiscoveryTickerItem[] };
        if (!cancelled) {
          setTickerItems((payload.leads || []).slice(0, 12));
        }
      } catch {
        // Keep UI stable if discovery feed is unavailable.
      }
    };

    void loadTicker();
    const timer = setInterval(() => void loadTicker(), 120000);
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

      setGroupScan(null);
      setData(payload as ApiResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const runDemo = (profile: WalletProfile) => {
    const results: AirdropEvaluation[] = evaluateWalletAirdrops(profile, AIRDROP_RULES);
    setGroupScan(null);
    setData({
      checkedAt: new Date().toISOString(),
      profile,
      results,
      safety: {
        readOnly: true,
        privateKeysRequested: false,
        note: "Demo mode loaded from local sample profiles.",
      },
    });
    setError(null);
  };

  const addDraftWallet = () => {
    const value = newWalletAddress.trim();
    if (!value) return;

    if (!isValidWalletAddress(value)) {
      setProfileError("Wallet address is invalid.");
      return;
    }

    if (draftWallets.includes(value)) {
      setProfileError("Wallet already added to this profile.");
      return;
    }

    setDraftWallets((prev) => [...prev, value]);
    setNewWalletAddress("");
    setProfileError(null);
  };

  const saveProfile = () => {
    const name = newProfileName.trim();
    if (!name) {
      setProfileError("Profile name is required.");
      return;
    }

    if (draftWallets.length === 0) {
      setProfileError("Add at least one wallet to the profile.");
      return;
    }

    const next: WalletProfileGroup = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      wallets: draftWallets,
      createdAt: new Date().toISOString(),
    };

    setProfiles((prev) => [next, ...prev]);
    setNewProfileName("");
    setNewWalletAddress("");
    setDraftWallets([]);
    setProfileError(null);
  };

  const removeProfile = (profileId: string) => {
    setProfiles((prev) => prev.filter((p) => p.id !== profileId));
    if (runningProfileId === profileId) {
      setRunningProfileId(null);
    }
  };

  const removeDraftWallet = (address: string) => {
    setDraftWallets((prev) => prev.filter((w) => w !== address));
  };

  const aggregateProfileResults = (
    walletResults: Array<{ address: string; results: AirdropEvaluation[] }>,
  ) => {
    const bestByProject = new Map<string, AirdropEvaluation>();
    const hits = new Map<string, Set<string>>();

    for (const wallet of walletResults) {
      for (const item of wallet.results) {
        if (!hits.has(item.id)) {
          hits.set(item.id, new Set());
        }
        hits.get(item.id)?.add(wallet.address);

        const current = bestByProject.get(item.id);
        if (!current || item.confidence > current.confidence) {
          bestByProject.set(item.id, { ...item });
        }
      }
    }

    const walletCount = Math.max(walletResults.length, 1);
    return Array.from(bestByProject.values())
      .map((item) => {
        const seen = hits.get(item.id)?.size || 0;
        return {
          ...item,
          reason: `${item.reason} | seen in ${seen}/${walletCount} wallets`,
        };
      })
      .sort((a, b) => b.confidence - a.confidence);
  };

  const runProfileScan = async (profile: WalletProfileGroup) => {
    setRunningProfileId(profile.id);
    setError(null);
    setProfileError(null);

    const walletScans: WalletScan[] = [];
    const successfulWallets: Array<{ address: string; results: AirdropEvaluation[] }> = [];

    for (const address of profile.wallets) {
      try {
        const res = await fetch("/api/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: address }),
        });
        const payload = await res.json();

        if (!res.ok) {
          walletScans.push({
            address,
            ok: false,
            error: payload.error || "Check failed",
            eligibleCount: 0,
            likelyCount: 0,
          });
          continue;
        }

        const typed = payload as ApiResponse;
        successfulWallets.push({ address, results: typed.results });
        walletScans.push({
          address,
          ok: true,
          eligibleCount: typed.results.filter((r) => r.status === "eligible").length,
          likelyCount: typed.results.filter((r) => r.status === "likely").length,
        });
      } catch {
        walletScans.push({
          address,
          ok: false,
          error: "Network error",
          eligibleCount: 0,
          likelyCount: 0,
        });
      }
    }

    const aggregateResults = aggregateProfileResults(successfulWallets);
    setData(null);
    setGroupScan({
      profileName: profile.name,
      checkedAt: new Date().toISOString(),
      walletScans,
      aggregateResults,
    });
    setRunningProfileId(null);
  };

  const proRecipient = process.env.NEXT_PUBLIC_PRO_UPGRADE_WALLET;
  const showAdminTab = process.env.NEXT_PUBLIC_SHOW_ADMIN_TAB === "true";
  const proPaymentUri = proRecipient
    ? `solana:${proRecipient}?amount=0.02&label=Clutched%20Pro%20Scan&message=Unlock%20priority%20airdrop%20scanner&memo=pro-scan`
    : null;
  const activeResults = groupScan ? groupScan.aggregateResults : data?.results || [];
  const tableRows = useMemo(() => {
    const source = onlyEligible
      ? activeResults.filter((item) => item.status === "eligible" || item.status === "likely")
      : activeResults;
    return source.slice(0, 6).map((item, index) => {
      const date = new Date(Date.now() - index * 86_400_000 * 3);
      const amount = (item.confidence * (item.status === "eligible" ? 3.1 : 1.4)) / 10;
      const usd = amount * (item.status === "eligible" ? 0.34 : 0.19);
      return {
        id: item.id,
        date: date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
        project: item.project,
        asset: item.project.slice(0, 2).toUpperCase(),
        status: item.status === "eligible" ? "Eligible" : item.status === "likely" ? "Likely" : "Review",
        amount,
        usd,
      };
    });
  }, [activeResults, onlyEligible]);

  const totalValue = useMemo(() => {
    const value = tableRows.reduce((sum, row) => sum + row.usd, 0);
    return value > 0 ? value : 46.16;
  }, [tableRows]);

  const chartSeries = useMemo(() => {
    const multiplier = chartRange === "1M" ? 0.56 : chartRange === "1Y" ? 0.82 : 1;
    const rowValues = tableRows.length > 0
      ? tableRows.map((row, index) => row.usd + index * 3.5)
      : [0, 12, 24, 36, 46.16];
    return rowValues.map((value, index) => ({
      x: index,
      y: Number((value * multiplier).toFixed(2)),
    }));
  }, [tableRows, chartRange]);

  const chartPolyline = useMemo(() => {
    const width = 620;
    const height = 260;
    const padX = 24;
    const padY = 22;
    const maxY = Math.max(...chartSeries.map((point) => point.y), 46.16);
    const plotWidth = width - padX * 2;
    const plotHeight = height - padY * 2;
    const points = chartSeries.map((point, index) => {
      const x = padX + (chartSeries.length === 1 ? 0 : (index / (chartSeries.length - 1)) * plotWidth);
      const y = padY + plotHeight - (point.y / maxY) * plotHeight;
      return `${x},${y}`;
    });

    const last = points[points.length - 1]?.split(",") || ["0", "0"];
    return {
      width,
      height,
      points: points.join(" "),
      lastX: Number(last[0]),
      lastY: Number(last[1]),
    };
  }, [chartSeries]);

  const riskSummary = useMemo(
    () => ({
      safe: activeResults.filter((r) => r.claimSafety.grade === "safe").length,
      caution: activeResults.filter((r) => r.claimSafety.grade === "caution").length,
      risky: activeResults.filter((r) => r.claimSafety.grade === "risky").length,
    }),
    [activeResults],
  );

  return (
    <main className="page">
      <div className="app-shell">
        <aside className="side-rail left-rail">
          <section className="rail-card">
            <p className="eyebrow">Live Chain Rail</p>
            <h3>Solana Core</h3>
            <div className="rail-metrics">
              {pulseMetrics.slice(0, 4).map((item) => (
                <article key={item.label} className={`pulse-item ${item.tone ? `pulse-${item.tone}` : ""}`}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </article>
              ))}
            </div>
          </section>
          <section className="rail-card">
            <p className="eyebrow">Epoch Watch</p>
            <h3>Window</h3>
            <p className="reason">Best check window: last 24h before snapshot and first 48h after claim opens.</p>
          </section>
        </aside>

        <div className="main-column">
          <section className="news-banner" aria-label="Solana opportunity news ticker">
            {tickerItems.length > 0 ? (
              <div className="news-track">
                {[...tickerItems, ...tickerItems].map((item, index) => (
                  <a
                    key={`${item.id}-${index}`}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="news-item"
                  >
                    <span className="news-source">{item.sourceName}</span>
                    <span>{item.title}</span>
                  </a>
                ))}
              </div>
            ) : (
              <p className="news-fallback">Scanning Solana sources for new opportunities...</p>
            )}
          </section>

          <section className="pulse-strip" aria-label="Solana network pulse">
            {pulseMetrics.map((item) => (
              <article key={item.label} className={`pulse-item ${item.tone ? `pulse-${item.tone}` : ""}`}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </article>
            ))}
          </section>

          <section className="portfolio-board">
            <div className="board-left">
              <button type="button" className="board-back">← Back</button>
              <p className="eyebrow">Solana Airdrop Checker</p>
              <h2>You received ${totalValue.toFixed(2)} worth of Airdrop!</h2>
              <p className="subhead">
                Select your wallet and discover the airdrops you can claim across Solana protocols.
              </p>
              <div className="demo-row">
                <button type="button" className="ghost-btn" onClick={() => runDemo(demoProfiles.builder)}>
                  Demo: Builder Wallet
                </button>
                <button type="button" className="ghost-btn" onClick={() => runDemo(demoProfiles.newcomer)}>
                  Demo: Newcomer Wallet
                </button>
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
                  {loading ? "Checking..." : "Check Eligibility"}
                </button>
              </div>
              {walletAddress ? <p className="wallet">Wallet: {walletAddress}</p> : null}
              {error ? <p className="error">{error}</p> : null}
              <div className="board-filters">
                <span className="board-pill board-pill-active">All</span>
                <span className="board-pill">Upcoming</span>
                <span className="board-pill">Past</span>
                <span className="board-pill">History</span>
              </div>
            </div>
            <div className="board-right">
              <div className="board-chart-head">
                <div>
                  <span>Total value</span>
                  <strong>${totalValue.toFixed(2)}</strong>
                </div>
                <div className="chart-range">
                  {(["1M", "1Y", "ALL"] as const).map((range) => (
                    <button
                      key={range}
                      type="button"
                      className={chartRange === range ? "range-active" : ""}
                      onClick={() => setChartRange(range)}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>
              <svg viewBox={`0 0 ${chartPolyline.width} ${chartPolyline.height}`} aria-label="Airdrop value trend">
                <defs>
                  <linearGradient id="trendGlow" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="rgba(35,211,255,0.42)" />
                    <stop offset="100%" stopColor="rgba(35,211,255,0)" />
                  </linearGradient>
                </defs>
                <polyline fill="none" stroke="#23d3ff" strokeWidth="3" points={chartPolyline.points} />
                <circle cx={chartPolyline.lastX} cy={chartPolyline.lastY} r="8" fill="#071022" stroke="#23d3ff" strokeWidth="3" />
                <path
                  d={`M 24 ${chartPolyline.height - 20} L ${chartPolyline.points
                    .split(" ")
                    .map((point) => point.replace(",", " "))
                    .join(" L ")} L ${chartPolyline.width - 24} ${chartPolyline.height - 20} Z`}
                  fill="url(#trendGlow)"
                />
              </svg>
              <div className="board-toggle">
                <span>Only eligible</span>
                <button
                  type="button"
                  className={`toggle-switch ${onlyEligible ? "toggle-on" : ""}`}
                  onClick={() => setOnlyEligible((prev) => !prev)}
                  aria-pressed={onlyEligible}
                >
                  <span />
                </button>
              </div>
            </div>
            <div className="board-table-wrap">
              <table className="board-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Airdrop</th>
                    <th>Asset</th>
                    <th>Status</th>
                    <th>Amount</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.slice(0, 4).map((row) => (
                    <tr key={row.id}>
                      <td>{row.date}</td>
                      <td>{row.project}</td>
                      <td>{row.asset}</td>
                      <td>
                        <span className={`pill ${row.status === "Eligible" ? "pill-eligible" : "pill-likely"}`}>
                          {row.status}
                        </span>
                      </td>
                      <td>
                        {row.amount.toFixed(2)} {row.asset} <small>${row.usd.toFixed(2)}</small>
                      </td>
                      <td><button type="button" className="board-action">Track</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="pro-upgrade">
                <span>Pro Scan</span>
                {proPaymentUri ? (
                  <a href={proPaymentUri}>Pay with Solana Pay (0.02 SOL)</a>
                ) : null}
              </div>
            </div>
          </section>

          <section className="profile-panel">
        <h2>Wallet Profiles (Multi-Wallet)</h2>
        <p className="safety-note">Save profile groups locally and run one-click scans across multiple wallets.</p>
        <div className="profile-manager">
          <input
            type="text"
            placeholder="Profile name (example: Team Alpha)"
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
          />
          <div className="profile-wallet-add">
            <input
              type="text"
              placeholder="Wallet address"
              value={newWalletAddress}
              onChange={(e) => setNewWalletAddress(e.target.value)}
            />
            <button type="button" className="ghost-btn" onClick={addDraftWallet}>
              Add wallet
            </button>
          </div>
          {draftWallets.length > 0 ? (
            <div className="chip-row">
              {draftWallets.map((address) => (
                <button
                  type="button"
                  key={address}
                  className="profile-chip"
                  onClick={() => removeDraftWallet(address)}
                >
                  {address.slice(0, 4)}...{address.slice(-4)} x
                </button>
              ))}
            </div>
          ) : null}
          <button type="button" className="check-btn" onClick={saveProfile}>
            Save profile
          </button>
          {profileError ? <p className="error">{profileError}</p> : null}
        </div>

        {profiles.length > 0 ? (
          <div className="saved-profiles">
            {profiles.map((profile) => (
              <article key={profile.id} className="saved-profile-card">
                <div className="result-top-row">
                  <strong>{profile.name}</strong>
                  <span className="pill">{profile.wallets.length} wallets</span>
                </div>
                <div className="chip-row">
                  {profile.wallets.map((address) => (
                    <span key={address} className="proof-chip proof-met">
                      {address.slice(0, 4)}...{address.slice(-4)}
                    </span>
                  ))}
                </div>
                <div className="links-row">
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => runProfileScan(profile)}
                    disabled={runningProfileId === profile.id}
                  >
                    {runningProfileId === profile.id ? "Running..." : "Scan profile"}
                  </button>
                  <button type="button" className="ghost-btn" onClick={() => removeProfile(profile.id)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state">No saved profiles yet.</p>
        )}
          </section>

          {groupScan ? (
            <>
              <section className="summary-grid" aria-label="Profile scan summary">
                <article>
                  <span>Profile</span>
                  <strong>{groupScan.profileName}</strong>
                </article>
                <article>
                  <span>Wallets scanned</span>
                  <strong>{groupScan.walletScans.length}</strong>
                </article>
                <article>
                  <span>Healthy scans</span>
                  <strong>{groupScan.walletScans.filter((w) => w.ok).length}</strong>
                </article>
                <article>
                  <span>Scan Time</span>
                  <strong>{new Date(groupScan.checkedAt).toLocaleString()}</strong>
                </article>
              </section>

              <section className="results-shell">
                <h2>Wallet Status</h2>
                <ul className="result-list">
                  {groupScan.walletScans.map((scan) => (
                    <li key={scan.address} className="result-card">
                      <div className="result-top-row">
                        <strong>{scan.address}</strong>
                        <span className={`pill ${scan.ok ? "pill-eligible" : "pill-not_eligible"}`}>
                          {scan.ok ? "ok" : "failed"}
                        </span>
                      </div>
                      <p className="meta-row">
                        eligible {scan.eligibleCount} | likely {scan.likelyCount}
                      </p>
                      {scan.error ? <p className="reason">{scan.error}</p> : null}
                    </li>
                  ))}
                </ul>
              </section>

              <StatusTabs results={groupScan.aggregateResults} shareBaseUrl={shareBaseUrl} />
            </>
          ) : null}

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

              <StatusTabs results={data.results} shareBaseUrl={shareBaseUrl} />
            </>
          ) : null}
          {showAdminTab ? (
            <div className="admin-tab-wrap admin-tab-bottom">
              <a href="/admin" className="admin-tab-link">
                Admin
              </a>
            </div>
          ) : null}
          <footer className="credit">
            <span>Made with Love</span>
            <span className="credit-heart" aria-hidden="true">❤️</span>
            <span>by</span>
            <a href="https://x.com/notT0KY0" target="_blank" rel="noreferrer">
              @notT0KY0
            </a>
          </footer>
        </div>

        <aside className="side-rail right-rail">
          <section className="rail-card">
            <p className="eyebrow">Airdrop Radar</p>
            <h3>Fresh Leads</h3>
            <ul className="rail-list">
              {tickerItems.slice(0, 6).map((item) => (
                <li key={item.id}>
                  <a href={item.url} target="_blank" rel="noreferrer">
                    {item.title}
                  </a>
                </li>
              ))}
            </ul>
          </section>
          <section className="rail-card">
            <p className="eyebrow">Risk Sentinel</p>
            <h3>Claim Safety</h3>
            <div className="rail-metrics">
              <article className="pulse-item pulse-up">
                <span>Safe</span>
                <strong>{riskSummary.safe}</strong>
              </article>
              <article className="pulse-item">
                <span>Caution</span>
                <strong>{riskSummary.caution}</strong>
              </article>
              <article className="pulse-item pulse-down">
                <span>Risky</span>
                <strong>{riskSummary.risky}</strong>
              </article>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
