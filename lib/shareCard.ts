/**
 * EpochRadar Share Card — Pro Edition
 *
 * Layout (1080 × 1080 square):
 *   • TOP HALF  : full-bleed art (cover-fit), top scrim for logo strip
 *   • BOTTOM HALF: solid dark panel — clean, no art bleed
 *     - Eyebrow, dollar value, subtitle
 *     - Hairline divider
 *     - 3 stat chips (Eligible / Likely / Total)
 *     - Hairline divider
 *     - Up to 5 airdrop rows (compact list)
 *     - Watermark
 *
 * Design language: premium fintech card — tight grid, monospace accents,
 * muted glass panels, strong typographic hierarchy. Gold/green/purple brand palette.
 */

export type ShareCardData = {
  walletAddress: string | null;
  eligibleCount: number;
  likelyCount: number;
  totalValue: number;
  topAirdrops: Array<{ project: string; status: string; estimatedValue?: string }>;
  solPrice?: number;
  profilePic?: string;
};

/* ─── palette ──────────────────────────────────── */
const GOLD   = "#FFD700";
const GOLD2  = "#FFA040";
const GREEN  = "#14F195";
const PURPLE = "#9945FF";
const TEAL   = "#00C2FF";
const WHITE  = "#FFFFFF";

/* ─── helpers ──────────────────────────────────── */
function rr(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/* subtle noise — draws 300 random semi-transparent pixels for texture */
function drawNoise(ctx: CanvasRenderingContext2D, W: number, H: number, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let i = 0; i < 300; i++) {
    const nx = Math.random() * W;
    const ny = Math.random() * H;
    const v  = Math.random() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(nx, ny, 1, 1);
  }
  ctx.restore();
}

export function drawShareCard(
  canvas: HTMLCanvasElement,
  data: ShareCardData,
): Promise<void> {
  return drawShareCardInternal(canvas, data);
}

