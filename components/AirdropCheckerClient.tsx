"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { AirdropEvaluation, PastAirdrop, WalletProfile } from "@/lib/types";
import { AIRDROP_RULES } from "@/lib/airdrops";
import StatusTabs from "@/components/StatusTabs";
import AddressBook from "@/components/AddressBook";
import { drawShareCard } from "@/lib/shareCard";
import { getProjectMeta } from "@/lib/projectMeta";

/* ─── Types ─────────────────────────────────────────── */
type ApiResponse = {
  checkedAt: string;
  profile: WalletProfile;
  results: AirdropEvaluation[];
  activeAirdrops: AirdropEvaluation[];
  upcomingAirdrops: AirdropEvaluation[];
  endedAirdrops: AirdropEvaluation[];
  pastAirdrops: PastAirdrop[];
  totals: {
    verifiedUsdTotal: number;
    eligibleCount: number;
    unknownCount: number;
  };
  safety: { readOnly: boolean; privateKeysRequested: boolean; note: string };
};
type SolPriceResponse = { symbol: "SOL"; priceUsd: number; change24h: number; asOf: string };
type TickerItem = { id: string; title: string; url: string; sourceName: string };
type WalletProfileGroup = { id: string; name: string; wallets: string[]; createdAt: string };
type WalletScan = { address: string; ok: boolean; error?: string; eligibleCount: number; likelyCount: number };
type GroupScanResult = { profileName: string; checkedAt: string; walletScans: WalletScan[]; aggregateResults: AirdropEvaluation[] };
type LocalAccount = {
  accountKey: string;
  displayName: string;
  avatarDataUrl?: string;
};

const PROFILES_KEY = "airdrop_wallet_profiles_v1";
const LOCAL_ACCOUNT_KEY = "epochradar_local_account_v1";
const NAV_TABS = ["Dashboard", "Airdrop Checker", "Address Book"] as const;
type NavTab = (typeof NAV_TABS)[number];

const AVATAR_COLORS = ["#14f195", "#23d3ff", "#9945ff", "#f97316", "#ec4899"];
const CAT_COLORS: Record<string, string> = { defi: "#14f195", nft: "#9945ff", infrastructure: "#23d3ff", consumer: "#f97316" };

