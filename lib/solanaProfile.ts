import {
  clusterApiUrl,
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  ParsedAccountData,
} from "@solana/web3.js";
import { WalletProfile } from "@/lib/types";

const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const MAINNET_URL = process.env.SOLANA_RPC_URL || clusterApiUrl("mainnet-beta");

function extractSymbol(parsedInfo: unknown): string | null {
  if (
    typeof parsedInfo === "object" &&
    parsedInfo !== null &&
    "mint" in parsedInfo &&
    typeof (parsedInfo as { mint: string }).mint === "string"
  ) {
    const mint = (parsedInfo as { mint: string }).mint;
    return mint.slice(0, 4).toUpperCase();
  }

  return null;
}

export async function buildWalletProfile(address: string): Promise<WalletProfile> {
  const connection = new Connection(MAINNET_URL, "confirmed");
  const wallet = new PublicKey(address);

  const [balance, tokenAccounts, signatures] = await Promise.all([
    connection.getBalance(wallet),
    connection.getParsedTokenAccountsByOwner(wallet, { programId: TOKEN_PROGRAM }),
    connection.getSignaturesForAddress(wallet, { limit: 100 }),
  ]);

  const tokenSymbols = Array.from(
    new Set(
      tokenAccounts.value
        .map((acc) => {
          const data = acc.account.data as ParsedAccountData;
          return extractSymbol(data.parsed?.info);
        })
        .filter((symbol): symbol is string => Boolean(symbol)),
    ),
  );

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
