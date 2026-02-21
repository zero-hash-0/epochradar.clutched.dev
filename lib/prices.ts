import { TtlCache } from "@/lib/cache";

const PRICE_CACHE = new TtlCache<string, number>(1000 * 60 * 5);

async function fetchSolPrice() {
  const cached = PRICE_CACHE.get("solana");
  if (cached !== null) {
    return cached;
  }

  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
    { cache: "no-store", headers: { accept: "application/json" } },
  );
  if (!res.ok) {
    return null;
  }
  const payload = (await res.json()) as { solana?: { usd?: number } };
  const price = payload.solana?.usd;
  if (typeof price !== "number") {
    return null;
  }
  PRICE_CACHE.set("solana", price);
  return price;
}

export async function fetchTokenUsdPricesByMint(mints: string[]) {
  const uniqueMints = Array.from(new Set(mints.filter(Boolean)));
  const mintToPrice = new Map<string, number>();
  const misses: string[] = [];

  for (const mint of uniqueMints) {
    const cached = PRICE_CACHE.get(`mint:${mint}`);
    if (cached !== null) {
      mintToPrice.set(mint, cached);
    } else {
      misses.push(mint);
    }
  }

  if (misses.length > 0) {
    const url = `https://api.coingecko.com/api/v3/simple/token_price/solana?contract_addresses=${encodeURIComponent(
      misses.join(","),
    )}&vs_currencies=usd`;
    try {
      const res = await fetch(url, { cache: "no-store", headers: { accept: "application/json" } });
      if (res.ok) {
        const payload = (await res.json()) as Record<string, { usd?: number }>;
        for (const mint of misses) {
          const key = mint.toLowerCase();
          const usd = payload[key]?.usd;
          if (typeof usd === "number") {
            mintToPrice.set(mint, usd);
            PRICE_CACHE.set(`mint:${mint}`, usd);
          }
        }
      }
    } catch {
      // Keep partial data if available.
    }
  }

  const sol = await fetchSolPrice();
  return {
    solPriceUsd: sol,
    mintToPrice,
  };
}
