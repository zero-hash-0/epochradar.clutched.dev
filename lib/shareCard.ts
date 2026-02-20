/**
 * EpochRadar Share Card — Full-Bleed Poster Edition
 * SpongeBob fills every pixel. Cinematic scrims. Giant gold money number.
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

const SOL_NEON  = "#23D3FF";
const SOL_LIME  = "#B8EF6D";
const SOL_AMBER = "#FFC46D";

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function drawShareCard(
  canvas: HTMLCanvasElement,
  data: ShareCardData,
): void {
  const W = 1080;
  const H = 1080;
  canvas.width  = W;
  canvas.height = H;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const rand = seededRand(42);

  /* ══════════════════════════════════════════
     LAYER 1 — Dark base
  ══════════════════════════════════════════ */
  ctx.fillStyle = "#06050e";
  ctx.fillRect(0, 0, W, H);

  /* ══════════════════════════════════════════
     LAYER 2 — Full-bleed SpongeBob (cover fit)
  ══════════════════════════════════════════ */
  if (bgImage && bgImage.naturalWidth > 0) {
    const iw = bgImage.naturalWidth;
    const ih = bgImage.naturalHeight;
    const scale = Math.max(W / iw, H / ih);   // cover: fill the whole card
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (W - dw) / 2;
    // Anchor slightly above center so the face/action stays visible
    const dy = (H - dh) * 0.35;
    ctx.drawImage(bgImage, dx, dy, dw, dh);
  } else {
    // Fallback vivid gradient
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0,   "#1a0a3a");
    grad.addColorStop(0.5, "#0d1a2a");
    grad.addColorStop(1,   "#0a1f14");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  /* ══════════════════════════════════════════
     LAYER 3 — Cinematic scrims (keep image visible in middle)
  ══════════════════════════════════════════ */
  // Top bar (logo strip) — deep dark
  const topScrim = ctx.createLinearGradient(0, 0, 0, 200);
  topScrim.addColorStop(0,   "rgba(4,3,10,0.92)");
  topScrim.addColorStop(0.6, "rgba(4,3,10,0.55)");
  topScrim.addColorStop(1,   "rgba(0,0,0,0)");
  ctx.fillStyle = topScrim;
  ctx.fillRect(0, 0, W, 200);

  // Bottom panel — deep dark for text
  const botScrim = ctx.createLinearGradient(0, H * 0.42, 0, H);
  botScrim.addColorStop(0,    "rgba(0,0,0,0)");
  botScrim.addColorStop(0.18, "rgba(4,3,10,0.72)");
  botScrim.addColorStop(0.45, "rgba(4,3,10,0.91)");
  botScrim.addColorStop(1,    "rgba(4,3,10,0.98)");
  ctx.fillStyle = botScrim;
  ctx.fillRect(0, H * 0.42, W, H * 0.58);

  // Thin left + right edge vignettes
  const vigL = ctx.createLinearGradient(0, 0, 80, 0);
  vigL.addColorStop(0, "rgba(0,0,0,0.50)");
  vigL.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = vigL;
  ctx.fillRect(0, 0, 80, H);

  const vigR = ctx.createLinearGradient(W - 80, 0, W, 0);
  vigR.addColorStop(0, "rgba(0,0,0,0)");
  vigR.addColorStop(1, "rgba(0,0,0,0.50)");
  ctx.fillStyle = vigR;
  ctx.fillRect(W - 80, 0, 80, H);

  /* ══════════════════════════════════════════
     LAYER 4 — Colour glows on top of image
  ══════════════════════════════════════════ */
  // Gold sweep from top-left
  const glowGold = ctx.createRadialGradient(100, 100, 0, 100, 100, 700);
  glowGold.addColorStop(0, "rgba(255,185,0,0.22)");
  glowGold.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glowGold;
  ctx.fillRect(0, 0, W, H);

  // Green sweep from bottom-right
  const glowGreen = ctx.createRadialGradient(W - 80, H - 80, 0, W - 80, H - 80, 550);
  glowGreen.addColorStop(0, "rgba(20,241,149,0.16)");
  glowGreen.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glowGreen;
  ctx.fillRect(0, 0, W, H);

  // Purple mid-right accent
  const glowPurp = ctx.createRadialGradient(W, H * 0.5, 0, W, H * 0.5, 400);
  glowPurp.addColorStop(0, "rgba(153,69,255,0.14)");
  glowPurp.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glowPurp;
  ctx.fillRect(0, 0, W, H);

  /* ══════════════════════════════════════════
     LAYER 5 — Diagonal shimmer lines
  ══════════════════════════════════════════ */
  ctx.save();
  for (let i = 0; i < 12; i++) {
    const lx = -400 + i * 180;
    ctx.strokeStyle = `rgba(255,215,0,${0.01 + rand() * 0.03})`;
    ctx.lineWidth = 1 + rand() * 2;
    ctx.beginPath();
    ctx.moveTo(lx, 0);
    ctx.lineTo(lx + H * 0.9, H);
    ctx.stroke();
  }
  ctx.restore();

  /* ══════════════════════════════════════════
     LAYER 6 — Floating sparkle dots
  ══════════════════════════════════════════ */
  const dots = [GOLD1, GOLD2, GREEN, PURPLE, TEAL, "#fff", "#FF6B6B"];
  for (let i = 0; i < 50; i++) {
    const bx = rand() * W;
    const by = rand() * H;
    const br = 1.2 + rand() * 3.5;
    ctx.save();
    ctx.globalAlpha = 0.07 + rand() * 0.22;
    const dc = dots[Math.floor(rand() * dots.length)];
    ctx.shadowColor = dc;
    ctx.shadowBlur  = 6;
    ctx.fillStyle   = dc;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* ══════════════════════════════════════════
     TOP LEFT — EpochRadar logo + tagline
  ══════════════════════════════════════════ */
  const lx = 52, ly = 60;

  // Halo glow
  ctx.save();
  ctx.shadowColor = GOLD1;
  ctx.shadowBlur  = 32;
  ctx.fillStyle = "rgba(255,215,0,0.30)";
  ctx.beginPath();
  ctx.arc(lx, ly, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Rings
  ctx.fillStyle = PURPLE;
  ctx.beginPath(); ctx.arc(lx, ly, 9, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = GOLD1; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(lx, ly, 14, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = GREEN; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(lx, ly, 20, 0, Math.PI * 2); ctx.stroke();

  // Name
  ctx.font = "800 28px ui-monospace,'SF Mono',monospace";
  ctx.fillStyle = "#fff";
  ctx.textAlign = "left";
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur  = 10;
  ctx.fillText("EpochRadar", 82, 54);
  ctx.shadowBlur = 0;

  // Tagline
  ctx.font = "500 14px -apple-system,sans-serif";
  ctx.fillStyle = GOLD2;
  ctx.fillText("✦ Solana Airdrop Scanner", 83, 76);

  /* ══════════════════════════════════════════
     TOP RIGHT — Wallet chip
  ══════════════════════════════════════════ */
  const walletLabel = data.walletAddress
    ? `${data.walletAddress.slice(0, 6)}…${data.walletAddress.slice(-4)}`
    : "Demo Wallet";
  ctx.font = "600 14px ui-monospace,monospace";
  const chipW = ctx.measureText(walletLabel).width + 36;
  const chipX = W - chipW - 40;
  const chipY = 34;
  roundRect(ctx, chipX, chipY, chipW, 36, 10);
  ctx.fillStyle = "rgba(255,215,0,0.13)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,215,0,0.42)";
  ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = GOLD3;
  ctx.textAlign = "left";
  ctx.fillText(walletLabel, chipX + 18, chipY + 24);

  /* Profile pic */
  if (profileImg) {
    const pr = 26, px2 = chipX - pr - 14, py2 = chipY + 18;
    ctx.save();
    ctx.beginPath(); ctx.arc(px2, py2, pr, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(profileImg, px2 - pr, py2 - pr, pr * 2, pr * 2);
    ctx.restore();
    ctx.save();
    ctx.shadowColor = GOLD1; ctx.shadowBlur = 12;
    ctx.strokeStyle = GOLD1; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(px2, py2, pr + 1, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  /* ══════════════════════════════════════════
     CENTRE — MASSIVE dollar value
     Placed in the lower half so the SpongeBob
     image is fully visible above it
  ══════════════════════════════════════════ */
  const valueStr = data.totalValue > 0
    ? `$${data.totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "$0.00";

  const vy = 700; // vertical anchor for the big number

  // Eyebrow
  ctx.font = "700 15px -apple-system,sans-serif";
  ctx.fillStyle = "rgba(255,215,0,0.70)";
  ctx.textAlign = "center";
  ctx.fillText("✦  YOUR ELIGIBLE AIRDROPS  ✦", W / 2, vy - 32);

  // Soft glow behind number
  ctx.save();
  const vg = ctx.createRadialGradient(W / 2, vy, 0, W / 2, vy, 320);
  vg.addColorStop(0, "rgba(255,200,0,0.30)");
  vg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, vy - 120, W, 200);
  ctx.restore();

  // Giant gradient number — 130px bold
  ctx.save();
  ctx.font = "900 130px -apple-system,BlinkMacSystemFont,sans-serif";
  const tw = ctx.measureText(valueStr).width;
  const tGrad = ctx.createLinearGradient(W / 2 - tw / 2, 0, W / 2 + tw / 2, 0);
  tGrad.addColorStop(0,    GOLD3);
  tGrad.addColorStop(0.25, GOLD1);
  tGrad.addColorStop(0.55, GOLD2);
  tGrad.addColorStop(0.80, GREEN);
  tGrad.addColorStop(1,    TEAL);
  ctx.fillStyle = tGrad;
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(255,200,0,0.65)";
  ctx.shadowBlur  = 38;
  ctx.fillText(valueStr, W / 2, vy);
  ctx.restore();

  // Subtitle under value
  ctx.font = "400 22px -apple-system,sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.60)";
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur  = 8;
  ctx.fillText("worth of Solana airdrops found  🪂", W / 2, vy + 48);
  ctx.shadowBlur = 0;

  /* ══════════════════════════════════════════
     STATS PILLS — Eligible / Likely / Total
  ══════════════════════════════════════════ */
  const statsY = vy + 96;
  const pills = [
    { label: "ELIGIBLE",  val: data.eligibleCount,                     col: GOLD1,  bg: "rgba(255,215,0,0.14)",  border: "rgba(255,215,0,0.45)"  },
    { label: "LIKELY",    val: data.likelyCount,                       col: GREEN,  bg: "rgba(20,241,149,0.12)", border: "rgba(20,241,149,0.40)" },
    { label: "TOTAL",     val: data.eligibleCount + data.likelyCount,  col: PURPLE, bg: "rgba(153,69,255,0.12)", border: "rgba(153,69,255,0.40)" },
  ];

  const pW = 234, pH = 76, pGap = 16;
  const totalW = pills.length * pW + (pills.length - 1) * pGap;
  let px = (W - totalW) / 2;

  for (const p of pills) {
    roundRect(ctx, px, statsY, pW, pH, 16);
    ctx.fillStyle = p.bg; ctx.fill();
    ctx.strokeStyle = p.border; ctx.lineWidth = 1.5; ctx.stroke();

    ctx.font = "700 13px -apple-system,sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.textAlign = "center";
    ctx.fillText(p.label, px + pW / 2, statsY + 24);

    ctx.save();
    ctx.shadowColor = p.col; ctx.shadowBlur = 14;
    ctx.font = "800 34px -apple-system,sans-serif";
    ctx.fillStyle = p.col;
    ctx.fillText(String(p.val), px + pW / 2, statsY + 62);
    ctx.restore();

    px += pW + pGap;
  }

  /* ══════════════════════════════════════════
     AIRDROP CARDS — top 4
  ══════════════════════════════════════════ */
  const top = data.topAirdrops.slice(0, 4);
  if (top.length > 0) {
    const cardsY = statsY + pH + 20;
    const margin = 36;
    const cW = Math.floor((W - margin * 2 - (top.length - 1) * 10) / top.length);
    const cH = 88;

    ctx.font = "700 13px -apple-system,sans-serif";
    ctx.fillStyle = "rgba(255,215,0,0.55)";
    ctx.textAlign = "left";
    ctx.fillText("✦  TOP AIRDROPS", margin, cardsY - 10);

    top.forEach((item, i) => {
      const cx = margin + i * (cW + 10);
      const col = item.status === "Eligible" ? GOLD1 : item.status === "Likely" ? GREEN : TEAL;
      const colBg  = col === GOLD1 ? "rgba(255,215,0,0.10)"  : col === GREEN ? "rgba(20,241,149,0.10)" : "rgba(0,194,255,0.10)";

      roundRect(ctx, cx, cardsY, cW, cH, 12);
      ctx.fillStyle = colBg; ctx.fill();
      ctx.strokeStyle = col + "55"; ctx.lineWidth = 1.5; ctx.stroke();

      // Icon
      ctx.save();
      ctx.shadowColor = col; ctx.shadowBlur = 14;
      ctx.fillStyle = col + "20";
      ctx.beginPath(); ctx.arc(cx + 22, cardsY + 25, 15, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = col + "88"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx + 22, cardsY + 25, 15, 0, Math.PI * 2); ctx.stroke();
      ctx.font = "800 11px -apple-system,sans-serif";
      ctx.fillStyle = col; ctx.textAlign = "center";
      ctx.fillText(item.project.slice(0, 2).toUpperCase(), cx + 22, cardsY + 29);

      const nm = item.project.length > 11 ? item.project.slice(0, 10) + "…" : item.project;
      ctx.font = "700 13px -apple-system,sans-serif";
      ctx.fillStyle = "#fff"; ctx.textAlign = "left";
      ctx.fillText(nm, cx + 8, cardsY + 56);

      ctx.font = "700 13px -apple-system,sans-serif";
      ctx.fillStyle = col;
      ctx.fillText(item.estimatedValue ?? "TBD", cx + 8, cardsY + 74);

      // Bottom glow bar
      const bG = ctx.createLinearGradient(cx, 0, cx + cW, 0);
      bG.addColorStop(0,   col + "00");
      bG.addColorStop(0.5, col + "aa");
      bG.addColorStop(1,   col + "00");
      ctx.fillStyle = bG;
      ctx.fillRect(cx, cardsY + cH - 3, cW, 3);
    });
  }

  /* ══════════════════════════════════════════
     OUTER BORDER — gold glow
  ══════════════════════════════════════════ */
  ctx.save();
  ctx.shadowColor = GOLD1; ctx.shadowBlur = 24;
  const border = ctx.createLinearGradient(0, 0, W, H);
  border.addColorStop(0,    GOLD1 + "ee");
  border.addColorStop(0.35, PURPLE + "88");
  border.addColorStop(0.70, TEAL + "66");
  border.addColorStop(1,    GREEN + "cc");
  ctx.strokeStyle = border; ctx.lineWidth = 3.5;
  roundRect(ctx, 1.5, 1.5, W - 3, H - 3, 24);
  ctx.stroke();
  ctx.restore();

  /* Watermark */
  ctx.font = "600 14px ui-monospace,monospace";
  ctx.fillStyle = "rgba(255,215,0,0.32)";
  ctx.textAlign = "center";
  ctx.fillText("epochradar.com  ✦  Solana Airdrop Checker", W / 2, H - 18);
}
