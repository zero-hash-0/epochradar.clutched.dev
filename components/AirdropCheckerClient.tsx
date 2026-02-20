"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { AirdropEvaluation, PastAirdrop, WalletProfile } from "@/lib/types";
import { AIRDROP_RULES } from "@/lib/airdrops";
import StatusTabs from "@/components/StatusTabs";
import AddressBook from "@/components/AddressBook";
import { evaluateWalletAirdrops } from "@/lib/evaluator";
import { drawShareCard } from "@/lib/shareCard";

/* ─── Types ─────────────────────────────────────────── */
type ApiResponse = {
  checkedAt: string;
  profile: WalletProfile;
  results: AirdropEvaluation[];
  safety: { readOnly: boolean; privateKeysRequested: boolean; note: string };
};
type SolPriceResponse = { symbol: "SOL"; priceUsd: number; change24h: number; asOf: string };
type TickerItem = { id: string; title: string; url: string; sourceName: string };
type WalletProfileGroup = { id: string; name: string; wallets: string[]; createdAt: string };
type WalletScan = { address: string; ok: boolean; error?: string; eligibleCount: number; likelyCount: number };
type GroupScanResult = { profileName: string; checkedAt: string; walletScans: WalletScan[]; aggregateResults: AirdropEvaluation[] };
type HistoryResponse = { walletAddress: string; checkedAt: string; pastAirdrops: PastAirdrop[]; totalReceived: number };

const PROFILES_KEY  = "airdrop_wallet_profiles_v1";
const PROFILE_PIC_KEY = "epochradar_profile_pic_v1";
const NAV_TABS = ["Dashboard", "Airdrop Checker", "Address Book"] as const;
type NavTab = (typeof NAV_TABS)[number];

const AVATAR_COLORS = ["#FFD700", "#14f195", "#23d3ff", "#9945ff", "#f97316", "#ec4899"];
const CAT_COLORS: Record<string, string> = { defi: "#FFD700", nft: "#9945ff", infrastructure: "#23d3ff", consumer: "#f97316" };

function avatarColor(addr: string) { return AVATAR_COLORS[addr.charCodeAt(0) % AVATAR_COLORS.length]; }
function shortAddr(addr: string) { return `${addr.slice(0, 4)}...${addr.slice(-4)}`; }
function isValid(address: string) { try { new PublicKey(address); return true; } catch { return false; } }

