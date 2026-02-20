/**
 * Draws a shareable airdrop results card onto a canvas.
 * Tactical dark style with neon-cyan + amber accents.
 */

export type ShareCardData = {
  walletAddress: string | null;
  eligibleCount: number;
  likelyCount: number;
  totalValue: number;
  topAirdrops: Array<{ project: string; status: string; estimatedValue?: string }>;
  solPrice?: number;
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
  const W = 800;
  const H = 440;
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  /* ── Background ── */
  ctx.fillStyle = "#0b0f16";
  ctx.fillRect(0, 0, W, H);

  /* ── Ambient glows ── */
  const g1 = ctx.createRadialGradient(-40, -40, 0, -40, -40, 420);
  g1.addColorStop(0, "rgba(255,113,64,0.22)");
  g1.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, W, H);

  const g2 = ctx.createRadialGradient(W + 40, H + 40, 0, W + 40, H + 40, 380);
  g2.addColorStop(0, "rgba(184,239,109,0.18)");
  g2.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, W, H);

  const g3 = ctx.createRadialGradient(W * 0.55, H * 0.2, 0, W * 0.55, H * 0.2, 250);
  g3.addColorStop(0, "rgba(35,211,255,0.12)");
  g3.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g3;
  ctx.fillRect(0, 0, W, H);

  /* ── Gradient border ── */
  ctx.save();
  const borderGrad = ctx.createLinearGradient(0, 0, W, H);
  borderGrad.addColorStop(0, "rgba(255,196,109,0.44)");
  borderGrad.addColorStop(0.5, "rgba(35,211,255,0.28)");
  borderGrad.addColorStop(1, "rgba(184,239,109,0.4)");
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 1.5;
  roundRect(ctx, 1, 1, W - 2, H - 2, 20);
  ctx.stroke();
  ctx.restore();

  /* ── Top bar ── */
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  roundRect(ctx, 20, 18, W - 40, 54, 12);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  ctx.stroke();

  /* Solana logo mark — two colored circles */
  const dotX = 46, dotY = 45;
  // Amber circle
  ctx.fillStyle = SOL_AMBER;
  ctx.beginPath();
  ctx.arc(dotX, dotY, 7, 0, Math.PI * 2);
  ctx.fill();
  // Neon ring
  ctx.strokeStyle = SOL_NEON;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(dotX, dotY, 10, 0, Math.PI * 2);
  ctx.stroke();

  // "EpochRadar"
  ctx.font = "700 17px ui-monospace, 'SF Mono', Menlo, monospace";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.fillText("EpochRadar", 66, 50);

  // Powered by Solana badge
  const badgeText = "Powered by Solana";
  ctx.font = "500 11px -apple-system, sans-serif";
  const bw = ctx.measureText(badgeText).width + 20;
  roundRect(ctx, 82, 54, bw, 16, 4);
  ctx.fillStyle = `${SOL_AMBER}2A`;
  ctx.fill();
  ctx.fillStyle = SOL_AMBER;
  ctx.textAlign = "left";
  ctx.fillText(badgeText, 92, 66);

  // Wallet address
  const walletLabel = data.walletAddress
    ? `${data.walletAddress.slice(0, 6)}...${data.walletAddress.slice(-4)}`
    : "Demo wallet";
  ctx.font = "500 12px ui-monospace, 'SF Mono', Menlo, monospace";
  const ww = ctx.measureText(walletLabel).width + 24;
  roundRect(ctx, W - 20 - ww - 4, 28, ww, 30, 8);
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#666";
  ctx.textAlign = "center";
  ctx.fillText(walletLabel, W - 20 - ww / 2 - 4, 48);

  /* ── Main headline ── */
  ctx.textAlign = "left";
  ctx.font = "400 13px -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.fillText("Total airdrop value found", 34, 108);

  ctx.font = "700 54px -apple-system, sans-serif";
  const totalStr = `$${data.totalValue.toFixed(2)}`;
  const headGrad = ctx.createLinearGradient(34, 118, 34 + ctx.measureText(totalStr).width, 174);
  headGrad.addColorStop(0, SOL_AMBER);
  headGrad.addColorStop(0.5, SOL_NEON);
  headGrad.addColorStop(1, SOL_LIME);
  ctx.fillStyle = headGrad;
  ctx.fillText(totalStr, 34, 172);

  /* ── Stats pills ── */
  const stats = [
    { label: "Eligible",  value: String(data.eligibleCount),                         color: SOL_LIME,  bg: "rgba(184,239,109,0.10)",  border: "rgba(184,239,109,0.3)"  },
    { label: "Likely",    value: String(data.likelyCount),                            color: SOL_NEON,  bg: "rgba(35,211,255,0.10)",   border: "rgba(35,211,255,0.3)"   },
    { label: "Airdrops",  value: String(data.eligibleCount + data.likelyCount),       color: SOL_AMBER, bg: "rgba(255,196,109,0.10)",  border: "rgba(255,196,109,0.32)"  },
  ];

  let px = 34;
  for (const stat of stats) {
    ctx.font = "600 11px -apple-system, sans-serif";
    const lw = ctx.measureText(stat.label).width;
    ctx.font = "700 16px -apple-system, sans-serif";
    const vw = ctx.measureText(stat.value).width;
    const pillW = Math.max(lw, vw) + 36;
    const pillH = 52;
    const py = 194;

    roundRect(ctx, px, py, pillW, pillH, 10);
    ctx.fillStyle = stat.bg;
    ctx.fill();
    ctx.strokeStyle = stat.border;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = "500 10.5px -apple-system, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.textAlign = "center";
    ctx.fillText(stat.label, px + pillW / 2, py + 17);

    ctx.font = "700 18px -apple-system, sans-serif";
    ctx.fillStyle = stat.color;
    ctx.fillText(stat.value, px + pillW / 2, py + 40);

    px += pillW + 10;
  }

  /* ── Divider ── */
  const divGrad = ctx.createLinearGradient(34, 0, W - 34, 0);
  divGrad.addColorStop(0, "rgba(255,196,109,0.3)");
  divGrad.addColorStop(0.5, "rgba(35,211,255,0.2)");
  divGrad.addColorStop(1, "rgba(184,239,109,0.3)");
  ctx.strokeStyle = divGrad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(34, 266);
  ctx.lineTo(W - 34, 266);
  ctx.stroke();

  /* ── Top airdrops ── */
  ctx.font = "600 11px -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.textAlign = "left";
  ctx.fillText("TOP AIRDROPS", 34, 290);

  const topItems = data.topAirdrops.slice(0, 4);
  const colW = (W - 68) / Math.max(topItems.length, 1);

  topItems.forEach((item, i) => {
    const ix = 34 + i * colW;
    const iy = 304;
    const iw = colW - 10;
    const ih = 94;

    roundRect(ctx, ix, iy, iw, ih, 10);
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Logo circle with Solana gradient
    const logoGrad = ctx.createLinearGradient(ix + 8, iy + 8, ix + 36, iy + 36);
    logoGrad.addColorStop(0, SOL_AMBER);
    logoGrad.addColorStop(1, SOL_NEON);
    ctx.fillStyle = `rgba(255,196,109,0.14)`;
    ctx.beginPath();
    ctx.arc(ix + 22, iy + 24, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = logoGrad;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = "700 10px -apple-system, sans-serif";
    ctx.fillStyle = SOL_LIME;
    ctx.textAlign = "center";
    ctx.fillText(item.project.slice(0, 2).toUpperCase(), ix + 22, iy + 28);

    // Project name
    ctx.font = "600 12px -apple-system, sans-serif";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    const name = item.project.length > 13 ? item.project.slice(0, 12) + "…" : item.project;
    ctx.fillText(name, ix + 40, iy + 20);

    // Est value
    const valColor = item.status === "Eligible" ? SOL_LIME : item.status === "Likely" ? SOL_NEON : SOL_AMBER;
    ctx.font = "500 11px -apple-system, sans-serif";
    ctx.fillStyle = valColor;
    ctx.fillText(item.estimatedValue ?? "TBD", ix + 40, iy + 36);

    // Status badge
    ctx.font = "600 10px -apple-system, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillText(item.status, ix + 12, iy + 76);
  });

  /* ── Bottom watermark ── */
  ctx.font = "500 11px ui-monospace, 'SF Mono', Menlo, monospace";
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.textAlign = "center";
  ctx.fillText("epochradar.com  ·  Solana Airdrop Checker", W / 2, H - 14);
}
