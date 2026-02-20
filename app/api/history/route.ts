import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
  ParsedTransactionWithMeta,
  ParsedInstruction,
} from "@solana/web3.js";

const MAINNET_URL =
  process.env.SOLANA_RPC_URL || clusterApiUrl("mainnet-beta");

const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

export type PastAirdrop = {
  signature: string;
  date: string;
  timestamp: number;
  mint: string;
  mintShort: string;
  symbol: string;
  amount: number;
  decimals: number;
  uiAmount: number;
  senderAddress: string | null;
  isLikelyAirdrop: boolean;
  reason: string;
};

export type HistoryResponse = {
  walletAddress: string;
  checkedAt: string;
  pastAirdrops: PastAirdrop[];
  totalReceived: number; // count of likely airdrop events
};

function isParsed(ix: ParsedInstruction | { programId: PublicKey; accounts: PublicKey[]; data: string }): ix is ParsedInstruction {
  return "parsed" in ix;
}

function isLikelyAirdropSender(sender: string | null, owner: string): boolean {
  if (!sender) return true; // unknown sender → suspicious / airdrop-like
  // If sender === wallet itself it's not an airdrop
  if (sender === owner) return false;
  return true;
}

function extractTokenTransfersToWallet(
  tx: ParsedTransactionWithMeta,
  walletAddress: string,
): Array<{ mint: string; amount: number; decimals: number; uiAmount: number; senderSource: string | null }> {
  const results: Array<{ mint: string; amount: number; decimals: number; uiAmount: number; senderSource: string | null }> = [];
  const message = tx.transaction.message;

  for (const ix of message.instructions) {
    if (!isParsed(ix)) continue;
    const programId = ix.programId.toBase58();
    if (programId !== TOKEN_PROGRAM && programId !== TOKEN_2022_PROGRAM) continue;

    // transfer or transferChecked
    const parsed = ix.parsed as {
      type: string;
      info?: {
        destination?: string;
        authority?: string;
        source?: string;
        mint?: string;
        tokenAmount?: { amount: string; decimals: number; uiAmount: number };
        amount?: string;
        lamports?: number;
      };
    };

    if (parsed.type !== "transfer" && parsed.type !== "transferChecked") continue;
    const info = parsed.info;
    if (!info) continue;

    // Check pre/post token balances to find the destination that belongs to our wallet
    const postBalances = tx.meta?.postTokenBalances ?? [];
    const preBalances = tx.meta?.preTokenBalances ?? [];

    for (const post of postBalances) {
      if (post.owner !== walletAddress) continue;
      const pre = preBalances.find((p) => p.accountIndex === post.accountIndex);
      const preAmount = pre?.uiTokenAmount?.uiAmount ?? 0;
      const postAmount = post.uiTokenAmount?.uiAmount ?? 0;
      if (postAmount <= preAmount) continue; // didn't receive

      const received = postAmount - preAmount;
      const mint = post.mint;
      const decimals = post.uiTokenAmount?.decimals ?? 0;
      const rawAmount = Math.round(received * Math.pow(10, decimals));
      const senderSource = info.authority ?? info.source ?? null;

      results.push({ mint, amount: rawAmount, decimals, uiAmount: received, senderSource });
    }
  }

  return results;
}

