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
const NAV_TABS = ["Dashboard", "Airdrop Checker", "Address Book"] as const;
type NavTab = (typeof NAV_TABS)[number];

function isValidWalletAddress(address: string) {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export default function AirdropCheckerClient() {
  const { connected, publicKey } = useWallet();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [solPrice, setSolPrice] = useState<SolPriceResponse | null>(null);
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
  const [activeNav, setActiveNav] = useState<NavTab>("Airdrop Checker");
  const [activeFilter, setActiveFilter] = useState<"All" | "Upcoming" | "Past" | "History">("All");

  const walletAddress = useMemo(() => publicKey?.toBase58() ?? null, [publicKey]);

  const summary = useMemo(() => {
    if (!data) return null;
    return {
      eligible: data.results.filter((r) => r.status === "eligible").length,
      likely: data.results.filter((r) => r.status === "likely").length,
      watchlist: data.results.filter((r) => r.status === "unknown").length,
      checkedAt: new Date(data.checkedAt).toLocaleString(),
    };
  }, [data]);

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
    return { builder: builderProfile, newcomer: newcomerProfile };
  }, []);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      setShareBaseUrl(window.location.origin);
      try {
        const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as WalletProfileGroup[];
          if (Array.isArray(parsed)) setProfiles(parsed);
        }
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(profiles));
    } catch { /* non-blocking */ }
  }, [profiles, mounted]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/sol-price", { cache: "no-store" });
        if (!res.ok) return;
        const payload = (await res.json()) as SolPriceResponse;
        if (!cancelled) setSolPrice(payload);
      } catch { /* resilient */ }
    };
    void load();
    const timer = setInterval(() => void load(), 30000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

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
        asset: item.project.slice(0, 3).toUpperCase(),
        status: item.status === "eligible" ? "Eligible" : item.status === "likely" ? "Likely" : "Review",
        isEligible: item.status === "eligible",
        amount,
        usd,
        claimUrl: item.officialClaimUrl,
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
    const width = 560;
    const height = 200;
    const padX = 20;
    const padY = 20;
    const maxY = Math.max(...chartSeries.map((p) => p.y), 60);
    const plotWidth = width - padX * 2;
    const plotHeight = height - padY * 2;
    const points = chartSeries.map((point, index) => {
      const x = padX + (chartSeries.length === 1 ? 0 : (index / (chartSeries.length - 1)) * plotWidth);
      const y = padY + plotHeight - (point.y / maxY) * plotHeight;
      return `${x},${y}`;
    });
    const last = points[points.length - 1]?.split(",") || ["0", "0"];
    // Y axis labels
    const yLabels = [0, 15, 30, 45, 60].map((val) => ({
      val,
      y: padY + plotHeight - (val / maxY) * plotHeight,
    }));
    return { width, height, points: points.join(" "), lastX: Number(last[0]), lastY: Number(last[1]), yLabels };
  }, [chartSeries]);

  const runCheck = async () => {
    if (!walletAddress) { setError("Connect a wallet first."); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Failed to check eligibility");
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
    setData({ checkedAt: new Date().toISOString(), profile, results, safety: { readOnly: true, privateKeysRequested: false, note: "Demo mode loaded from local sample profiles." } });
    setError(null);
  };

  const addDraftWallet = () => {
    const value = newWalletAddress.trim();
    if (!value) return;
    if (!isValidWalletAddress(value)) { setProfileError("Wallet address is invalid."); return; }
    if (draftWallets.includes(value)) { setProfileError("Wallet already added."); return; }
    setDraftWallets((prev) => [...prev, value]);
    setNewWalletAddress("");
    setProfileError(null);
  };

  const saveProfile = () => {
    const name = newProfileName.trim();
    if (!name) { setProfileError("Profile name is required."); return; }
    if (draftWallets.length === 0) { setProfileError("Add at least one wallet."); return; }
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
    if (runningProfileId === profileId) setRunningProfileId(null);
  };

  const aggregateProfileResults = (walletResults: Array<{ address: string; results: AirdropEvaluation[] }>) => {
    const bestByProject = new Map<string, AirdropEvaluation>();
    const hits = new Map<string, Set<string>>();
    for (const wallet of walletResults) {
      for (const item of wallet.results) {
        if (!hits.has(item.id)) hits.set(item.id, new Set());
        hits.get(item.id)?.add(wallet.address);
        const current = bestByProject.get(item.id);
        if (!current || item.confidence > current.confidence) bestByProject.set(item.id, { ...item });
      }
    }
    const walletCount = Math.max(walletResults.length, 1);
    return Array.from(bestByProject.values())
      .map((item) => {
        const seen = hits.get(item.id)?.size || 0;
        return { ...item, reason: `${item.reason} | seen in ${seen}/${walletCount} wallets` };
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
        const res = await fetch("/api/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ walletAddress: address }) });
        const payload = await res.json();
        if (!res.ok) {
          walletScans.push({ address, ok: false, error: payload.error || "Check failed", eligibleCount: 0, likelyCount: 0 });
          continue;
        }
        const typed = payload as ApiResponse;
        successfulWallets.push({ address, results: typed.results });
        walletScans.push({ address, ok: true, eligibleCount: typed.results.filter((r) => r.status === "eligible").length, likelyCount: typed.results.filter((r) => r.status === "likely").length });
      } catch {
        walletScans.push({ address, ok: false, error: "Network error", eligibleCount: 0, likelyCount: 0 });
      }
    }
    const aggregateResults = aggregateProfileResults(successfulWallets);
    setData(null);
    setGroupScan({ profileName: profile.name, checkedAt: new Date().toISOString(), walletScans, aggregateResults });
    setRunningProfileId(null);
  };

  const proRecipient = process.env.NEXT_PUBLIC_PRO_UPGRADE_WALLET;
  const showAdminTab = process.env.NEXT_PUBLIC_SHOW_ADMIN_TAB === "true";
  const proPaymentUri = proRecipient
    ? `solana:${proRecipient}?amount=0.02&label=EpochRadar%20Pro&message=Unlock%20priority%20airdrop%20scanner&memo=pro-scan`
    : null;

  return (
    <>
      {/* ── Top Nav ── */}
      <nav className="top-nav">
        <div className="top-nav-inner">
          <span className="nav-logo">
            <span className="nav-logo-dot" />
            EpochRadar
          </span>
          <div className="nav-tabs">
            {NAV_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                className={`nav-tab ${activeNav === tab ? "nav-tab-active" : ""}`}
                onClick={() => setActiveNav(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="nav-right">
            {solPrice && (
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                SOL{" "}
                <span style={{ color: "#fff", fontWeight: 600 }}>${solPrice.priceUsd.toFixed(2)}</span>
                {" "}
                <span style={{ color: solPrice.change24h >= 0 ? "var(--brand)" : "var(--not)", fontSize: 11 }}>
                  {solPrice.change24h >= 0 ? "+" : ""}{solPrice.change24h.toFixed(2)}%
                </span>
              </span>
            )}
            {mounted ? <WalletMultiButton /> : (
              <button type="button" className="wallet-adapter-button" disabled>Loading…</button>
            )}
          </div>
        </div>
      </nav>

      {/* ── Page ── */}
      <main className="page">

        {/* ── Portfolio Board ── */}
        <section className="portfolio-board">
          <div className="board-top">
            {/* Left: headline + actions */}
            <div className="board-left">
              <button type="button" className="board-back">← Back</button>
              <p className="board-eyebrow">Solana Airdrop Checker</p>
              <h2 className="board-headline">
                You received <span style={{ color: "var(--brand)" }}>${totalValue.toFixed(2)}</span> worth of Airdrops!
              </h2>
              <p className="board-sub">
                Connect your wallet and discover the airdrops you can claim across Solana protocols. Read-only — no signing required.
              </p>

              {/* Share + wallet count */}
              <div className="board-actions">
                <button type="button" className="share-btn">
                  ↗ Share it!
                </button>
                <button type="button" className="wallet-select-btn">
                  {walletAddress ? `${shortAddr(walletAddress)} ▾` : "1 wallet ▾"}
                </button>
              </div>

              {/* Connect + check */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
                {mounted ? <WalletMultiButton /> : (
                  <button type="button" className="wallet-adapter-button" disabled>Loading…</button>
                )}
                <button type="button" className="check-btn" onClick={runCheck} disabled={!connected || loading}>
                  {loading ? "Checking…" : "Check Eligibility"}
                </button>
              </div>

              {/* Demo buttons */}
              <div className="demo-row">
                <button type="button" className="ghost-btn" onClick={() => runDemo(demoProfiles.builder)}>
                  Demo: Builder Wallet
                </button>
                <button type="button" className="ghost-btn" onClick={() => runDemo(demoProfiles.newcomer)}>
                  Demo: Newcomer Wallet
                </button>
              </div>

              {walletAddress && (
                <p className="wallet-address">Wallet: {walletAddress}</p>
              )}
              {error && <p className="error">{error}</p>}
            </div>

            {/* Right: chart */}
            <div className="board-right">
              <div className="board-chart-head">
                <div>
                  <p className="chart-total-label">Total value</p>
                  <p className="chart-total-value">${totalValue.toFixed(2)}</p>
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

              {/* Chart with Y-axis labels */}
              <svg viewBox={`0 0 ${chartPolyline.width} ${chartPolyline.height}`} aria-label="Airdrop value trend" style={{ overflow: "visible" }}>
                <defs>
                  <linearGradient id="chartFill" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="rgba(35,211,255,0.25)" />
                    <stop offset="100%" stopColor="rgba(35,211,255,0)" />
                  </linearGradient>
                </defs>
                {/* Y-axis labels */}
                {chartPolyline.yLabels.map(({ val, y }) => (
                  <text key={val} x={chartPolyline.width - 2} y={y + 4} textAnchor="end" fill="var(--muted)" fontSize="10">
                    ${val}
                  </text>
                ))}
                {/* Fill area */}
                <path
                  d={`M 20 ${chartPolyline.height - 20} L ${chartPolyline.points.split(" ").map((p) => p.replace(",", " ")).join(" L ")} L ${chartPolyline.width - 20} ${chartPolyline.height - 20} Z`}
                  fill="url(#chartFill)"
                />
                {/* Line */}
                <polyline fill="none" stroke="#23d3ff" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={chartPolyline.points} />
                {/* Dot at end */}
                <circle cx={chartPolyline.lastX} cy={chartPolyline.lastY} r="5" fill="#0d0d0d" stroke="#23d3ff" strokeWidth="2.5" />
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
          </div>

          {/* ── Filter tabs + table ── */}
          <div className="board-bottom">
            <div className="board-filters-row">
              <div className="board-filter-tabs">
                {(["All", "Upcoming", "Past", "History"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`board-pill ${activeFilter === f ? "board-pill-active" : ""}`}
                    onClick={() => setActiveFilter(f)}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Wallet row header */}
            {walletAddress && (
              <div className="wallet-row-header">
                <span className="wallet-row-addr">{walletAddress}</span>
                <span className="wallet-row-count">{tableRows.length} airdrop{tableRows.length !== 1 ? "s" : ""}</span>
              </div>
            )}

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
                  {tableRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", color: "var(--muted)", padding: "32px 14px" }}>
                        {data || groupScan ? "No eligible airdrops found." : "Connect your wallet and check eligibility to see results."}
                      </td>
                    </tr>
                  ) : (
                    tableRows.map((row) => (
                      <tr key={row.id}>
                        <td className="col-date">{row.date}</td>
                        <td style={{ fontWeight: 500 }}>{row.project}</td>
                        <td>
                          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, background: "var(--surface-2)", border: "1px solid var(--border)", fontSize: 10, fontWeight: 700, color: "var(--muted)" }}>
                            {row.asset}
                          </span>
                        </td>
                        <td>
                          <span className={`pill ${row.status === "Eligible" ? "pill-eligible" : row.status === "Likely" ? "pill-likely" : "pill-unknown"}`}>
                            {row.status}
                          </span>
                        </td>
                        <td>
                          <span>{row.amount.toFixed(2)} {row.asset}</span>
                          <small>${row.usd.toFixed(2)}</small>
                        </td>
                        <td>
                          {row.isEligible ? (
                            <a href={row.claimUrl} target="_blank" rel="noreferrer" className="board-action-claim">
                              Claimed
                            </a>
                          ) : (
                            <button type="button" className="board-action-track">Track</button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {proPaymentUri && (
              <div className="pro-upgrade">
                <span>Pro Scan —</span>
                <a href={proPaymentUri}>Pay with Solana Pay (0.02 SOL)</a>
              </div>
            )}
          </div>
        </section>

        {/* ── Wallet Profiles section ── */}
        <section className="profile-panel">
          <h2>Wallet Profiles</h2>
          <p className="safety-note">Save groups locally and run batch scans across multiple wallets.</p>
          <div className="profile-manager">
            <input
              type="text"
              placeholder="Profile name (e.g. Team Alpha)"
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
            {draftWallets.length > 0 && (
              <div className="chip-row">
                {draftWallets.map((address) => (
                  <button
                    type="button"
                    key={address}
                    className="profile-chip"
                    onClick={() => setDraftWallets((prev) => prev.filter((w) => w !== address))}
                  >
                    {shortAddr(address)} ×
                  </button>
                ))}
              </div>
            )}
            <button type="button" className="check-btn" style={{ width: "fit-content" }} onClick={saveProfile}>
              Save profile
            </button>
            {profileError && <p className="error">{profileError}</p>}
          </div>

          {profiles.length > 0 ? (
            <div className="saved-profiles">
              {profiles.map((profile) => (
                <article key={profile.id} className="saved-profile-card">
                  <div className="result-top-row">
                    <strong>{profile.name}</strong>
                    <span className="pill pill-likely">{profile.wallets.length} wallets</span>
                  </div>
                  <div className="chip-row">
                    {profile.wallets.map((address) => (
                      <span key={address} className="proof-chip proof-met">
                        {shortAddr(address)}
                      </span>
                    ))}
                  </div>
                  <div className="links-row" style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() => runProfileScan(profile)}
                      disabled={runningProfileId === profile.id}
                    >
                      {runningProfileId === profile.id ? "Running…" : "Scan profile"}
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

        {/* ── Group scan results ── */}
        {groupScan && (
          <>
            <div className="summary-grid" style={{ marginTop: 16 }}>
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
                <span>Scan time</span>
                <strong>{new Date(groupScan.checkedAt).toLocaleString()}</strong>
              </article>
            </div>

            <section className="results-shell">
              <h2>Wallet Status</h2>
              <ul className="result-list" style={{ marginTop: 14 }}>
                {groupScan.walletScans.map((scan) => (
                  <li key={scan.address} className="result-card">
                    <div className="result-top-row">
                      <strong style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{scan.address}</strong>
                      <span className={`pill ${scan.ok ? "pill-eligible" : "pill-not_eligible"}`}>
                        {scan.ok ? "ok" : "failed"}
                      </span>
                    </div>
                    <p className="meta-row">eligible {scan.eligibleCount} | likely {scan.likelyCount}</p>
                    {scan.error && <p className="reason">{scan.error}</p>}
                  </li>
                ))}
              </ul>
            </section>

            <StatusTabs results={groupScan.aggregateResults} shareBaseUrl={shareBaseUrl} />
          </>
        )}

        {/* ── Single wallet results ── */}
        {data && (
          <>
            {summary && (
              <div className="summary-grid" style={{ marginTop: 16 }}>
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
                  <span>Scan time</span>
                  <strong>{summary.checkedAt}</strong>
                </article>
              </div>
            )}

            <section className="profile-panel">
              <h2>Wallet snapshot</h2>
              <div className="metrics-grid">
                <article><span>SOL balance</span><strong>{data.profile.solBalance.toFixed(4)}</strong></article>
                <article><span>Token accounts</span><strong>{data.profile.tokenAccountsCount}</strong></article>
                <article><span>Approx NFTs</span><strong>{data.profile.nftApproxCount}</strong></article>
                <article><span>Recent tx</span><strong>{data.profile.recentTransactionCount}</strong></article>
              </div>
              <p className="safety-note">{data.safety.note}</p>
            </section>

            <StatusTabs results={data.results} shareBaseUrl={shareBaseUrl} />
          </>
        )}

        {showAdminTab && (
          <div className="admin-tab-wrap admin-tab-bottom">
            <a href="/admin" className="admin-tab-link">Admin</a>
          </div>
        )}

        <footer className="credit">
          <span>Made with ❤️ by</span>
          <a href="https://x.com/notT0KY0" target="_blank" rel="noreferrer">@notT0KY0</a>
        </footer>
      </main>
    </>
  );
}
