import { clusterApiUrl, Connection, PublicKey } from "@solana/web3.js";
import { TtlCache } from "@/lib/cache";

export type TokenMetadata = {
  mint: string;
  symbol: string;
  name?: string;
  logoUri?: string;
};

type JupiterToken = {
  address: string;
  symbol?: string;
  name?: string;
  logoURI?: string;
};

const METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
const MAINNET_URL = process.env.SOLANA_RPC_URL || clusterApiUrl("mainnet-beta");
const SYMBOL_CACHE = new TtlCache<string, TokenMetadata>(1000 * 60 * 60 * 12);
const TOKEN_LIST_CACHE = new TtlCache<string, Map<string, TokenMetadata>>(1000 * 60 * 30);
const LIST_KEY = "jupiter-token-list";

function isAsciiSymbol(value: string) {
  return /^[a-zA-Z0-9$_.-]{1,12}$/.test(value);
}

function sanitizeSymbol(value: string | undefined | null) {
  if (!value) {
    return null;
  }
  const clean = value.replace(/\0/g, "").trim();
  if (!clean || !isAsciiSymbol(clean)) {
    return null;
  }
  return clean.toUpperCase();
}

async function loadJupiterTokenList(): Promise<Map<string, TokenMetadata>> {
  const cached = TOKEN_LIST_CACHE.get(LIST_KEY);
  if (cached) {
    return cached;
  }

  const map = new Map<string, TokenMetadata>();
  try {
    const res = await fetch("https://token.jup.ag/strict", {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (res.ok) {
      const payload = (await res.json()) as JupiterToken[];
      for (const token of payload) {
        const mint = token.address;
        const symbol = sanitizeSymbol(token.symbol);
        if (!mint || !symbol) {
          continue;
        }
        map.set(mint, {
          mint,
          symbol,
          name: token.name,
          logoUri: token.logoURI,
        });
      }
    }
  } catch {
    // Non-fatal fallback path.
  }

  TOKEN_LIST_CACHE.set(LIST_KEY, map);
  return map;
}

function readBorshString(data: Buffer, offset: number) {
  if (offset + 4 > data.length) {
    return { value: null, nextOffset: offset };
  }
  const length = data.readUInt32LE(offset);
  const start = offset + 4;
  const end = start + length;
  if (end > data.length) {
    return { value: null, nextOffset: offset };
  }
  const raw = data.subarray(start, end).toString("utf8").replace(/\0/g, "").trim();
  return {
    value: raw || null,
    nextOffset: end,
  };
}

async function resolveFromMetaplexMetadata(
  mint: string,
  connection: Connection,
): Promise<TokenMetadata | null> {
  try {
    const mintPk = new PublicKey(mint);
    const [metadataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), mintPk.toBuffer()],
      METADATA_PROGRAM_ID,
    );
    const accountInfo = await connection.getAccountInfo(metadataPda, "confirmed");
    if (!accountInfo?.data || accountInfo.data.length < 70) {
      return null;
    }

    const data = accountInfo.data;
    let cursor = 1 + 32 + 32; // key + updateAuthority + mint
    const name = readBorshString(data, cursor);
    cursor = name.nextOffset;
    const symbol = readBorshString(data, cursor);

    const cleanSymbol = sanitizeSymbol(symbol.value);
    if (!cleanSymbol) {
      return null;
    }

    return {
      mint,
      symbol: cleanSymbol,
      name: name.value || undefined,
    };
  } catch {
    return null;
  }
}

export async function resolveTokenMetadata(
  mint: string,
  connection = new Connection(MAINNET_URL, "confirmed"),
): Promise<TokenMetadata> {
  const cached = SYMBOL_CACHE.get(mint);
  if (cached) {
    return cached;
  }

  const list = await loadJupiterTokenList();
  const fromList = list.get(mint);
  if (fromList) {
    SYMBOL_CACHE.set(mint, fromList);
    return fromList;
  }

  const fromChain = await resolveFromMetaplexMetadata(mint, connection);
  if (fromChain) {
    SYMBOL_CACHE.set(mint, fromChain);
    return fromChain;
  }

  const fallback: TokenMetadata = {
    mint,
    symbol: "UNKNOWN",
  };
  SYMBOL_CACHE.set(mint, fallback);
  return fallback;
}

export async function resolveManyTokenMetadata(
  mints: string[],
  connection = new Connection(MAINNET_URL, "confirmed"),
) {
  const uniqueMints = Array.from(new Set(mints));
  const resolved = await Promise.all(
    uniqueMints.map(async (mint) => {
      return resolveTokenMetadata(mint, connection);
    }),
  );

  return new Map(resolved.map((item) => [item.mint, item]));
}
