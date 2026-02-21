import {
  clusterApiUrl,
  Connection,
  PublicKey,
  ParsedInstruction,
  ParsedTransactionWithMeta,
  PartiallyDecodedInstruction,
} from "@solana/web3.js";
import { fetchTokenUsdPricesByMint } from "@/lib/prices";
import { PastAirdrop } from "@/lib/types";
import { resolveManyTokenMetadata } from "@/lib/tokenMetadata";

const MAINNET_URL = process.env.SOLANA_RPC_URL || clusterApiUrl("mainnet-beta");
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

type TransferEvent = {
  signature: string;
  timestamp: number;
  mint: string;
  uiAmount: number;
  decimals: number;
  senderAddress: string | null;
  reason: string;
  confidence: number;
};

function isParsed(ix: ParsedInstruction | PartiallyDecodedInstruction): ix is ParsedInstruction {
  return "parsed" in ix;
}

export function extractInboundTransfersFromParsedTx(
  tx: ParsedTransactionWithMeta,
  walletAddress: string,
  signature: string,
): TransferEvent[] {
  if (tx.meta?.err) {
    return [];
  }

  const postTokenBalances = tx.meta?.postTokenBalances || [];
  const preTokenBalances = tx.meta?.preTokenBalances || [];
  const preMap = new Map(preTokenBalances.map((item) => [`${item.accountIndex}:${item.mint}`, item]));
  const sendersByMint = new Map<string, string | null>();

  for (const ix of tx.transaction.message.instructions) {
    if (!isParsed(ix)) continue;
    const pid = ix.programId.toBase58();
    if (pid !== TOKEN_PROGRAM && pid !== TOKEN_2022_PROGRAM) continue;
    const parsed = ix.parsed as { type?: string; info?: { mint?: string; source?: string; authority?: string } };
    const mint = parsed.info?.mint;
    if (!mint) continue;
    sendersByMint.set(mint, parsed.info?.authority || parsed.info?.source || null);
  }

  const events: TransferEvent[] = [];
  const timestamp = tx.blockTime || 0;

  for (const post of postTokenBalances) {
    if (post.owner !== walletAddress) continue;
    const key = `${post.accountIndex}:${post.mint}`;
    const pre = preMap.get(key);
    const preUi = pre?.uiTokenAmount?.uiAmount || 0;
    const postUi = post.uiTokenAmount?.uiAmount || 0;
    if (postUi <= preUi) continue;

    const received = postUi - preUi;
    const sender = sendersByMint.get(post.mint) ?? null;

    let confidence = 0.4;
    const reasons: string[] = ["Inbound token balance increase detected"];
    if (!sender) {
      confidence += 0.2;
      reasons.push("Sender unavailable in parsed instructions");
    } else if (sender !== walletAddress) {
      confidence += 0.15;
      reasons.push("Sender differs from recipient wallet");
    }
    if (received > 100) {
      confidence += 0.15;
      reasons.push("Large token distribution size");
    }
    if (tx.transaction.message.instructions.length > 3) {
      confidence += 0.1;
      reasons.push("Multi-instruction distribution transaction");
    }

    events.push({
      signature,
      timestamp,
      mint: post.mint,
      uiAmount: received,
      decimals: post.uiTokenAmount.decimals,
      senderAddress: sender,
      reason: reasons.join(" | "),
      confidence: Math.min(1, confidence),
    });
  }

  return events;
}

export async function scanPastAirdrops(walletAddress: string, maxSignatures = 100): Promise<PastAirdrop[]> {
  const connection = new Connection(MAINNET_URL, "confirmed");
  const wallet = new PublicKey(walletAddress);
  const signatures = await connection.getSignaturesForAddress(wallet, { limit: maxSignatures });
  if (signatures.length === 0) {
    return [];
  }

  const events: TransferEvent[] = [];
  const batchSize = 20;
  for (let i = 0; i < signatures.length; i += batchSize) {
    const batch = signatures.slice(i, i + batchSize);
    const parsed = await connection.getParsedTransactions(
      batch.map((item) => item.signature),
      { commitment: "confirmed", maxSupportedTransactionVersion: 0 },
    );
    for (let j = 0; j < parsed.length; j += 1) {
      const tx = parsed[j];
      if (!tx) continue;
      events.push(...extractInboundTransfersFromParsedTx(tx, walletAddress, batch[j].signature));
    }
  }

  if (events.length === 0) {
    return [];
  }

  const metadataByMint = await resolveManyTokenMetadata(events.map((event) => event.mint), connection);
  const prices = await fetchTokenUsdPricesByMint(events.map((event) => event.mint));

  const dedupe = new Set<string>();
  const mapped = events
    .sort((a, b) => b.timestamp - a.timestamp)
    .filter((event) => {
      const key = `${event.signature}:${event.mint}`;
      if (dedupe.has(key)) {
        return false;
      }
      dedupe.add(key);
      return true;
    })
    .map((event) => {
      const metadata = metadataByMint.get(event.mint);
      const symbol = metadata?.symbol || "UNKNOWN";
      const usdPrice = prices.mintToPrice.get(event.mint);
      const usdValue = typeof usdPrice === "number" ? usdPrice * event.uiAmount : undefined;

      return {
        signature: event.signature,
        date: event.timestamp
          ? new Date(event.timestamp * 1000).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "Unknown",
        timestamp: event.timestamp,
        mint: event.mint,
        mintShort: `${event.mint.slice(0, 6)}...${event.mint.slice(-4)}`,
        symbol,
        amount: Math.round(event.uiAmount * Math.pow(10, event.decimals)),
        decimals: event.decimals,
        uiAmount: event.uiAmount,
        senderAddress: event.senderAddress,
        isLikelyAirdrop: event.confidence >= 0.6,
        reason: `Detected airdrop: ${event.reason}`,
        confidence: Math.round(event.confidence * 100),
        usdValue: typeof usdValue === "number" ? Number(usdValue.toFixed(2)) : undefined,
      } satisfies PastAirdrop;
    });

  return mapped;
}
