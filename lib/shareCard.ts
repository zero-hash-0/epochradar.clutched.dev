/**
 * Draws a shareable airdrop results card onto a canvas.
 * Features: SpongeBob art bottom-right, bold Solana gradient headline,
 * frosted glass panels, rain of $ symbols, confetti dots.
 */

export type ShareCardData = {
  walletAddress: string | null;
  eligibleCount: number;
  likelyCount: number;
  totalValue: number;
  topAirdrops: Array<{ project: string; status: string; estimatedValue?: string }>;
  solPrice?: number;
};

const PURPLE = "#9945FF";
const GREEN  = "#14F195";
const TEAL   = "#00C2FF";

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
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

/* Seeded pseudo-random so the confetti looks the same every render */
function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

export function drawShareCard(
  canvas: HTMLCanvasElement,
  data: ShareCardData,
  bgImage?: HTMLImageElement,
): void {
  const W = 900;
  const H = 480;
  canvas.width  = W;
  canvas.height = H;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const rand = seededRand(42);

  /* ── 1. Dark background ── */
  ctx.fillStyle = "#070710";
  ctx.fillRect(0, 0, W, H);

  /* ── 2. Ambient glows ── */
  const gPurple = ctx.createRadialGradient(0, 0, 0, 0, 0, 500);
  gPurple.addColorStop(0, "rgba(153,69,255,0.35)");
  gPurple.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gPurple;
  ctx.fillRect(0, 0, W, H);

  const gGreen = ctx.createRadialGradient(W, H, 0, W, H, 480);
  gGreen.addColorStop(0, "rgba(20,241,149,0.3)");
  gGreen.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gGreen;
  ctx.fillRect(0, 0, W, H);

  const gTeal = ctx.createRadialGradient(W * 0.5, 0, 0, W * 0.5, 0, 350);
  gTeal.addColorStop(0, "rgba(0,194,255,0.15)");
  gTeal.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gTeal;
  ctx.fillRect(0, 0, W, H);

  /* ── 3. Floating $ rain (behind everything) ── */
  const symbols = ["$", "◎", "🪂", "$", "$", "◎", "$"];
  for (let i = 0; i < 38; i++) {
    const sx   = rand() * W;
    const sy   = rand() * H;
    const size = 9 + rand() * 22;
    const alpha = 0.04 + rand() * 0.13;
    const sym = symbols[Math.floor(rand() * symbols.length)];
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `${size}px -apple-system, sans-serif`;
    ctx.fillStyle = [GREEN, TEAL, PURPLE, "#fff"][Math.floor(rand() * 4)];
    ctx.textAlign = "center";
    ctx.fillText(sym, sx, sy);
    ctx.restore();
  }

  /* ── 4. SpongeBob image — right side, bottom-anchored ── */
  if (bgImage) {
    const imgW = 320;
    const imgH = (bgImage.naturalHeight / bgImage.naturalWidth) * imgW;
    const imgX = W - imgW + 10;
    const imgY = H - imgH + 20;

    // Clip to right half so it doesn't obscure text
    ctx.save();
    ctx.beginPath();
    ctx.rect(W * 0.46, 0, W * 0.54, H);
    ctx.clip();

    // Fade mask: transparent on left edge, opaque on right
    const fadeGrad = ctx.createLinearGradient(W * 0.46, 0, W * 0.56, 0);
    fadeGrad.addColorStop(0, "rgba(0,0,0,0)");
    fadeGrad.addColorStop(1, "rgba(0,0,0,1)");

    // Draw image
    ctx.globalAlpha = 0.85;
    ctx.drawImage(bgImage, imgX, imgY, imgW, imgH);

    // Overlay fade on left edge of image
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = fadeGrad;
    ctx.fillRect(W * 0.46, 0, 90, H);

    ctx.restore();
  }

  /* ── 5. Left content panel (frosted glass) ── */
  ctx.save();
  roundRect(ctx, 24, 20, W * 0.52, H - 40, 18);
  ctx.fillStyle = "rgba(7,7,16,0.72)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  /* ── 6. Top bar inside panel ── */
  // Logo dot — Solana style (purple filled, green ring)
  ctx.fillStyle = PURPLE;
  ctx.beginPath();
  ctx.arc(50, 52, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(50, 52, 11, 0, Math.PI * 2);
  ctx.stroke();

  ctx.font = "700 16px ui-monospace, 'SF Mono', Menlo, monospace";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.fillText("EpochRadar", 68, 57);

  // Wallet chip
  const wallet = data.walletAddress
    ? `${data.walletAddress.slice(0, 5)}…${data.walletAddress.slice(-4)}`
    : "Demo wallet";
  ctx.font = "500 11px ui-monospace, monospace";
  const chipW = ctx.measureText(wallet).width + 22;
  roundRect(ctx, 68, 63, chipW, 18, 5);
  ctx.fillStyle = "rgba(153,69,255,0.2)";
  ctx.fill();
  ctx.fillStyle = PURPLE;
  ctx.textAlign = "left";
  ctx.fillText(wallet, 79, 76);

  /* ── 7. Eyebrow ── */
  ctx.font = "600 10px -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.letterSpacing = "0.12em";
  ctx.fillText("SOLANA AIRDROP RESULTS", 40, 115);
  ctx.letterSpacing = "0";

  /* ── 8. Big dollar value — 3-color gradient ── */
  const totalStr = `$${data.totalValue.toFixed(2)}`;
  ctx.font = "800 64px -apple-system, BlinkMacSystemFont, sans-serif";
  const tw = ctx.measureText(totalStr).width;
  const grad = ctx.createLinearGradient(40, 120, 40 + tw, 185);
  grad.addColorStop(0,   PURPLE);
  grad.addColorStop(0.45, TEAL);
  grad.addColorStop(1,   GREEN);
  ctx.fillStyle = grad;
  ctx.textAlign = "left";
  ctx.fillText(totalStr, 40, 183);

  // Subtitle
  ctx.font = "400 13px -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.42)";
  ctx.fillText("worth of airdrops found on Solana", 42, 205);

  /* ── 9. Stats row ── */
  const stats = [
    { label: "Eligible",  val: data.eligibleCount,                       color: GREEN  },
    { label: "Likely",    val: data.likelyCount,                          color: TEAL   },
    { label: "Total",     val: data.eligibleCount + data.likelyCount,     color: PURPLE },
  ];

  let sx = 40;
  for (const s of stats) {
    const bw = 88, bh = 56, by = 220;
    roundRect(ctx, sx, by, bw, bh, 10);
    ctx.fillStyle = s.color + "18";
    ctx.fill();
    ctx.strokeStyle = s.color + "44";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = "500 10px -apple-system, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.38)";
    ctx.textAlign = "center";
    ctx.fillText(s.label, sx + bw / 2, by + 16);

    ctx.font = "700 22px -apple-system, sans-serif";
    ctx.fillStyle = s.color;
    ctx.fillText(String(s.val), sx + bw / 2, by + 42);

    sx += bw + 8;
  }

  /* ── 10. Gradient divider ── */
  const divG = ctx.createLinearGradient(40, 0, 440, 0);
  divG.addColorStop(0, PURPLE + "55");
  divG.addColorStop(0.5, TEAL + "33");
  divG.addColorStop(1, GREEN + "55");
  ctx.strokeStyle = divG;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 292);
  ctx.lineTo(440, 292);
  ctx.stroke();

  /* ── 11. Top airdrops row ── */
  ctx.font = "600 10px -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.textAlign = "left";
  ctx.fillText("TOP AIRDROPS", 40, 314);

  const top = data.topAirdrops.slice(0, 4);
  const cardW = Math.min(88, (400 / Math.max(top.length, 1)) - 8);

  top.forEach((item, i) => {
    const cx = 40 + i * (cardW + 8);
    const cy = 324;
    const ch = 86;
    const col = item.status === "Eligible" ? GREEN : item.status === "Likely" ? TEAL : PURPLE;

    roundRect(ctx, cx, cy, cardW, ch, 9);
    ctx.fillStyle = col + "12";
    ctx.fill();
    ctx.strokeStyle = col + "33";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Logo circle
    ctx.fillStyle = col + "22";
    ctx.beginPath();
    ctx.arc(cx + 18, cy + 20, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col + "66";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = "700 9px -apple-system, sans-serif";
    ctx.fillStyle = col;
    ctx.textAlign = "center";
    ctx.fillText(item.project.slice(0, 2).toUpperCase(), cx + 18, cy + 24);

    // Name
    ctx.font = "600 10px -apple-system, sans-serif";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    const nm = item.project.length > 10 ? item.project.slice(0, 9) + "…" : item.project;
    ctx.fillText(nm, cx + 6, cy + 46);

    // Value
    ctx.font = "500 9px -apple-system, sans-serif";
    ctx.fillStyle = col;
    ctx.fillText(item.estimatedValue ?? "TBD", cx + 6, cy + 60);

    // Status pill
    ctx.font = "600 8px -apple-system, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fillText(item.status.toUpperCase(), cx + 6, cy + 77);
  });

  /* ── 12. Confetti dots scattered across card ── */
  const confettiColors = [GREEN, TEAL, PURPLE, "#FFD700", "#FF6B6B"];
  for (let i = 0; i < 28; i++) {
    const cx2 = rand() * W;
    const cy2 = rand() * H;
    const r   = 1.5 + rand() * 3;
    const alpha = 0.15 + rand() * 0.35;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = confettiColors[Math.floor(rand() * confettiColors.length)];
    ctx.beginPath();
    ctx.arc(cx2, cy2, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* ── 13. Gradient border on whole card ── */
  const borderG = ctx.createLinearGradient(0, 0, W, H);
  borderG.addColorStop(0,   PURPLE + "88");
  borderG.addColorStop(0.5, TEAL   + "44");
  borderG.addColorStop(1,   GREEN  + "88");
  ctx.strokeStyle = borderG;
  ctx.lineWidth = 1.5;
  roundRect(ctx, 1, 1, W - 2, H - 2, 20);
  ctx.stroke();

  /* ── 14. Watermark ── */
  ctx.font = "500 11px ui-monospace, monospace";
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.textAlign = "center";
  ctx.fillText("epochradar.com  ·  Solana Airdrop Checker", W / 2, H - 12);
}
