import {
  clusterApiUrl,
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  ParsedAccountData,
} from "@solana/web3.js";
import { WalletProfile } from "@/lib/types";
import { resolveManyTokenMetadata } from "@/lib/tokenMetadata";

const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const MAINNET_URL = process.env.SOLANA_RPC_URL || clusterApiUrl("mainnet-beta");

function extractMintAndAmount(parsedInfo: unknown) {
  if (typeof parsedInfo !== "object" || parsedInfo === null) {
    return null;
  }

  const mint = "mint" in parsedInfo ? (parsedInfo as { mint?: string }).mint : undefined;
  const tokenAmount =
    "tokenAmount" in parsedInfo
      ? (parsedInfo as { tokenAmount?: { uiAmount?: number; decimals?: number } }).tokenAmount
      : undefined;

  if (typeof mint !== "string") {
    return null;
  }

  return {
    mint,
    uiAmount: typeof tokenAmount?.uiAmount === "number" ? tokenAmount.uiAmount : 0,
    decimals: typeof tokenAmount?.decimals === "number" ? tokenAmount.decimals : 0,
  };
}

export async function buildWalletProfile(address: string): Promise<WalletProfile> {
  const connection = new Connection(MAINNET_URL, "confirmed");
  const wallet = new PublicKey(address);

  const [balance, tokenAccounts, signatures] = await Promise.all([
    connection.getBalance(wallet),
    connection.getParsedTokenAccountsByOwner(wallet, { programId: TOKEN_PROGRAM }),
    connection.getSignaturesForAddress(wallet, { limit: 100 }),
  ]);

  const tokenRows = tokenAccounts.value
    .map((acc) => {
      const data = acc.account.data as ParsedAccountData;
      return extractMintAndAmount(data.parsed?.info);
    })
    .filter((item): item is { mint: string; uiAmount: number; decimals: number } => Boolean(item));

  const metadataMap = await resolveManyTokenMetadata(tokenRows.map((row) => row.mint), connection);
  const tokenBalances = tokenRows
    .map((row) => {
      const metadata = metadataMap.get(row.mint);
      return {
        mint: row.mint,
        symbol: metadata?.symbol || "UNKNOWN",
        uiAmount: row.uiAmount,
        decimals: row.decimals,
      };
    })
    .filter((row) => row.uiAmount > 0);

  const tokenSymbols = Array.from(new Set(tokenBalances.map((row) => row.symbol))).sort();
  const tokenMints = Array.from(new Set(tokenBalances.map((row) => row.mint)));

  const now = Date.now();
  const oldest = signatures[signatures.length - 1];
  const latest = signatures[0];

  const accountAgeDays = oldest?.blockTime
    ? Math.floor((now - oldest.blockTime * 1000) / (1000 * 60 * 60 * 24))
    : undefined;
  const lastActiveDays = latest?.blockTime
    ? Math.floor((now - latest.blockTime * 1000) / (1000 * 60 * 60 * 24))
    : undefined;

  return {
    address,
    solBalance: balance / LAMPORTS_PER_SOL,
    tokenSymbols,
    tokenMints,
    tokenBalances,
    tokenAccountsCount: tokenAccounts.value.length,
    nftApproxCount: tokenAccounts.value.filter((acc) => {
      const data = acc.account.data as ParsedAccountData;
      const amount = data.parsed?.info?.tokenAmount?.uiAmount;
      return amount === 1;
    }).length,
    recentTransactionCount: signatures.length,
    accountAgeDays,
    lastActiveDays,
  };
}
