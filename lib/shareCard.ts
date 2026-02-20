/**
 * EpochRadar Share Card — Gold Edition
 * SpongeBob art composited right side, gold glow headline,
 * shimmer lines, confetti, full Solana branding.
 */

export type ShareCardData = {
  walletAddress: string | null;
  eligibleCount: number;
  likelyCount: number;
  totalValue: number;
  topAirdrops: Array<{ project: string; status: string; estimatedValue?: string }>;
  solPrice?: number;
  profilePic?: string; // dataURL
};

const GOLD1  = "#FFD700";
const GOLD2  = "#FFA500";
const GOLD3  = "#FFE566";
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
  profileImg?: HTMLImageElement,
): void {
  const W = 960;
  const H = 500;
  canvas.width  = W;
  canvas.height = H;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const rand = seededRand(77);

  /* ══ 1. Deep dark bg ══ */
  ctx.fillStyle = "#08070f";
  ctx.fillRect(0, 0, W, H);

  /* ══ 2. Ambient glows ══ */
  // Gold top-left
  const gGold = ctx.createRadialGradient(0, 0, 0, 0, 0, 560);
  gGold.addColorStop(0, "rgba(255,180,0,0.28)");
  gGold.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gGold;
  ctx.fillRect(0, 0, W, H);

  // Purple mid
  const gPurple = ctx.createRadialGradient(W * 0.45, H * 0.5, 0, W * 0.45, H * 0.5, 380);
  gPurple.addColorStop(0, "rgba(153,69,255,0.2)");
  gPurple.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gPurple;
  ctx.fillRect(0, 0, W, H);

  // Green bottom-right
  const gGreen = ctx.createRadialGradient(W, H, 0, W, H, 420);
  gGreen.addColorStop(0, "rgba(20,241,149,0.22)");
  gGreen.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gGreen;
  ctx.fillRect(0, 0, W, H);

  /* ══ 3. Gold shimmer diagonal lines ══ */
  ctx.save();
  for (let i = 0; i < 14; i++) {
    const x = -200 + i * 90;
    ctx.strokeStyle = `rgba(255,215,0,${0.02 + rand() * 0.04})`;
    ctx.lineWidth = 1 + rand() * 1.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + H, H);
    ctx.stroke();
  }
  ctx.restore();

  /* ══ 4. Floating money symbols ══ */
  const symbols = ["$", "◎", "💰", "$", "🪂", "◎", "$", "✦"];
  for (let i = 0; i < 42; i++) {
    const sx = rand() * W;
    const sy = rand() * H;
    const size = 8 + rand() * 24;
    const alpha = 0.03 + rand() * 0.1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `${size}px -apple-system, sans-serif`;
    ctx.fillStyle = [GOLD1, GOLD2, GREEN, PURPLE, "#fff"][Math.floor(rand() * 5)];
    ctx.textAlign = "center";
    ctx.fillText(symbols[Math.floor(rand() * symbols.length)], sx, sy);
    ctx.restore();
  }

  /* ══ 5. SpongeBob image — right side fade ══ */
  if (bgImage) {
    const aspect = bgImage.naturalHeight / bgImage.naturalWidth;
    const imgW = 380;
    const imgH = aspect * imgW;
    const imgX = W - imgW + 20;
    const imgY = H - imgH + 30;

    ctx.save();
    ctx.beginPath();
    ctx.rect(W * 0.44, 0, W * 0.56, H);
    ctx.clip();

    // draw image
    ctx.globalAlpha = 0.9;
    ctx.drawImage(bgImage, imgX, imgY, imgW, imgH);

    // fade left edge
    ctx.globalCompositeOperation = "destination-out";
    const fade = ctx.createLinearGradient(W * 0.44, 0, W * 0.58, 0);
    fade.addColorStop(0, "rgba(0,0,0,1)");
    fade.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = fade;
    ctx.fillRect(W * 0.44, 0, W * 0.15, H);

    // gold glow overlay on SpongeBob
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 0.18;
    const spongGlow = ctx.createRadialGradient(W * 0.72, H * 0.6, 0, W * 0.72, H * 0.6, 200);
    spongGlow.addColorStop(0, GOLD1);
    spongGlow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = spongGlow;
    ctx.fillRect(W * 0.44, 0, W * 0.56, H);

    ctx.restore();
  }

  /* ══ 6. Left frosted glass panel ══ */
  ctx.save();
  roundRect(ctx, 22, 18, W * 0.50, H - 36, 20);
  ctx.fillStyle = "rgba(8,7,15,0.80)";
  ctx.fill();
  // gold inner border
  const panelBorder = ctx.createLinearGradient(22, 18, 22, H - 18);
  panelBorder.addColorStop(0, "rgba(255,215,0,0.35)");
  panelBorder.addColorStop(0.5, "rgba(153,69,255,0.15)");
  panelBorder.addColorStop(1, "rgba(20,241,149,0.25)");
  ctx.strokeStyle = panelBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  /* ══ 7. Logo row ══ */
  // Animated-style double ring logo
  const lx = 50, ly = 52;
  // Outer glow
  const logoGlow = ctx.createRadialGradient(lx, ly, 0, lx, ly, 22);
  logoGlow.addColorStop(0, "rgba(255,215,0,0.4)");
  logoGlow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = logoGlow;
  ctx.beginPath();
  ctx.arc(lx, ly, 22, 0, Math.PI * 2);
  ctx.fill();
  // Purple fill
  ctx.fillStyle = PURPLE;
  ctx.beginPath();
  ctx.arc(lx, ly, 8, 0, Math.PI * 2);
  ctx.fill();
  // Gold ring
  ctx.strokeStyle = GOLD1;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(lx, ly, 12, 0, Math.PI * 2);
  ctx.stroke();
  // Green outer ring
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(lx, ly, 16, 0, Math.PI * 2);
  ctx.stroke();

  // "EpochRadar" text
  ctx.font = "700 18px ui-monospace, 'SF Mono', monospace";
  ctx.fillStyle = "#fff";
  ctx.textAlign = "left";
  ctx.fillText("EpochRadar", 72, 48);

  // "by Solana" sub-badge
  ctx.font = "500 10px -apple-system, sans-serif";
  ctx.fillStyle = GOLD2;
  ctx.fillText("✦ Solana Network", 73, 63);

  // Wallet chip (top right of panel)
  const wallet = data.walletAddress
    ? `${data.walletAddress.slice(0, 6)}…${data.walletAddress.slice(-4)}`
    : "Demo Wallet";
  ctx.font = "500 11px ui-monospace, monospace";
  const chipW = ctx.measureText(wallet).width + 24;
  const chipX = W * 0.50 - chipW - 10;
  roundRect(ctx, chipX, 36, chipW, 26, 7);
  ctx.fillStyle = "rgba(255,215,0,0.10)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,215,0,0.28)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = GOLD3;
  ctx.textAlign = "left";
  ctx.fillText(wallet, chipX + 12, 54);

  /* ══ 8. Profile pic (if provided) ══ */
  if (profileImg) {
    const pr = 22;
    const px2 = chipX - pr * 2 - 8;
    const py2 = 36 + 13;
    ctx.save();
    ctx.beginPath();
    ctx.arc(px2, py2, pr, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(profileImg, px2 - pr, py2 - pr, pr * 2, pr * 2);
    ctx.restore();
    // gold ring around profile pic
    ctx.strokeStyle = GOLD1;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px2, py2, pr + 1, 0, Math.PI * 2);
    ctx.stroke();
  }

  /* ══ 9. EYEBROW ══ */
  ctx.font = "700 10px -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255,215,0,0.5)";
  ctx.textAlign = "left";
  ctx.fillText("✦  SOLANA AIRDROP RESULTS  ✦", 38, 108);

  /* ══ 10. BIG gold gradient value ══ */
  const totalStr = `$${data.totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  ctx.font = "800 68px -apple-system, BlinkMacSystemFont, sans-serif";
  const tw = ctx.measureText(totalStr).width;

  // Gold glow behind text
  const textGlow = ctx.createRadialGradient(38 + tw / 2, 165, 0, 38 + tw / 2, 165, tw * 0.7);
  textGlow.addColorStop(0, "rgba(255,200,0,0.22)");
  textGlow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = textGlow;
  ctx.fillRect(30, 115, tw + 30, 80);

  // Gradient text
  const textGrad = ctx.createLinearGradient(38, 118, 38 + tw, 182);
  textGrad.addColorStop(0,    GOLD3);
  textGrad.addColorStop(0.3,  GOLD1);
  textGrad.addColorStop(0.6,  GOLD2);
  textGrad.addColorStop(0.85, GREEN);
  textGrad.addColorStop(1,    TEAL);
  ctx.fillStyle = textGrad;
  ctx.textAlign = "left";
  ctx.fillText(totalStr, 38, 182);

  // Subtitle
  ctx.font = "400 13px -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.fillText("worth of Solana airdrops found 🪂", 40, 204);

  /* ══ 11. Stats pills ══ */
  const stats = [
    { label: "Eligible",  val: data.eligibleCount,                         color: GOLD1,   bg: "rgba(255,215,0,0.12)",   border: "rgba(255,215,0,0.35)"   },
    { label: "Likely",    val: data.likelyCount,                            color: GREEN,   bg: "rgba(20,241,149,0.10)",  border: "rgba(20,241,149,0.30)"  },
    { label: "Total",     val: data.eligibleCount + data.likelyCount,       color: PURPLE,  bg: "rgba(153,69,255,0.10)",  border: "rgba(153,69,255,0.30)"  },
  ];

  let sx = 38;
  for (const s of stats) {
    const bw = 92, bh = 58, by = 220;
    roundRect(ctx, sx, by, bw, bh, 11);
    ctx.fillStyle = s.bg;
    ctx.fill();
    ctx.strokeStyle = s.border;
    ctx.lineWidth = 1;
    ctx.stroke();

    // label
    ctx.font = "500 10px -apple-system, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.38)";
    ctx.textAlign = "center";
    ctx.fillText(s.label, sx + bw / 2, by + 17);

    // value with glow
    ctx.save();
    ctx.shadowColor = s.color;
    ctx.shadowBlur = 8;
    ctx.font = "700 24px -apple-system, sans-serif";
    ctx.fillStyle = s.color;
    ctx.fillText(String(s.val), sx + bw / 2, by + 44);
    ctx.restore();

    sx += bw + 8;
  }

  /* ══ 12. Gold divider with stars ══ */
  const divGrad = ctx.createLinearGradient(38, 0, W * 0.49, 0);
  divGrad.addColorStop(0,   "rgba(255,215,0,0.6)");
  divGrad.addColorStop(0.5, "rgba(153,69,255,0.3)");
  divGrad.addColorStop(1,   "rgba(20,241,149,0.5)");
  ctx.strokeStyle = divGrad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(38, 296);
  ctx.lineTo(W * 0.49 - 10, 296);
  ctx.stroke();

  /* ══ 13. Top airdrops ══ */
  ctx.font = "600 10px -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255,215,0,0.5)";
  ctx.textAlign = "left";
  ctx.fillText("✦  TOP AIRDROPS", 38, 316);

  const top = data.topAirdrops.slice(0, 4);
  const cardW = Math.floor((W * 0.48 - 38) / Math.max(top.length, 1)) - 8;

  top.forEach((item, i) => {
    const cx2 = 38 + i * (cardW + 8);
    const cy2 = 326;
    const ch = 108;
    const col = item.status === "Eligible" ? GOLD1 : item.status === "Likely" ? GREEN : TEAL;

    roundRect(ctx, cx2, cy2, cardW, ch, 10);
    ctx.fillStyle = col === GOLD1 ? "rgba(255,215,0,0.08)" : col === GREEN ? "rgba(20,241,149,0.08)" : "rgba(0,194,255,0.08)";
    ctx.fill();
    ctx.strokeStyle = col + "44";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Logo circle with glow
    ctx.save();
    ctx.shadowColor = col;
    ctx.shadowBlur = 10;
    ctx.fillStyle = col + "25";
    ctx.beginPath();
    ctx.arc(cx2 + 18, cy2 + 22, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = col + "88";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx2 + 18, cy2 + 22, 13, 0, Math.PI * 2);
    ctx.stroke();

    ctx.font = "700 9px -apple-system, sans-serif";
    ctx.fillStyle = col;
    ctx.textAlign = "center";
    ctx.fillText(item.project.slice(0, 2).toUpperCase(), cx2 + 18, cy2 + 26);

    ctx.font = "600 10px -apple-system, sans-serif";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    const nm = item.project.length > 10 ? item.project.slice(0, 9) + "…" : item.project;
    ctx.fillText(nm, cx2 + 6, cy2 + 50);

    ctx.font = "600 10px -apple-system, sans-serif";
    ctx.fillStyle = col;
    ctx.fillText(item.estimatedValue ?? "TBD", cx2 + 6, cy2 + 65);

    ctx.font = "500 8.5px -apple-system, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillText(item.status.toUpperCase(), cx2 + 6, cy2 + 80);

    // Bottom glow bar
    const barGrad = ctx.createLinearGradient(cx2, cy2 + ch - 4, cx2 + cardW, cy2 + ch - 4);
    barGrad.addColorStop(0, col + "00");
    barGrad.addColorStop(0.5, col + "88");
    barGrad.addColorStop(1, col + "00");
    ctx.fillStyle = barGrad;
    ctx.fillRect(cx2, cy2 + ch - 4, cardW, 3);
  });

  /* ══ 14. Confetti dots ══ */
  const confetti = [GOLD1, GOLD2, GREEN, PURPLE, TEAL, "#FF6B6B", "#fff"];
  for (let i = 0; i < 35; i++) {
    const cx3 = rand() * W;
    const cy3 = rand() * H;
    const r   = 1 + rand() * 3.5;
    ctx.save();
    ctx.globalAlpha = 0.12 + rand() * 0.4;
    ctx.shadowColor = confetti[Math.floor(rand() * confetti.length)];
    ctx.shadowBlur  = 4;
    ctx.fillStyle   = confetti[Math.floor(rand() * confetti.length)];
    ctx.beginPath();
    ctx.arc(cx3, cy3, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* ══ 15. Outer gradient border with gold glow ══ */
  ctx.save();
  ctx.shadowColor = GOLD1;
  ctx.shadowBlur  = 16;
  const outerBorder = ctx.createLinearGradient(0, 0, W, H);
  outerBorder.addColorStop(0,    GOLD1 + "cc");
  outerBorder.addColorStop(0.35, PURPLE + "88");
  outerBorder.addColorStop(0.7,  TEAL + "66");
  outerBorder.addColorStop(1,    GREEN + "cc");
  ctx.strokeStyle = outerBorder;
  ctx.lineWidth = 2;
  roundRect(ctx, 1, 1, W - 2, H - 2, 22);
  ctx.stroke();
  ctx.restore();

  /* ══ 16. Watermark ══ */
  ctx.font = "500 11px ui-monospace, monospace";
  ctx.fillStyle = "rgba(255,215,0,0.25)";
  ctx.textAlign = "center";
  ctx.fillText("epochradar.com  ✦  Solana Airdrop Checker", W / 2, H - 12);
}