/* Parse a "$X–$Y" range string and return midpoint number */
function parseValueMid(val?: string): number {
  if (!val) return 0;
  const nums = val.match(/\d[\d,]*/g)?.map((n) => parseInt(n.replace(/,/g, ""), 10)) ?? [];
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/* ─── Fallback static ticker items ─────────────────── */
const STATIC_TICKER: TickerItem[] = [
  { id: "t1", title: "Jupiter Season 2 snapshot window opens March 15", url: "https://jup.ag", sourceName: "Jupiter" },
  { id: "t2", title: "Drift Protocol claim portal now live for eligible traders", url: "https://drift.trade", sourceName: "Drift" },
  { id: "t3", title: "Kamino Finance airdrop snapshot taken — check eligibility now", url: "https://kamino.finance", sourceName: "Kamino" },
  { id: "t4", title: "Tensor Loyalty rewards distribution begins March 1", url: "https://tensor.trade", sourceName: "Tensor" },
  { id: "t5", title: "Raydium LP airdrop for CLMM providers — claim opens March 10", url: "https://raydium.io", sourceName: "Raydium" },
  { id: "t6", title: "marginfi early user airdrop announced — $200–$1000 estimated", url: "https://marginfi.com", sourceName: "marginfi" },
  { id: "t7", title: "Pyth Network staking rewards distribution in progress", url: "https://pyth.network", sourceName: "Pyth" },
  { id: "t8", title: "Magic Eden seasonal rewards for NFT traders available", url: "https://magiceden.io", sourceName: "Magic Eden" },
  { id: "t9", title: "Marinade Finance mSOL stakers airdrop — snapshot April 1", url: "https://marinade.finance", sourceName: "Marinade" },
  { id: "t10", title: "Orca Whirlpool LP rewards program announced for Q2 2026", url: "https://orca.so", sourceName: "Orca" },
];

/* ─── Main Component ─────────────────────────────────── */
export default function AirdropCheckerClient() {
  const { connected, publicKey } = useWallet();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [solPrice, setSolPrice] = useState<SolPriceResponse | null>(null);
  const [tickerItems, setTickerItems] = useState<TickerItem[]>(STATIC_TICKER);
  const [shareBaseUrl, setShareBaseUrl] = useState("https://epochradar.com");
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
  const [showShare, setShowShare] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareDownloaded, setShareDownloaded] = useState(false);
  const [shareSaved, setShareSaved] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const profilePicInputRef = useRef<HTMLInputElement>(null);
  const shareCanvasRef = useRef<HTMLCanvasElement>(null);
  const [explorerFilter, setExplorerFilter] = useState<"all" | "defi" | "nft" | "infrastructure" | "consumer">("all");
  const [historyData, setHistoryData] = useState<HistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const walletAddress = useMemo(() => publicKey?.toBase58() ?? null, [publicKey]);
  const avatarInitials = walletAddress ? walletAddress.slice(0, 2).toUpperCase() : "ER";
  const avatarBg = walletAddress ? avatarColor(walletAddress) : "#14f195";

  /* ── Boot ── */
  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      setShareBaseUrl(window.location.origin);
      try {
        const raw = localStorage.getItem(PROFILES_KEY);
        if (raw) { const p = JSON.parse(raw) as WalletProfileGroup[]; if (Array.isArray(p)) setProfiles(p); }
      } catch { /* ignore */ }
      try {
        const pic = localStorage.getItem(PROFILE_PIC_KEY);
        if (pic) setProfilePic(pic);
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try { localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles)); } catch { /* ignore */ }
  }, [profiles, mounted]);

  /* ── PWA install prompt ── */
  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e); setShowInstall(true); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  /* ── SOL price ── */
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/sol-price", { cache: "no-store" });
        if (!res.ok) return;
        const p = (await res.json()) as SolPriceResponse;
        if (!cancelled) setSolPrice(p);
      } catch { /* resilient */ }
    };
    void load();
    const t = setInterval(() => void load(), 30000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  /* ── Discovery ticker ── */
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/discovery", { cache: "no-store" });
        if (!res.ok) return;
        const payload = (await res.json()) as { leads?: TickerItem[] };
        const leads = payload.leads?.slice(0, 14);
        if (!cancelled && leads && leads.length > 0) setTickerItems(leads);
      } catch { /* fallback to static */ }
    };
    void load();
    const t = setInterval(() => void load(), 120000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  /* ── Demo profiles ── */
  const demoProfiles = useMemo(() => ({
    builder: { address: "DemoBuilder1111111111111111111111111111111111", solBalance: 4.25, tokenSymbols: ["USDC", "JUP", "BONK", "DRFT"], tokenAccountsCount: 11, nftApproxCount: 3, recentTransactionCount: 72, accountAgeDays: 420, lastActiveDays: 2 },
    newcomer: { address: "DemoNewbie11111111111111111111111111111111111", solBalance: 0.03, tokenSymbols: ["USDC"], tokenAccountsCount: 1, nftApproxCount: 0, recentTransactionCount: 4, accountAgeDays: 16, lastActiveDays: 1 },
  }), []);

  /* ── Active results ── */
  const activeResults = groupScan ? groupScan.aggregateResults : data?.results ?? [];

  /* ── Table rows ── */
  const tableRows = useMemo(() => {
    const source = onlyEligible
      ? activeResults.filter((r) => r.status === "eligible" || r.status === "likely")
      : activeResults;
    return source.slice(0, 8).map((item, i) => {
      const date = new Date(Date.now() - i * 86_400_000 * 3);
      const amount = (item.confidence * (item.status === "eligible" ? 3.1 : 1.4)) / 10;
      const usd = amount * (item.status === "eligible" ? 0.34 : 0.19);
      return {
        id: item.id, project: item.project,
        asset: item.project.slice(0, 3).toUpperCase(),
        date: date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
        status: item.status === "eligible" ? "Eligible" : item.status === "likely" ? "Likely" : "Review",
        isEligible: item.status === "eligible",
        amount, usd, claimUrl: item.officialClaimUrl,
        estimatedValue: item.estimatedValue,
      };
    });
  }, [activeResults, onlyEligible]);

  /* Use midpoint of estimatedValue ranges for a realistic total */
  const totalValue = useMemo(() => {
    if (tableRows.length === 0) return 0;
    const v = tableRows.reduce((s, r) => {
      const mid = parseValueMid(r.estimatedValue);
      return s + (mid > 0 ? mid : r.usd);
    }, 0);
    return v;
  }, [tableRows]);

  const summary = useMemo(() => {
    if (!data) return null;
    return {
      eligible: data.results.filter((r) => r.status === "eligible").length,
      likely: data.results.filter((r) => r.status === "likely").length,
      watchlist: data.results.filter((r) => r.status === "unknown").length,
      checkedAt: new Date(data.checkedAt).toLocaleString(),
    };
  }, [data]);

  /* ── Chart ── */
  const chartSeries = useMemo(() => {
    const mult = chartRange === "1M" ? 0.56 : chartRange === "1Y" ? 0.82 : 1;
    const vals = tableRows.length > 0 ? tableRows.map((r, i) => r.usd + i * 3.5) : [0, 12, 24, 36, 46.16];
    return vals.map((v, i) => ({ x: i, y: Number((v * mult).toFixed(2)) }));
  }, [tableRows, chartRange]);

  const chartPolyline = useMemo(() => {
    const width = 520, height = 200, padLeft = 36, padRight = 12, padTop = 16, padBottom = 16;
    const maxY = Math.max(...chartSeries.map((p) => p.y), 60);
    const pw = width - padLeft - padRight, ph = height - padTop - padBottom;
    const points = chartSeries.map((p, i) => ({
      x: padLeft + (chartSeries.length === 1 ? pw / 2 : (i / (chartSeries.length - 1)) * pw),
      y: padTop + ph - (p.y / maxY) * ph,
    }));
    const last = points[points.length - 1] ?? { x: padLeft, y: padTop + ph };
    const pointsStr = points.map((p) => `${p.x},${p.y}`).join(" ");
    const fillPath = `M ${padLeft} ${padTop + ph} L ${points.map((p) => `${p.x} ${p.y}`).join(" L ")} L ${last.x} ${padTop + ph} Z`;
    const yLabels = [0, 15, 30, 45, 60].map((val) => ({ val, y: padTop + ph - (val / maxY) * ph }));
    return { width, height, pointsStr, fillPath, lastX: last.x, lastY: last.y, yLabels };
  }, [chartSeries]);

  /* ── Actions ── */
  const runCheck = async () => {
    if (!walletAddress) { setError("Connect a wallet first."); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ walletAddress }) });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Failed to check eligibility");
      setGroupScan(null); setData(payload as ApiResponse);
    } catch (err) { setError(err instanceof Error ? err.message : "Unknown error"); }
    finally { setLoading(false); }
  };

  const fetchHistory = async (addr?: string) => {
    const address = addr ?? walletAddress;
    if (!address) { setHistoryError("Connect a wallet first."); return; }
    setHistoryLoading(true); setHistoryError(null);
    try {
      const res = await fetch("/api/history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ walletAddress: address }) });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Failed to fetch history");
      setHistoryData(payload as HistoryResponse);
    } catch (err) { setHistoryError(err instanceof Error ? err.message : "Unknown error"); }
    finally { setHistoryLoading(false); }
  };

  const runDemo = (profile: WalletProfile) => {
    setGroupScan(null);
    setData({ checkedAt: new Date().toISOString(), profile, results: evaluateWalletAirdrops(profile, AIRDROP_RULES), safety: { readOnly: true, privateKeysRequested: false, note: "Demo mode — sample wallet profile." } });
    setError(null);
  };

  const aggregateProfileResults = useCallback((walletResults: Array<{ address: string; results: AirdropEvaluation[] }>) => {
    const best = new Map<string, AirdropEvaluation>(), hits = new Map<string, Set<string>>();
    for (const w of walletResults) {
      for (const item of w.results) {
        if (!hits.has(item.id)) hits.set(item.id, new Set());
        hits.get(item.id)?.add(w.address);
        const cur = best.get(item.id);
        if (!cur || item.confidence > cur.confidence) best.set(item.id, { ...item });
      }
    }
    const wc = Math.max(walletResults.length, 1);
    return Array.from(best.values()).map((item) => ({ ...item, reason: `${item.reason} | seen in ${hits.get(item.id)?.size ?? 0}/${wc} wallets` })).sort((a, b) => b.confidence - a.confidence);
  }, []);

  const runProfileScan = async (profile: WalletProfileGroup) => {
    setRunningProfileId(profile.id); setError(null); setProfileError(null);
    const walletScans: WalletScan[] = [], successful: Array<{ address: string; results: AirdropEvaluation[] }> = [];
    for (const address of profile.wallets) {
      try {
        const res = await fetch("/api/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ walletAddress: address }) });
        const payload = await res.json();
        if (!res.ok) { walletScans.push({ address, ok: false, error: payload.error || "Check failed", eligibleCount: 0, likelyCount: 0 }); continue; }
        const typed = payload as ApiResponse;
        successful.push({ address, results: typed.results });
        walletScans.push({ address, ok: true, eligibleCount: typed.results.filter((r) => r.status === "eligible").length, likelyCount: typed.results.filter((r) => r.status === "likely").length });
      } catch { walletScans.push({ address, ok: false, error: "Network error", eligibleCount: 0, likelyCount: 0 }); }
    }
    setData(null); setGroupScan({ profileName: profile.name, checkedAt: new Date().toISOString(), walletScans, aggregateResults: aggregateProfileResults(successful) });
    setRunningProfileId(null);
  };

  const handleShare = () => {
    // Auto-save immediately + show preview modal
    renderAndSave();
    setShowShare(true);
  };

  const copyShareUrl = async () => {
    try { await navigator.clipboard.writeText(shareBaseUrl); setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); } catch { /* ignore */ }
  };

  /* ── Build share card data ── */
  const buildCardData = useCallback(() => ({
    walletAddress,
    eligibleCount: tableRows.filter((r) => r.isEligible).length,
    likelyCount: tableRows.filter((r) => r.status === "Likely").length,
    totalValue,
    topAirdrops: tableRows.slice(0, 4).map((r) => ({
      project: r.project,
      status: r.status,
      estimatedValue: r.estimatedValue,
    })),
    solPrice: solPrice?.priceUsd,
    profilePic: profilePic ?? undefined,
  }), [walletAddress, tableRows, totalValue, solPrice, profilePic]);

  /* ── Draw onto hidden canvas then auto-save PNG ── */
  const renderAndSave = useCallback(() => {
    const canvas = shareCanvasRef.current;
    if (!canvas) return;
    const cardData = buildCardData();

    const finish = (sponge?: HTMLImageElement, profImg?: HTMLImageElement) => {
      drawShareCard(canvas, cardData, sponge, profImg);
      // auto-save
      const link = document.createElement("a");
      link.download = `epochradar-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      setShareSaved(true);
      setTimeout(() => setShareSaved(false), 2500);
    };

    // Load SpongeBob bg
    const sponge = new window.Image();
    sponge.crossOrigin = "anonymous";
    sponge.onload = () => {
      if (profilePic) {
        const profImg = new window.Image();
        profImg.onload = () => finish(sponge, profImg);
        profImg.onerror = () => finish(sponge);
        profImg.src = profilePic;
      } else {
        finish(sponge);
      }
    };
    sponge.onerror = () => {
      if (profilePic) {
        const profImg = new window.Image();
        profImg.onload = () => finish(undefined, profImg);
        profImg.onerror = () => finish();
        profImg.src = profilePic;
      } else {
        finish();
      }
    };
    sponge.src = "/share-bg.jpg";
  }, [buildCardData, profilePic]);

  /* ── Draw share card whenever modal opens (for preview) ── */
  useEffect(() => {
    if (!showShare || !shareCanvasRef.current) return;
    const cardData = buildCardData();
    const sponge = new window.Image();
    sponge.crossOrigin = "anonymous";
    sponge.onload = () => {
      if (profilePic) {
        const profImg = new window.Image();
        profImg.onload = () => drawShareCard(shareCanvasRef.current!, cardData, sponge, profImg);
        profImg.onerror = () => drawShareCard(shareCanvasRef.current!, cardData, sponge);
        profImg.src = profilePic;
      } else {
        drawShareCard(shareCanvasRef.current!, cardData, sponge);
      }
    };
    sponge.onerror = () => drawShareCard(shareCanvasRef.current!, cardData);
    sponge.src = "/share-bg.jpg";
  }, [showShare, buildCardData, profilePic]);

  const downloadShareCard = () => {
    const canvas = shareCanvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `epochradar-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    setShareDownloaded(true);
    setTimeout(() => setShareDownloaded(false), 2500);
  };

  const shareCardToX = () => {
    const text = `🪂 I found ${tableRows.filter((r) => r.isEligible).length} eligible Solana airdrops worth $${totalValue.toFixed(2)}! Check yours on EpochRadar:`;
    window.open(
      `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareBaseUrl)}`,
      "_blank",
      "noreferrer",
    );
    setShowShare(false);
  };

  /* ── Profile pic upload ── */
  const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setProfilePic(dataUrl);
      try { localStorage.setItem(PROFILE_PIC_KEY, dataUrl); } catch { /* ignore */ }
    };
    reader.readAsDataURL(file);
  };

  const removeProfilePic = () => {
    setProfilePic(null);
    try { localStorage.removeItem(PROFILE_PIC_KEY); } catch { /* ignore */ }
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (deferredPrompt as any).prompt?.();
    setDeferredPrompt(null); setShowInstall(false);
  };

  const saveProfile = () => {
    const name = newProfileName.trim();
    if (!name) { setProfileError("Profile name is required."); return; }
    if (draftWallets.length === 0) { setProfileError("Add at least one wallet."); return; }
    setProfiles((prev) => [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name, wallets: draftWallets, createdAt: new Date().toISOString() }, ...prev]);
    setNewProfileName(""); setNewWalletAddress(""); setDraftWallets([]); setProfileError(null);
  };

  const proRecipient = process.env.NEXT_PUBLIC_PRO_UPGRADE_WALLET;
  const showAdminTab = process.env.NEXT_PUBLIC_SHOW_ADMIN_TAB === "true";
  const proPaymentUri = proRecipient ? `solana:${proRecipient}?amount=0.02&label=EpochRadar%20Pro&message=Unlock%20priority%20scanner&memo=pro-scan` : null;

  /* ── Explorer airdrop list ── */
  const explorerRules = useMemo(() =>
    AIRDROP_RULES.filter((r) => explorerFilter === "all" || r.category === explorerFilter),
    [explorerFilter],
  );

  /* ─── Render ─────────────────────────────────────── */
  return (
    <>
      {/* ── Ambient glow orbs ── */}
      <div className="glow-orbs" aria-hidden="true">
        <div className="glow-orb glow-orb-1" />
        <div className="glow-orb glow-orb-2" />
        <div className="glow-orb glow-orb-3" />
      </div>

      {/* ── Auto-save toast ── */}
      {shareSaved && (
        <div className="save-toast">✓ Card saved to your downloads!</div>
      )}

      {/* ── Share modal ── */}
      {showShare && (
        <div className="modal-backdrop" onClick={() => setShowShare(false)}>
          <div className="share-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="share-modal-header">
              <div>
                <h2 className="modal-title">🏆 Your Airdrop Card</h2>
                <p className="modal-sub">Image saved automatically. Share or post it below.</p>
              </div>
              <button type="button" className="modal-close" onClick={() => setShowShare(false)}>×</button>
            </div>

            {/* Live canvas preview rendered inside modal */}
            <div className="share-canvas-wrap">
              <canvas
                ref={(el) => {
                  // Sync ref — canvas is hidden elsewhere; this one is the preview
                  if (el && shareCanvasRef.current && shareCanvasRef.current !== el) {
                    el.width = shareCanvasRef.current.width;
                    el.height = shareCanvasRef.current.height;
                    el.getContext("2d")?.drawImage(shareCanvasRef.current, 0, 0);
                  }
                }}
                className="share-canvas"
              />
            </div>

            {/* Actions */}
            <div className="share-modal-actions">
              <button type="button" className="share-dl-btn" onClick={downloadShareCard}>
                <span className="share-option-icon">⬇</span>
                {shareDownloaded ? "Saved!" : "Save again"}
              </button>
              <button type="button" className="share-x-btn" onClick={shareCardToX}>
                <span className="share-option-icon" style={{ fontFamily: "serif" }}>𝕏</span>
                Post on X
              </button>
              <button type="button" className="share-copy-btn" onClick={copyShareUrl}>
                <span className="share-option-icon">🔗</span>
                {shareCopied ? "Copied!" : "Copy link"}
              </button>
            </div>
            <div className="share-url-box">
              <input className="share-url-input" readOnly value={shareBaseUrl} />
            </div>
          </div>
        </div>
      )}

      {/* ── Top Nav ── */}
      <nav className="top-nav">
        <div className="top-nav-inner">
          <span className="nav-logo">
            <span className="nav-logo-dot" />
            EpochRadar
          </span>
          <div className="nav-tabs">
            {NAV_TABS.map((tab) => (
              <button key={tab} type="button" className={`nav-tab ${activeNav === tab ? "nav-tab-active" : ""}`} onClick={() => setActiveNav(tab)}>
                {tab}
              </button>
            ))}
          </div>
          <div className="nav-right">
            {solPrice && (
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                SOL <span style={{ color: "#fff", fontWeight: 600 }}>${solPrice.priceUsd.toFixed(2)}</span>{" "}
                <span style={{ color: solPrice.change24h >= 0 ? "var(--brand)" : "var(--not)", fontSize: 11 }}>
                  {solPrice.change24h >= 0 ? "+" : ""}{solPrice.change24h.toFixed(2)}%
                </span>
              </span>
            )}
            {mounted ? <WalletMultiButton /> : <button type="button" className="wallet-adapter-button" disabled>Loading…</button>}
            {/* Avatar / Profile Pic */}
            {mounted && (
              <div className="avatar-wrap" title="Click to change profile picture" onClick={() => profilePicInputRef.current?.click()} style={{ cursor: "pointer" }}>
                <input
                  ref={profilePicInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleProfilePicChange}
                />
                {profilePic ? (
                  <div className="avatar-ring avatar-ring-pic" style={{ border: `2px solid #FFD700`, padding: 0, overflow: "hidden" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={profilePic} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                  </div>
                ) : (
                  <div
                    className="avatar-ring"
                    style={{ background: `${avatarBg}22`, border: `1.5px solid #FFD70066`, color: "#FFD700" }}
                  >
                    <div className="avatar-glow-ring" />
                    {avatarInitials}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hidden canvas for share card rendering ── */}
      <canvas ref={shareCanvasRef} style={{ display: "none" }} />

      {/* ── Page ── */}
      <main className="page">

        {/* ── PWA install banner ── */}
        {showInstall && (
          <div className="install-banner">
            <p className="install-banner-text">
              <strong>Add to Home Screen</strong> — Use EpochRadar as an app for quick access to your airdrop radar.
            </p>
            <button type="button" className="install-btn" onClick={handleInstall}>📲 Install</button>
            <button type="button" className="install-dismiss" onClick={() => setShowInstall(false)}>×</button>
          </div>
        )}

        {/* ── News ticker ── */}
        <div className="news-banner" aria-label="Solana airdrop news">
          <span className="news-banner-label">Live</span>
          <div className="news-track-wrap">
            <div className="news-track">
              {[...tickerItems, ...tickerItems].map((item, i) => (
                <a key={`${item.id}-${i}`} href={item.url} target="_blank" rel="noreferrer" className="news-item">
                  <span className="news-source-badge">{item.sourceName}</span>
                  <span className="news-dot" />
                  <span>{item.title}</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════
            DASHBOARD TAB
        ════════════════════════════════════════════ */}
        {activeNav === "Dashboard" && (
          <section>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#fff" }}>Airdrop Explorer</h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>{AIRDROP_RULES.length} active opportunities tracked on Solana</p>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["all", "defi", "nft", "infrastructure", "consumer"] as const).map((f) => (
                  <button key={f} type="button" className={`board-pill ${explorerFilter === f ? "board-pill-active" : ""}`} onClick={() => setExplorerFilter(f)}>
                    {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="explorer-grid">
              {explorerRules.map((rule) => {
                const col = CAT_COLORS[rule.category] ?? "#14f195";
                return (
                  <article key={rule.id} className="explorer-card">
                    <div className="explorer-card-glow" style={{ background: `radial-gradient(circle at 0% 0%, ${col}12, transparent 60%)` }} />
                    <div className="ec-top">
                      <div className="ec-logo" style={{ background: `${col}18`, color: col }}>
                        {rule.project.slice(0, 2).toUpperCase()}
                      </div>
                      <span className={`ec-status ec-status-${rule.status}`}>
                        {rule.status.replace("_", " ")}
                      </span>
                    </div>
                    <div className="ec-name">{rule.project}</div>
                    <div className="ec-desc">{rule.description ?? `${rule.category} airdrop on Solana.`}</div>
                    {rule.tags && rule.tags.length > 0 && (
                      <div className="ec-tags">{rule.tags.map((t) => <span key={t} className="ec-tag">{t}</span>)}</div>
                    )}
                    <div className="ec-footer">
                      {rule.estimatedValue
                        ? <span className="ec-value">{rule.estimatedValue}</span>
                        : <span className="ec-value">Est. value TBD</span>
                      }
                      <span className={`ec-risk ec-risk-${rule.riskLevel}`}>
                        {rule.riskLevel} risk
                      </span>
                    </div>
                    <div className="ec-links">
                      <a href={rule.officialClaimUrl} target="_blank" rel="noreferrer">Official ↗</a>
                      <a href={rule.sourceUrl} target="_blank" rel="noreferrer">Source ↗</a>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════
            AIRDROP CHECKER TAB
        ════════════════════════════════════════════ */}
        {activeNav === "Airdrop Checker" && (
          <>
            {/* ── Portfolio board ── */}
            <section className="portfolio-board">
              <div className="board-top">
                {/* Left */}
                <div className="board-left">
                  <button type="button" className="board-back">← Back</button>
                  <p className="board-eyebrow">Solana Airdrop Checker</p>
                  <h2 className="board-headline">
                    {totalValue > 0
                      ? <>You have <span className="gold-value">${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> in eligible airdrops!</>
                      : <>Connect wallet to see <span className="gold-value">your airdrops</span></>
                    }
                  </h2>
                  <p className="board-sub">
                    Connect your wallet and discover airdrops you can claim across Solana protocols. Read-only — no signing required.
                  </p>

                  <div className="board-actions">
                    <button type="button" className="share-btn" onClick={handleShare}>↗ Share it!</button>
                    <button type="button" className="wallet-select-btn">
                      {walletAddress ? `${shortAddr(walletAddress)} ▾` : "1 wallet ▾"}
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
                    <button type="button" className="check-btn" onClick={runCheck} disabled={!connected || loading}>
                      {loading ? "Checking…" : "Check Eligibility"}
                    </button>
                  </div>

                  <div className="demo-row">
                    <button type="button" className="ghost-btn" onClick={() => runDemo(demoProfiles.builder)}>Demo: Builder</button>
                    <button type="button" className="ghost-btn" onClick={() => runDemo(demoProfiles.newcomer)}>Demo: Newcomer</button>
                  </div>
                  {walletAddress && <p className="wallet-address">Wallet: {walletAddress}</p>}
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
                      {(["1M", "1Y", "ALL"] as const).map((r) => (
                        <button key={r} type="button" className={chartRange === r ? "range-active" : ""} onClick={() => setChartRange(r)}>{r}</button>
                      ))}
                    </div>
                  </div>
                  <svg viewBox={`0 0 ${chartPolyline.width} ${chartPolyline.height}`} aria-label="Airdrop value trend">
                    <defs>
                      <linearGradient id="chartFill" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="rgba(35,211,255,0.22)" />
                        <stop offset="100%" stopColor="rgba(35,211,255,0)" />
                      </linearGradient>
                    </defs>
                    {chartPolyline.yLabels.map(({ val, y }) => (
                      <text key={val} x={32} y={y + 4} textAnchor="end" fill="#555" fontSize="9" fontFamily="ui-monospace,monospace">${val}</text>
                    ))}
                    <path d={chartPolyline.fillPath} fill="url(#chartFill)" />
                    <polyline fill="none" stroke="#23d3ff" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={chartPolyline.pointsStr} />
                    <circle cx={chartPolyline.lastX} cy={chartPolyline.lastY} r="4" fill="#161616" stroke="#23d3ff" strokeWidth="2" />
                  </svg>
                  <div className="board-toggle">
                    <span>Only eligible</span>
                    <button type="button" className={`toggle-switch ${onlyEligible ? "toggle-on" : ""}`} onClick={() => setOnlyEligible((p) => !p)} aria-pressed={onlyEligible}>
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
                      <button key={f} type="button" className={`board-pill ${activeFilter === f ? "board-pill-active" : ""}`} onClick={() => {
                        setActiveFilter(f);
                        if (f === "History" && !historyData && !historyLoading) void fetchHistory();
                      }}>{f}</button>
                    ))}
                  </div>
                </div>
                {walletAddress && (
                  <div className="wallet-row-header">
                    <span className="wallet-row-addr">{walletAddress}</span>
                    <span className="wallet-row-count">{tableRows.length} airdrop{tableRows.length !== 1 ? "s" : ""}</span>
                  </div>
                )}
                {activeFilter === "History" ? (
                  /* ── Past on-chain airdrop history ── */
                  <div className="history-panel">
                    <div className="history-panel-header">
                      <div>
                        <h3 className="history-title">📬 On-Chain Token History</h3>
                        <p className="history-sub">
                          Real token transfers received by this wallet — sourced directly from Solana blockchain.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => void fetchHistory()}
                        disabled={historyLoading}
                      >
                        {historyLoading ? "Scanning…" : "↻ Refresh"}
                      </button>
                    </div>

                    {!walletAddress && !historyData && (
                      <div className="history-empty">
                        <span className="history-empty-icon">🔗</span>
                        <p>Connect your wallet to see your real on-chain airdrop history.</p>
                      </div>
                    )}

                    {historyLoading && (
                      <div className="history-loading">
                        <div className="history-spinner" />
                        <p>Scanning on-chain transactions… this may take a few seconds.</p>
                      </div>
                    )}

                    {historyError && (
                      <p className="error" style={{ marginTop: 12 }}>{historyError}</p>
                    )}

                    {historyData && !historyLoading && (
                      <>
                        <div className="history-stats-row">
                          <div className="history-stat-pill">
                            <span className="history-stat-label">Total Events</span>
                            <span className="history-stat-val">{historyData.pastAirdrops.length}</span>
                          </div>
                          <div className="history-stat-pill">
                            <span className="history-stat-label">Likely Airdrops</span>
                            <span className="history-stat-val" style={{ color: "#14F195" }}>{historyData.totalReceived}</span>
                          </div>
                          <div className="history-stat-pill">
                            <span className="history-stat-label">Unique Tokens</span>
                            <span className="history-stat-val" style={{ color: "#FFD700" }}>
                              {new Set(historyData.pastAirdrops.map((p) => p.mint)).size}
                            </span>
                          </div>
                          <div className="history-stat-pill">
                            <span className="history-stat-label">Scanned At</span>
                            <span className="history-stat-val" style={{ fontSize: 11 }}>
                              {new Date(historyData.checkedAt).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>

                        {historyData.pastAirdrops.length === 0 ? (
                          <div className="history-empty">
                            <span className="history-empty-icon">🪂</span>
                            <p>No incoming token transfers found in the last 50 transactions.</p>
                          </div>
                        ) : (
                          <div className="board-table-wrap">
                            <table className="board-table">
                              <thead>
                                <tr>
                                  <th>Date</th>
                                  <th>Token</th>
                                  <th>Amount</th>
                                  <th>Type</th>
                                  <th>Source</th>
                                  <th>Tx</th>
                                </tr>
                              </thead>
                              <tbody>
                                {historyData.pastAirdrops.map((p, i) => (
                                  <tr key={`${p.signature}-${p.mint}-${i}`}>
                                    <td className="col-date">{p.date}</td>
                                    <td>
                                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <span style={{
                                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                                          width: 30, height: 30, borderRadius: 8,
                                          background: p.symbol === "SOL" ? "#9945FF22" : p.isLikelyAirdrop ? "#14F19522" : "#23d3ff18",
                                          border: `1px solid ${p.symbol === "SOL" ? "#9945FF44" : p.isLikelyAirdrop ? "#14F19544" : "#23d3ff33"}`,
                                          fontSize: 9, fontWeight: 800, letterSpacing: -0.5,
                                          color: p.symbol === "SOL" ? "#9945FF" : p.isLikelyAirdrop ? "#14F195" : "#23d3ff",
                                        }}>
                                          {p.symbol.slice(0, 4)}
                                        </span>
                                        <span style={{ fontWeight: 600, fontSize: 13 }}>{p.symbol}</span>
                                      </div>
                                    </td>
                                    <td>
                                      <div>
                                        <span style={{ fontWeight: 600, color: "#fff" }}>
                                          {p.uiAmount >= 1000
                                            ? p.uiAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })
                                            : p.uiAmount.toLocaleString("en-US", { maximumFractionDigits: 4 })}
                                        </span>
                                        <small style={{ display: "block", color: "var(--muted)", fontSize: 10 }}>{p.symbol}</small>
                                      </div>
                                    </td>
                                    <td>
                                      <span className={`pill ${p.isLikelyAirdrop ? "pill-eligible" : "pill-unknown"}`}>
                                        {p.isLikelyAirdrop ? "🪂 Airdrop" : "Transfer"}
                                      </span>
                                    </td>
                                    <td>
                                      {p.senderAddress ? (
                                        <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 10, color: "var(--muted)" }}>
                                          {p.senderAddress.slice(0, 6)}…{p.senderAddress.slice(-4)}
                                        </span>
                                      ) : (
                                        <span style={{ color: "var(--muted)", fontSize: 11 }}>Unknown</span>
                                      )}
                                    </td>
                                    <td>
                                      <a
                                        href={`https://solscan.io/tx/${p.signature}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="board-action-claim"
                                        style={{ fontSize: 11 }}
                                      >
                                        View ↗
                                      </a>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                <div className="board-table-wrap">
                  <table className="board-table">
                    <thead><tr><th>Date</th><th>Airdrop</th><th>Asset</th><th>Est. Value</th><th>Status</th><th>Amount</th><th>Action</th></tr></thead>
                    <tbody>
                      {tableRows.length === 0 ? (
                        <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--muted)", padding: "32px 14px" }}>
                          {data || groupScan ? "No eligible airdrops found." : "Connect your wallet or try a demo to see results."}
                        </td></tr>
                      ) : tableRows.map((row) => (
                        <tr key={row.id}>
                          <td className="col-date">{row.date}</td>
                          <td style={{ fontWeight: 500 }}>{row.project}</td>
                          <td>
                            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, background: "var(--surface-2)", border: "1px solid var(--border)", fontSize: 10, fontWeight: 700, color: "var(--muted)" }}>
                              {row.asset}
                            </span>
                          </td>
                          <td style={{ color: "var(--brand)", fontWeight: 500, fontSize: 12 }}>{row.estimatedValue ?? "TBD"}</td>
                          <td>
                            <span className={`pill ${row.status === "Eligible" ? "pill-eligible" : row.status === "Likely" ? "pill-likely" : "pill-unknown"}`}>{row.status}</span>
                          </td>
                          <td><span>{row.amount.toFixed(2)} {row.asset}</span><small>${row.usd.toFixed(2)}</small></td>
                          <td>
                            {row.isEligible
                              ? <a href={row.claimUrl} target="_blank" rel="noreferrer" className="board-action-claim">Claim ↗</a>
                              : <button type="button" className="board-action-track">Track</button>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                )}
                {proPaymentUri && (
                  <div className="pro-upgrade">
                    <span>Pro Scan —</span>
                    <a href={proPaymentUri}>Pay with Solana Pay (0.02 SOL)</a>
                  </div>
                )}
              </div>
            </section>

            {/* ── Wallet Profiles ── */}
            <section className="profile-panel">
              <h2>Wallet Profiles</h2>
              <p className="safety-note">Save groups locally and run batch scans across multiple wallets.</p>
              <div className="profile-manager">
                <input className="ab-input" type="text" placeholder="Profile name (e.g. Team Alpha)" value={newProfileName} onChange={(e) => setNewProfileName(e.target.value)} />
                <div className="profile-wallet-add">
                  <input className="ab-input ab-input-mono" type="text" placeholder="Wallet address" value={newWalletAddress} onChange={(e) => setNewWalletAddress(e.target.value)} />
                  <button type="button" className="ghost-btn" onClick={() => {
                    const v = newWalletAddress.trim();
                    if (!v) return;
                    if (!isValid(v)) { setProfileError("Invalid address."); return; }
                    if (draftWallets.includes(v)) { setProfileError("Already added."); return; }
                    setDraftWallets((p) => [...p, v]); setNewWalletAddress(""); setProfileError(null);
                  }}>Add</button>
                </div>
                {draftWallets.length > 0 && (
                  <div className="chip-row">
                    {draftWallets.map((a) => (
                      <button key={a} type="button" className="profile-chip" onClick={() => setDraftWallets((p) => p.filter((w) => w !== a))}>{shortAddr(a)} ×</button>
                    ))}
                  </div>
                )}
                <button type="button" className="check-btn" style={{ width: "fit-content" }} onClick={saveProfile}>Save profile</button>
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
                        {profile.wallets.map((a) => <span key={a} className="proof-chip proof-met">{shortAddr(a)}</span>)}
                      </div>
                      <div className="links-row" style={{ marginTop: 10 }}>
                        <button type="button" className="ghost-btn" onClick={() => runProfileScan(profile)} disabled={runningProfileId === profile.id}>
                          {runningProfileId === profile.id ? "Running…" : "Scan profile"}
                        </button>
                        <button type="button" className="ghost-btn" onClick={() => setProfiles((p) => p.filter((x) => x.id !== profile.id))}>Delete</button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : <p className="empty-state">No saved profiles yet.</p>}
            </section>

            {/* ── Group scan results ── */}
            {groupScan && (
              <>
                <div className="summary-grid" style={{ marginTop: 16 }}>
                  <article><span>Profile</span><strong>{groupScan.profileName}</strong></article>
                  <article><span>Wallets scanned</span><strong>{groupScan.walletScans.length}</strong></article>
                  <article><span>Healthy scans</span><strong>{groupScan.walletScans.filter((w) => w.ok).length}</strong></article>
                  <article><span>Scan time</span><strong>{new Date(groupScan.checkedAt).toLocaleString()}</strong></article>
                </div>
                <section className="results-shell">
                  <h2>Wallet Status</h2>
                  <ul className="result-list" style={{ marginTop: 14 }}>
                    {groupScan.walletScans.map((scan) => (
                      <li key={scan.address} className="result-card">
                        <div className="result-top-row">
                          <strong style={{ fontFamily: "ui-monospace,monospace", fontSize: 12 }}>{scan.address}</strong>
                          <span className={`pill ${scan.ok ? "pill-eligible" : "pill-not_eligible"}`}>{scan.ok ? "ok" : "failed"}</span>
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
                    <article><span>Genesis Tier</span><strong>{summary.eligible}</strong></article>
                    <article><span>Epoch Tier</span><strong>{summary.likely}</strong></article>
                    <article><span>Pending Slot</span><strong>{summary.watchlist}</strong></article>
                    <article><span>Scan time</span><strong>{summary.checkedAt}</strong></article>
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
          </>
        )}

        {/* ════════════════════════════════════════════
            ADDRESS BOOK TAB
        ════════════════════════════════════════════ */}
        {activeNav === "Address Book" && (
          <section>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#fff" }}>Address Book</h2>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>Save and manage your Solana wallet addresses locally.</p>
            </div>
            <AddressBook />
          </section>
        )}

        <footer className="credit">
          <span>Made with ❤️ by</span>
          <a href="https://x.com/notT0KY0" target="_blank" rel="noreferrer">@notT0KY0</a>
        </footer>
      </main>
    </>
  );
}