function avatarColor(addr: string) { return AVATAR_COLORS[addr.charCodeAt(0) % AVATAR_COLORS.length]; }
function shortAddr(addr: string) { return `${addr.slice(0, 4)}...${addr.slice(-4)}`; }
function isValid(address: string) { try { new PublicKey(address); return true; } catch { return false; } }

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
  const [activeFilter, setActiveFilter] = useState<"Active" | "Upcoming" | "Past">("Active");
  const [showShare, setShowShare] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareDownloaded, setShareDownloaded] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [localAccount, setLocalAccount] = useState<LocalAccount | null>(null);
  const [accountNameInput, setAccountNameInput] = useState("");
  const [accountKeyInput, setAccountKeyInput] = useState("");
  const shareCanvasRef = useRef<HTMLCanvasElement>(null);
  const [explorerFilter, setExplorerFilter] = useState<"all" | "defi" | "nft" | "infrastructure" | "consumer">("all");

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
        const rawAccount = localStorage.getItem(LOCAL_ACCOUNT_KEY);
        if (rawAccount) {
          const parsed = JSON.parse(rawAccount) as LocalAccount;
          if (parsed.accountKey) {
            setLocalAccount(parsed);
            setAccountNameInput(parsed.displayName || "");
            setAccountKeyInput(parsed.accountKey);
          }
        }
      } catch {
        // Non-blocking.
      }
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try { localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles)); } catch { /* ignore */ }
  }, [profiles, mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      if (localAccount) {
        localStorage.setItem(LOCAL_ACCOUNT_KEY, JSON.stringify(localAccount));
      } else {
        localStorage.removeItem(LOCAL_ACCOUNT_KEY);
      }
    } catch {
      // Non-blocking.
    }
  }, [localAccount, mounted]);

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
    builder: {
      address: "DemoBuilder1111111111111111111111111111111111",
      solBalance: 4.25,
      tokenSymbols: ["USDC", "JUP", "BONK", "DRIFT"],
      tokenMints: [],
      tokenBalances: [],
      tokenAccountsCount: 11,
      nftApproxCount: 3,
      recentTransactionCount: 72,
      accountAgeDays: 420,
      lastActiveDays: 2,
    },
    newcomer: {
      address: "DemoNewbie11111111111111111111111111111111111",
      solBalance: 0.03,
      tokenSymbols: ["USDC"],
      tokenMints: [],
      tokenBalances: [],
      tokenAccountsCount: 1,
      nftApproxCount: 0,
      recentTransactionCount: 4,
      accountAgeDays: 16,
      lastActiveDays: 1,
    },
  }), []);

  /* ── Active results ── */
  const activeResults = groupScan ? groupScan.aggregateResults : data?.activeAirdrops ?? [];
  const upcomingResults = data?.upcomingAirdrops ?? [];
  const pastAirdrops = data?.pastAirdrops ?? [];

  /* ── Table rows ── */
  const tableRows = useMemo(() => {
    if (activeFilter === "Past") {
      return pastAirdrops.slice(0, 14).map((item) => {
        const assetMeta = getProjectMeta(item.symbol);
        return {
          id: `${item.signature}-${item.mint}`,
          project: item.symbol,
          asset: item.symbol,
          assetIcon: assetMeta.iconUrl,
          date: item.date,
          status: item.isLikelyAirdrop ? "Detected" : "Observed",
          isEligible: false,
          claimEnabled: false,
          claimUrl: "",
          reason: item.reason,
          amountText: Number(item.uiAmount.toFixed(6)).toString(),
          usdText: typeof item.usdValue === "number" ? `$${item.usdValue.toFixed(2)}` : "—",
          usdValue: item.usdValue || 0,
          estimatedValue: "Already received",
          verificationLabel: `Detected (${item.confidence}% confidence)`,
        };
      });
    }

    const sourceByFilter = activeFilter === "Upcoming" ? upcomingResults : activeResults;

    const source = onlyEligible
      ? sourceByFilter.filter((item) => item.status === "eligible")
      : sourceByFilter;

    return source.slice(0, 20).map((item, index) => {
      const firstAmount = item.claimableAmounts?.[0];
      const amountText =
        firstAmount && firstAmount.uiAmount > 0 ? Number(firstAmount.uiAmount.toFixed(6)).toString() : "—";
      const usdText = typeof item.verifiedUsdTotal === "number" && item.verifiedUsdTotal > 0
        ? `$${item.verifiedUsdTotal.toFixed(2)}`
        : "—";
      const asset = firstAmount?.symbol || getProjectMeta(item.project).symbol;
      const assetIcon = getProjectMeta(item.project).iconUrl;
      const dateCandidate =
        item.timeline?.claimOpensAt || item.timeline?.snapshotAt || item.timeline?.announcedAt || data?.checkedAt;
      const parsedDate = dateCandidate ? new Date(dateCandidate) : new Date(Date.now() - index * 86400000);

      return {
        id: item.id,
        project: item.project,
        asset,
        assetIcon,
        date: parsedDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
        status:
          item.airdropStatus === "upcoming"
            ? "Upcoming"
            : item.status === "eligible"
              ? "Eligible"
              : item.status === "not_eligible"
                ? "Not eligible"
                : "Unknown",
        isEligible: item.status === "eligible",
        claimEnabled: item.claimActionEnabled,
        claimUrl: item.officialClaimUrl,
        reason: item.reason,
        amountText,
        usdText,
        usdValue: item.verifiedUsdTotal || 0,
        estimatedValue: item.estimatedValue || "TBD",
        verificationLabel: item.verified ? "Verified" : "Unverified",
      };
    });
  }, [activeFilter, activeResults, data?.checkedAt, onlyEligible, pastAirdrops, upcomingResults]);

  const totalValue = useMemo(() => {
    const verifiedUsd = tableRows.reduce((sum, row) => sum + row.usdValue, 0);
    if (verifiedUsd > 0) {
      return verifiedUsd;
    }
    return data?.totals?.verifiedUsdTotal || 0;
  }, [data?.totals?.verifiedUsdTotal, tableRows]);
  const eligibleShareCount = useMemo(() => tableRows.filter((r) => r.isEligible).length, [tableRows]);
  const unknownShareCount = useMemo(() => tableRows.filter((r) => r.status === "Unknown").length, [tableRows]);

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
    const vals = tableRows.length > 0
      ? tableRows.map((r) => r.usdValue)
      : [0, 0, 0, 0, data?.totals?.verifiedUsdTotal || 0];
    return vals.map((v, i) => ({ x: i, y: Number((v * mult).toFixed(2)) }));
  }, [tableRows, chartRange, data?.totals?.verifiedUsdTotal]);

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

  const runDemo = (profile: WalletProfile) => {
    setGroupScan(null);
    const demoResults: AirdropEvaluation[] = AIRDROP_RULES.slice(0, 5).map((rule, index) => ({
      id: rule.id,
      project: rule.project,
      status: "unknown",
      confidence: 0,
      reason: "Demo profile uses unknown status until project provider is configured.",
      network: rule.network,
      category: rule.category,
      airdropStatus: rule.status,
      officialClaimUrl: rule.officialClaimUrl,
      sourceUrl: rule.sourceUrl,
      riskLevel: rule.riskLevel,
      verificationMethod: "unverified",
      verified: false,
      claimActionEnabled: false,
      claimableAmounts: [],
      verifiedUsdTotal: undefined,
      estimatedValue: rule.estimatedValue,
      description: rule.description,
      tags: rule.tags,
      timeline: rule.timeline,
      proof: { met: [], unmet: ["Demo mode"] },
      claimSafety: {
        grade: "caution",
        reasons: ["Demo mode"],
        hostname: new URL(rule.officialClaimUrl).hostname,
      },
    }));
    setData({
      checkedAt: new Date().toISOString(),
      profile,
      results: demoResults,
      activeAirdrops: demoResults.filter((item) => item.airdropStatus === "active" || item.airdropStatus === "snapshot_taken"),
      upcomingAirdrops: demoResults.filter((item) => item.airdropStatus === "upcoming"),
      endedAirdrops: demoResults.filter((item) => item.airdropStatus === "ended"),
      pastAirdrops: [
        {
          signature: "demo-1",
          date: new Date().toLocaleDateString(),
          timestamp: Date.now(),
          mint: "DemoMint111111111111111111111111111111111111",
          mintShort: "DemoMi...",
          symbol: "USDC",
          amount: 2000000,
          decimals: 6,
          uiAmount: 2,
          senderAddress: null,
          isLikelyAirdrop: true,
          reason: "Detected airdrop: Demo sample",
          confidence: 80,
          usdValue: 2,
        },
        {
          signature: "demo-2",
          date: new Date().toLocaleDateString(),
          timestamp: Date.now() - 86400000,
          mint: "DemoMint222222222222222222222222222222222222",
          mintShort: "DemoMi...",
          symbol: "JUP",
          amount: 350000000,
          decimals: 6,
          uiAmount: 350,
          senderAddress: null,
          isLikelyAirdrop: true,
          reason: "Detected airdrop: Demo sample",
          confidence: 78,
          usdValue: 20,
        },
      ],
      totals: {
        verifiedUsdTotal: 0,
        eligibleCount: 0,
        unknownCount: demoResults.length,
      },
      safety: { readOnly: true, privateKeysRequested: false, note: "Demo mode — sample wallet profile." },
    });
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

  const handleShare = async () => {
    const url = shareBaseUrl;
    const text = `🪂 EpochRadar — I found ${eligibleShareCount} eligible Solana airdrops worth $${totalValue.toFixed(2)}! Check yours:`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ title: "EpochRadar Airdrop Checker", text, url }); return; } catch { /* fall through */ }
    }
    setShowShare(true);
  };

  const copyShareUrl = async () => {
    try { await navigator.clipboard.writeText(shareBaseUrl); setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); } catch { /* ignore */ }
  };

  /* ── Draw share card whenever modal opens ── */
  useEffect(() => {
    if (!showShare || !shareCanvasRef.current) return;
    let cancelled = false;
    const eligible = tableRows.filter((r) => r.isEligible);
    const canvas = shareCanvasRef.current;
    void drawShareCard(canvas, {
      walletAddress,
      eligibleCount: eligible.length,
      likelyCount: unknownShareCount,
      totalValue,
      topAirdrops: tableRows.slice(0, 4).map((r) => ({
        project: r.project,
        status: r.status,
        estimatedValue: r.estimatedValue,
      })),
      solPrice: solPrice?.priceUsd,
    }).then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [showShare, tableRows, totalValue, walletAddress, solPrice, unknownShareCount]);

  const downloadShareCard = () => {
    const canvas = shareCanvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "epochradar-airdrops.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
    setShareDownloaded(true);
    setTimeout(() => setShareDownloaded(false), 2500);
  };

  const shareCardToX = () => {
    const text = `🪂 I found ${eligibleShareCount} eligible Solana airdrops worth $${totalValue.toFixed(2)}! Check yours on EpochRadar:`;
    window.open(
      `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareBaseUrl)}`,
      "_blank",
      "noreferrer",
    );
    setShowShare(false);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (deferredPrompt as any).prompt?.();
    setDeferredPrompt(null); setShowInstall(false);
  };

  const createLocalAccount = () => {
    const random = crypto.getRandomValues(new Uint8Array(16));
    const key = `er_${Array.from(random).map((n) => n.toString(16).padStart(2, "0")).join("")}`;
    const next: LocalAccount = {
      accountKey: key,
      displayName: accountNameInput.trim() || "EpochRadar User",
      avatarDataUrl: localAccount?.avatarDataUrl,
    };
    setLocalAccount(next);
    setAccountKeyInput(key);
  };

  const importLocalAccountKey = () => {
    const key = accountKeyInput.trim();
    if (!key || key.length < 8) {
      setError("Account key is too short.");
      return;
    }
    setLocalAccount({
      accountKey: key,
      displayName: accountNameInput.trim() || "EpochRadar User",
      avatarDataUrl: localAccount?.avatarDataUrl,
    });
    setError(null);
  };

  const onAccountAvatarUpload = async (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) return;
      setLocalAccount((prev) => ({
        accountKey: prev?.accountKey || accountKeyInput || "pending",
        displayName: accountNameInput.trim() || prev?.displayName || "EpochRadar User",
        avatarDataUrl: dataUrl,
      }));
    };
    reader.readAsDataURL(file);
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

      {/* ── Share modal ── */}
      {showShare && (
        <div className="modal-backdrop" onClick={() => setShowShare(false)}>
          <div className="share-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="share-modal-header">
              <div>
                <h2 className="modal-title">Share your results</h2>
                <p className="modal-sub">Save your airdrop card or post it on X.</p>
              </div>
              <button type="button" className="modal-close" onClick={() => setShowShare(false)}>×</button>
            </div>

            <section className="share-scene">
              <div className="share-scene-overlay" />
              <div className="share-scene-content">
                <p className="share-scene-kicker">High-Risk Hunter Mode</p>
                <h3>Tactical Drop Report</h3>
                <p>
                  Blended cinematic style with your live wallet snapshot and claim-ready opportunities.
                </p>
                <div className="share-scene-stats">
                  <span><strong>${totalValue.toFixed(2)}</strong> total value</span>
                  <span><strong>{eligibleShareCount}</strong> eligible</span>
                  <span><strong>{unknownShareCount}</strong> unknown</span>
                </div>
              </div>
            </section>

            {/* Hidden render surface used for "Save image" export */}
            <canvas ref={shareCanvasRef} className="share-canvas-hidden" aria-hidden="true" />

            {/* Actions */}
            <div className="share-modal-actions">
              <button type="button" className="share-dl-btn" onClick={downloadShareCard}>
                <span className="share-option-icon">⬇</span>
                {shareDownloaded ? "Saved!" : "Save image"}
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

            {/* URL bar */}
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
            {/* Avatar */}
            {mounted && (
              <div
                className="avatar-ring"
                style={{ background: `${avatarBg}18`, border: `1.5px solid ${avatarBg}55`, color: avatarBg }}
                title={walletAddress ?? "Not connected"}
              >
                <div className="avatar-glow-ring" />
                {avatarInitials}
              </div>
            )}
          </div>
        </div>
      </nav>

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
                    You received <span style={{ color: "var(--brand)" }}>${totalValue.toFixed(2)}</span> worth of Airdrops!
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
                  <div style={{ marginTop: 12, border: "1px solid var(--border)", borderRadius: 12, padding: 10, background: "var(--surface-2)" }}>
                    <p style={{ margin: "0 0 8px 0", fontSize: 12, color: "var(--muted)" }}>Account (no phone/email)</p>
                    <div style={{ display: "grid", gap: 8 }}>
                      <input
                        className="ab-input"
                        placeholder="Display name"
                        value={accountNameInput}
                        onChange={(e) => setAccountNameInput(e.target.value)}
                      />
                      <input
                        className="ab-input ab-input-mono"
                        placeholder="Account key"
                        value={accountKeyInput}
                        onChange={(e) => setAccountKeyInput(e.target.value)}
                      />
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button type="button" className="ghost-btn" onClick={createLocalAccount}>Create key</button>
                        <button type="button" className="ghost-btn" onClick={importLocalAccountKey}>Use key</button>
                      </div>
                      <label style={{ fontSize: 12, color: "var(--muted)" }}>
                        Profile picture
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: "block", marginTop: 6 }}
                          onChange={(e) => onAccountAvatarUpload(e.target.files?.[0] || null)}
                        />
                      </label>
                      {localAccount && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {localAccount.avatarDataUrl ? (
                            <img src={localAccount.avatarDataUrl} alt="Account avatar" width={26} height={26} style={{ borderRadius: 999 }} />
                          ) : (
                            <span style={{ width: 26, height: 26, borderRadius: 999, background: "var(--surface)", border: "1px solid var(--border)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>👤</span>
                          )}
                          <span style={{ fontSize: 12, color: "var(--ink)" }}>{localAccount.displayName}</span>
                        </div>
                      )}
                    </div>
                  </div>
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
                    {(["Active", "Upcoming", "Past"] as const).map((f) => (
                      <button key={f} type="button" className={`board-pill ${activeFilter === f ? "board-pill-active" : ""}`} onClick={() => setActiveFilter(f)}>{f}</button>
                    ))}
                  </div>
                </div>
                {walletAddress && (
                  <div className="wallet-row-header">
                    <span className="wallet-row-addr">{walletAddress}</span>
                    <span className="wallet-row-count">{tableRows.length} airdrop{tableRows.length !== 1 ? "s" : ""}</span>
                  </div>
                )}
                <div className="board-table-wrap">
                  <table className="board-table">
                    <thead><tr><th>Date</th><th>Airdrop</th><th>Asset</th><th>Value</th><th>Status</th><th>Amount / USD</th><th>Action</th></tr></thead>
                    <tbody>
                      {tableRows.length === 0 ? (
                        <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--muted)", padding: "32px 14px" }}>
                          {data || groupScan ? "No rows for this filter yet." : "Connect your wallet or try a demo to see results."}
                        </td></tr>
                      ) : tableRows.map((row) => (
                        <tr key={row.id}>
                          <td className="col-date">{row.date}</td>
                          <td style={{ fontWeight: 500 }}>{row.project}</td>
                          <td>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                              <img
                                src={row.assetIcon}
                                alt={row.asset}
                                width={20}
                                height={20}
                                style={{ borderRadius: 999, objectFit: "cover", border: "1px solid var(--border)" }}
                              />
                              <span style={{ fontSize: 11, color: "var(--muted)" }}>{row.asset}</span>
                            </span>
                          </td>
                          <td style={{ color: "var(--brand)", fontWeight: 500, fontSize: 12 }}>
                            {row.usdText === "—" ? row.estimatedValue : row.usdText}
                          </td>
                          <td>
                            <div style={{ display: "grid", gap: 4 }}>
                              <span className={`pill ${row.status === "Eligible" ? "pill-eligible" : row.status === "Unknown" ? "pill-unknown" : "pill-likely"}`}>{row.status}</span>
                              <span style={{ fontSize: 10, color: "var(--muted)" }}>{row.verificationLabel}</span>
                            </div>
                          </td>
                          <td><span>{row.amountText} {row.asset}</span><small>{row.usdText}</small></td>
                          <td>
                            {row.claimEnabled
                              ? <a href={row.claimUrl} target="_blank" rel="noreferrer" className="board-action-claim">Claim ↗</a>
                              : <button type="button" className="board-action-track">Track</button>
                            }
                          </td>
                        </tr>
                      ))}
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