function mintToSymbol(mint: string): string {
  const KNOWN: Record<string, string> = {
    EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC",
    Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: "USDT",
    JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: "JUP",
    DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: "BONK",
    "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs": "ETH",
    mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So: "mSOL",
    bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1: "bSOL",
    "7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj": "stSOL",
    "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R": "RAY",
    HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3: "PYTH",
    orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE: "ORCA",
    "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU": "SAMO",
    MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey: "MNDE",
    MNDE3d9y1QSEimVs3AC9MkXkDqSrSLgBqiJTKSkjbej: "MNDE",
    TNSRxcUxoT9xBG3de7A4xwi3N5pKFLBYzSMSjdWoHoH: "TNSR",
    WENWENvqqNya429ubCdR81ZmD69brwQaaBYY6p3LCpk: "WEN",
    METAewgxyPbgwsseH8T16a39CQ5VyVxZi9zXiDPY18m: "META",
    "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4": "sSBR",
    "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E": "BTC",
    Saber2gLauYim4Mvftnrasomsv6NvAuncvMEZwcLpD1: "SBR",
    FiSCdB1ThfLaX6rkP1z9tvXuiUcEFKRqVriuRHpVNjEY: "FIS",
  };
  return KNOWN[mint] ?? mint.slice(0, 4).toUpperCase();
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { walletAddress?: string };
    const walletAddress = body.walletAddress?.trim();

    if (!walletAddress) {
      return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
    }

    let wallet: PublicKey;
    try {
      wallet = new PublicKey(walletAddress);
    } catch {
      return NextResponse.json({ error: "Invalid Solana address" }, { status: 400 });
    }

    const connection = new Connection(MAINNET_URL, "confirmed");

    // Fetch up to 50 recent signatures
    const signatures = await connection.getSignaturesForAddress(wallet, { limit: 50 });

    if (signatures.length === 0) {
      return NextResponse.json({
        walletAddress,
        checkedAt: new Date().toISOString(),
        pastAirdrops: [],
        totalReceived: 0,
      } satisfies HistoryResponse);
    }

    // Batch fetch parsed transactions (max 10 at a time to avoid rate limits)
    const BATCH = 10;
    const pastAirdrops: PastAirdrop[] = [];

    for (let i = 0; i < Math.min(signatures.length, 50); i += BATCH) {
      const batch = signatures.slice(i, i + BATCH);
      const sigs = batch.map((s) => s.signature);

      let txs: (ParsedTransactionWithMeta | null)[];
      try {
        txs = await connection.getParsedTransactions(sigs, {
          maxSupportedTransactionVersion: 0,
          commitment: "confirmed",
        });
      } catch {
        continue;
      }

      for (let j = 0; j < txs.length; j++) {
        const tx = txs[j];
        const sig = batch[j];
        if (!tx || tx.meta?.err) continue;

        const blockTime = sig.blockTime ?? tx.blockTime ?? null;
        const date = blockTime
          ? new Date(blockTime * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
          : "Unknown";

        try {
          const transfers = extractTokenTransfersToWallet(tx, walletAddress);
          for (const t of transfers) {
            if (t.uiAmount <= 0) continue;
            const sender = t.senderSource;
            const isLikely = isLikelyAirdropSender(sender, walletAddress) && t.uiAmount > 0;
            const symbol = mintToSymbol(t.mint);

            // Heuristics: large round amounts, unknown sender, or known airdrop tokens
            let reason = "Token received from external sender";
            if (!sender || sender === walletAddress) reason = "Token deposit";
            if (t.uiAmount >= 100) reason = "Large token distribution";
            if (t.uiAmount >= 1000) reason = "Bulk airdrop distribution";

            pastAirdrops.push({
              signature: sig.signature,
              date,
              timestamp: blockTime ?? 0,
              mint: t.mint,
              mintShort: t.mint.slice(0, 6) + "…",
              symbol,
              amount: t.amount,
              decimals: t.decimals,
              uiAmount: t.uiAmount,
              senderAddress: sender,
              isLikelyAirdrop: isLikely,
              reason,
            });
          }

          // Also look at SOL transfers (someone sent you SOL = could be airdrop/reward)
          const preSOL = tx.meta?.preBalances ?? [];
          const postSOL = tx.meta?.postBalances ?? [];
          const accounts = tx.transaction.message.accountKeys as Array<{ pubkey: PublicKey }>;
          for (let k = 0; k < accounts.length; k++) {
            const acct = accounts[k];
            const addr = acct.pubkey.toBase58();
            if (addr !== walletAddress) continue;
            const pre = (preSOL[k] ?? 0) / LAMPORTS_PER_SOL;
            const post = (postSOL[k] ?? 0) / LAMPORTS_PER_SOL;
            const received = post - pre;
            // Only count if we received >= 0.01 SOL (likely intentional, not just fee refund)
            if (received >= 0.01) {
              pastAirdrops.push({
                signature: sig.signature,
                date,
                timestamp: blockTime ?? 0,
                mint: "So11111111111111111111111111111111111111112",
                mintShort: "So1111…",
                symbol: "SOL",
                amount: Math.round(received * LAMPORTS_PER_SOL),
                decimals: 9,
                uiAmount: received,
                senderAddress: null,
                isLikelyAirdrop: received >= 0.05,
                reason: received >= 0.1 ? "SOL distribution / reward" : "SOL received",
              });
            }
            break;
          }
        } catch {
          // skip problematic tx
        }
      }
    }

    // Sort by timestamp descending
    pastAirdrops.sort((a, b) => b.timestamp - a.timestamp);

    // Deduplicate by signature+mint
    const seen = new Set<string>();
    const deduped = pastAirdrops.filter((p) => {
      const key = `${p.signature}-${p.mint}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const likelyCount = deduped.filter((p) => p.isLikelyAirdrop).length;

    return NextResponse.json({
      walletAddress,
      checkedAt: new Date().toISOString(),
      pastAirdrops: deduped,
      totalReceived: likelyCount,
    } satisfies HistoryResponse, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch history", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    );
  }
}