/* Load an image from a URL, resolve with the HTMLImageElement (or null on error) */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function drawShareCardInternal(
  canvas: HTMLCanvasElement,
  data: ShareCardData,
) {
  const W = 1080;
  const H = 1080;
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  /* Load background and profile images asynchronously */
  const bgImage = await loadImage(`/spongebob.jpg?v=${Date.now()}`);
  const profileImg = data.profilePic ? await loadImage(data.profilePic) : null;

  /* ─── Key layout constants ─── */
  const SPLIT   = Math.round(H * 0.46);  // y where art ends, dark panel begins
  const PAD     = 52;

  /* ══════════════════════════════════════════════════════
     STEP 1 — Full canvas dark base
  ══════════════════════════════════════════════════════ */
  ctx.fillStyle = "#06050d";
  ctx.fillRect(0, 0, W, H);

  /* ══════════════════════════════════════════════════════
     STEP 2 — TOP HALF: art, clipped to [0 → SPLIT]
  ══════════════════════════════════════════════════════ */
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, SPLIT);
  ctx.clip();

  if (bgImage && bgImage.naturalWidth > 0) {
    const iw = bgImage.naturalWidth;
    const ih = bgImage.naturalHeight;
    // Cover-fit into the full width × SPLIT height
    const scale = Math.max(W / iw, SPLIT / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (W - dw) / 2;
    const dy = (SPLIT - dh) / 2;   // vertically centre in the art zone
    ctx.drawImage(bgImage, dx, dy, dw, dh);
  } else {
    // Vivid fallback gradient
    const g = ctx.createLinearGradient(0, 0, W, SPLIT);
    g.addColorStop(0,   "#14003a");
    g.addColorStop(0.5, "#001a30");
    g.addColorStop(1,   "#001a10");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, SPLIT);
  }

  // Top logo scrim: opaque at very top → clear by 200px
  const sTop = ctx.createLinearGradient(0, 0, 0, 200);
  sTop.addColorStop(0,   "rgba(4,3,11,0.93)");
  sTop.addColorStop(0.6, "rgba(4,3,11,0.30)");
  sTop.addColorStop(1,   "rgba(4,3,11,0)");
  ctx.fillStyle = sTop;
  ctx.fillRect(0, 0, W, 200);

  // Side vignettes on the art zone
  const sL = ctx.createLinearGradient(0, 0, 50, 0);
  sL.addColorStop(0, "rgba(0,0,0,0.55)");
  sL.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sL; ctx.fillRect(0, 0, 50, SPLIT);

  const sR = ctx.createLinearGradient(W - 50, 0, W, 0);
  sR.addColorStop(0, "rgba(0,0,0,0)");
  sR.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = sR; ctx.fillRect(W - 50, 0, 50, SPLIT);

  ctx.restore(); // end art clip

  /* ══════════════════════════════════════════════════════
     STEP 3 — BOTTOM HALF: solid dark panel [SPLIT → H]
     Hard edge at SPLIT, completely opaque — no art bleed.
  ══════════════════════════════════════════════════════ */
  // Base fill
  ctx.fillStyle = "#07060f";
  ctx.fillRect(0, SPLIT, W, H - SPLIT);

  // Subtle top-edge glow on the panel (brand colours bleeding down from art)
  const panelTopGlow = ctx.createLinearGradient(0, SPLIT, 0, SPLIT + 80);
  panelTopGlow.addColorStop(0, "rgba(255,215,0,0.10)");
  panelTopGlow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = panelTopGlow;
  ctx.fillRect(0, SPLIT, W, 80);

  // Ambient colour glows inside the panel only
  const gB = ctx.createRadialGradient(W * 0.15, H, 0, W * 0.15, H, 420);
  gB.addColorStop(0, "rgba(20,241,149,0.10)");
  gB.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gB; ctx.fillRect(0, SPLIT, W, H - SPLIT);

  const gC = ctx.createRadialGradient(W * 0.85, H * 0.85, 0, W * 0.85, H * 0.85, 380);
  gC.addColorStop(0, "rgba(153,69,255,0.09)");
  gC.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gC; ctx.fillRect(0, SPLIT, W, H - SPLIT);

  /* ══════════════════════════════════════════════════════
     STEP 4 — Noise texture (panel only, subtle)
  ══════════════════════════════════════════════════════ */
  drawNoise(ctx, W, H, 0.018);

  /* ══════════════════════════════════════════════════════
     STEP 6 — TOP STRIP
     Left : logo mark + wordmark + tagline
     Right: wallet chip (+ profile pic if present)
  ══════════════════════════════════════════════════════ */
  // ── Logo mark (concentric circles, Solana-ish) ──
  const lx = PAD + 18, ly = 60;

  ctx.save();
  ctx.shadowColor = GOLD;
  ctx.shadowBlur  = 22;
  // outer green ring
  ctx.strokeStyle = GREEN + "88"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(lx, ly, 20, 0, Math.PI * 2); ctx.stroke();
  // mid gold ring
  ctx.strokeStyle = GOLD + "cc"; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(lx, ly, 13, 0, Math.PI * 2); ctx.stroke();
  // inner purple fill
  ctx.fillStyle = PURPLE;
  ctx.beginPath(); ctx.arc(lx, ly, 7, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // ── Wordmark ──
  ctx.font = "800 30px ui-monospace,'SF Mono',Menlo,monospace";
  ctx.fillStyle = WHITE;
  ctx.textAlign = "left";
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur  = 12;
  ctx.fillText("EpochRadar", lx + 28, ly + 10);
  ctx.shadowBlur = 0;

  ctx.font = "500 13px -apple-system,BlinkMacSystemFont,sans-serif";
  ctx.fillStyle = "rgba(255,215,0,0.70)";
  ctx.fillText("✦ Solana Airdrop Scanner", lx + 28, ly + 30);

  // ── Wallet chip ──
  const wLabel = data.walletAddress
    ? `${data.walletAddress.slice(0, 6)}…${data.walletAddress.slice(-4)}`
    : "Demo Wallet";
  ctx.font = "600 13px ui-monospace,monospace";
  const chipW = ctx.measureText(wLabel).width + 32;
  const chipX = W - PAD - chipW;
  const chipY = ly - 18;

  rr(ctx, chipX, chipY, chipW, 36, 10);
  ctx.fillStyle = "rgba(255,215,0,0.10)"; ctx.fill();
  ctx.strokeStyle = "rgba(255,215,0,0.35)"; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = "rgba(255,230,100,0.90)";
  ctx.textAlign = "left";
  ctx.fillText(wLabel, chipX + 16, chipY + 23);

  // ── Profile pic ──
  if (profileImg) {
    const pr = 22;
    const px2 = chipX - pr - 12;
    const py2 = chipY + 18;
    ctx.save();
    ctx.beginPath(); ctx.arc(px2, py2, pr, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(profileImg, px2 - pr, py2 - pr, pr * 2, pr * 2);
    ctx.restore();
    ctx.save();
    ctx.shadowColor = GOLD; ctx.shadowBlur = 10;
    ctx.strokeStyle = GOLD; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(px2, py2, pr + 1, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  /* ══════════════════════════════════════════════════════
     STEP 7 — MAIN DATA PANEL (SPLIT → H)

     Layout inside panel (top → bottom):
       Eyebrow label
       ★ Dollar value — massive gradient type
       Subtitle
       ── Hairline divider ──
       3 stat chips in a row
       ── Hairline divider ──
       Up to 5 airdrop rows (compact list style)
       Watermark
  ══════════════════════════════════════════════════════ */
  const panelTop = SPLIT;       // data starts right at the split
  const valueY   = panelTop + 118;

  // ── Eyebrow ──
  ctx.font = "700 14px -apple-system,sans-serif";
  ctx.fillStyle = "rgba(255,215,0,0.60)";
  ctx.textAlign = "center";
  // letter-spacing hack: spread manually
  const eyeText = "YOUR  ELIGIBLE  AIRDROPS";
  ctx.fillText(eyeText, W / 2, panelTop + 72);

  // ── Gold glow behind the value ──
  ctx.save();
  const vg = ctx.createRadialGradient(W / 2, valueY - 10, 0, W / 2, valueY - 10, 300);
  vg.addColorStop(0, "rgba(255,200,0,0.26)");
  vg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, valueY - 110, W, 170);
  ctx.restore();

  // ── Dollar value ──
  const valueStr = data.totalValue > 0
    ? `$${data.totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "$0.00";

  ctx.save();
  ctx.font = "900 120px -apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif";
  const tw = ctx.measureText(valueStr).width;
  // Horizontal gradient across the number
  const tg = ctx.createLinearGradient(W / 2 - tw / 2, 0, W / 2 + tw / 2, 0);
  tg.addColorStop(0,    "#FFE566");
  tg.addColorStop(0.35, "#FFD700");
  tg.addColorStop(0.65, "#FFA040");
  tg.addColorStop(0.85, "#14F195");
  tg.addColorStop(1,    "#00C2FF");
  ctx.fillStyle = tg;
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(255,200,0,0.55)";
  ctx.shadowBlur  = 32;
  ctx.fillText(valueStr, W / 2, valueY);
  ctx.restore();

  // ── Subtitle ──
  ctx.font = "400 21px -apple-system,sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.52)";
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 6;
  ctx.fillText("worth of Solana airdrops identified  🪂", W / 2, valueY + 46);
  ctx.shadowBlur = 0;

  // ── Hairline divider ──
  const div1Y = valueY + 78;
  const divG = ctx.createLinearGradient(PAD, 0, W - PAD, 0);
  divG.addColorStop(0,    "rgba(255,215,0,0)");
  divG.addColorStop(0.2,  "rgba(255,215,0,0.35)");
  divG.addColorStop(0.8,  "rgba(20,241,149,0.25)");
  divG.addColorStop(1,    "rgba(20,241,149,0)");
  ctx.strokeStyle = divG; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(PAD, div1Y); ctx.lineTo(W - PAD, div1Y); ctx.stroke();

  /* ── 3 Stat chips ── */
  const chipStats = [
    { label: "ELIGIBLE",  val: String(data.eligibleCount),                         col: GOLD,   bg: "rgba(255,215,0,0.10)",  bdr: "rgba(255,215,0,0.32)"  },
    { label: "LIKELY",    val: String(data.likelyCount),                            col: GREEN,  bg: "rgba(20,241,149,0.09)", bdr: "rgba(20,241,149,0.30)" },
    { label: "TOTAL",     val: String(data.eligibleCount + data.likelyCount),       col: PURPLE, bg: "rgba(153,69,255,0.09)", bdr: "rgba(153,69,255,0.30)" },
  ];

  const csY   = div1Y + 18;
  const csH   = 72;
  const csGap = 14;
  const csTot = chipStats.length;
  const csW   = Math.floor((W - PAD * 2 - csGap * (csTot - 1)) / csTot);
  chipStats.forEach((cs, i) => {
    const cx = PAD + i * (csW + csGap);
    rr(ctx, cx, csY, csW, csH, 14);
    ctx.fillStyle = cs.bg; ctx.fill();
    ctx.strokeStyle = cs.bdr; ctx.lineWidth = 1.5; ctx.stroke();

    // label
    ctx.font = "600 11px -apple-system,sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.38)";
    ctx.textAlign = "center";
    ctx.fillText(cs.label, cx + csW / 2, csY + 22);

    // value
    ctx.save();
    ctx.font = "800 32px -apple-system,sans-serif";
    ctx.shadowColor = cs.col; ctx.shadowBlur = 12;
    ctx.fillStyle   = cs.col;
    ctx.fillText(cs.val, cx + csW / 2, csY + 58);
    ctx.restore();
  });

  // ── Second hairline divider ──
  const div2Y = csY + csH + 18;
  ctx.strokeStyle = divG; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(PAD, div2Y); ctx.lineTo(W - PAD, div2Y); ctx.stroke();

  /* ── Airdrop list (up to 4 rows) ──
     Each row: colour dot | project name     | status pill | est. value
  */
  const top4 = data.topAirdrops.slice(0, 5);
  if (top4.length > 0) {
    const listY  = div2Y + 16;
    const rowH   = 42;
    const rowGap = 7;

    // Section label
    ctx.font = "600 11px -apple-system,sans-serif";
    ctx.fillStyle = "rgba(255,215,0,0.45)";
    ctx.textAlign = "left";
    ctx.fillText("TOP AIRDROPS", PAD, listY - 4);

    top4.forEach((item, i) => {
      const ry = listY + 10 + i * (rowH + rowGap);
      const col = item.status === "Eligible" ? GOLD : item.status === "Likely" ? GREEN : TEAL;

      // row background
      rr(ctx, PAD, ry, W - PAD * 2, rowH, 10);
      ctx.fillStyle = "rgba(255,255,255,0.03)"; ctx.fill();
      ctx.strokeStyle = col + "25"; ctx.lineWidth = 1; ctx.stroke();

      // left colour dot
      ctx.save();
      ctx.shadowColor = col; ctx.shadowBlur = 8;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(PAD + 18, ry + rowH / 2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // project name
      ctx.font = "600 15px -apple-system,sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.textAlign = "left";
      const nm = item.project.length > 18 ? item.project.slice(0, 17) + "…" : item.project;
      ctx.fillText(nm, PAD + 36, ry + rowH / 2 + 5);

      // status pill (right-aligned, before value)
      const statusStr = item.status;
      ctx.font = "700 11px -apple-system,sans-serif";
      const stW = ctx.measureText(statusStr).width + 18;
      const stX = W - PAD - 110 - stW;
      rr(ctx, stX, ry + rowH / 2 - 11, stW, 22, 6);
      ctx.fillStyle = col + "22"; ctx.fill();
      ctx.strokeStyle = col + "55"; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = col;
      ctx.textAlign = "center";
      ctx.fillText(statusStr, stX + stW / 2, ry + rowH / 2 + 4);

      // est. value (far right)
      ctx.font = "700 15px ui-monospace,monospace";
      ctx.fillStyle = col;
      ctx.textAlign = "right";
      ctx.fillText(item.estimatedValue ?? "TBD", W - PAD, ry + rowH / 2 + 5);
    });
  }

  /* ══════════════════════════════════════════════════════
     STEP 8 — Dividing line between art and data panel
  ══════════════════════════════════════════════════════ */
  // Thin accent line at the split point
  const splitLineG = ctx.createLinearGradient(0, 0, W, 0);
  splitLineG.addColorStop(0,    "rgba(255,215,0,0)");
  splitLineG.addColorStop(0.15, "rgba(255,215,0,0.55)");
  splitLineG.addColorStop(0.5,  "rgba(20,241,149,0.40)");
  splitLineG.addColorStop(0.85, "rgba(153,69,255,0.35)");
  splitLineG.addColorStop(1,    "rgba(153,69,255,0)");
  ctx.strokeStyle = splitLineG;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, SPLIT);
  ctx.lineTo(W, SPLIT);
  ctx.stroke();

  /* ══════════════════════════════════════════════════════
     STEP 9 — Outer border (gradient glow)
  ══════════════════════════════════════════════════════ */
  ctx.save();
  ctx.shadowColor = GOLD;
  ctx.shadowBlur  = 20;
  const bdG = ctx.createLinearGradient(0, 0, W, H);
  bdG.addColorStop(0,    GOLD   + "dd");
  bdG.addColorStop(0.35, PURPLE + "77");
  bdG.addColorStop(0.70, TEAL   + "55");
  bdG.addColorStop(1,    GREEN  + "bb");
  ctx.strokeStyle = bdG;
  ctx.lineWidth   = 3;
  rr(ctx, 1.5, 1.5, W - 3, H - 3, 24);
  ctx.stroke();
  ctx.restore();

  /* ══════════════════════════════════════════════════════
     STEP 10 — Watermark
  ══════════════════════════════════════════════════════ */
  ctx.font = "500 13px ui-monospace,monospace";
  ctx.fillStyle = "rgba(255,215,0,0.28)";
  ctx.textAlign = "center";
  ctx.fillText("epochradar.com  ✦  Check your Solana airdrops", W / 2, H - 20);
}
