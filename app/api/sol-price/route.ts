import { NextResponse } from "next/server";

const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true";

export async function GET() {
  try {
    const res = await fetch(COINGECKO_URL, {
      cache: "no-store",
      headers: { accept: "application/json" },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Price provider unavailable" }, { status: 502 });
    }

    const data = (await res.json()) as {
      solana?: { usd?: number; usd_24h_change?: number };
    };

    const price = data.solana?.usd;
    const change24h = data.solana?.usd_24h_change;

    if (price === undefined || change24h === undefined) {
      return NextResponse.json({ error: "Invalid price payload" }, { status: 502 });
    }

    return NextResponse.json(
      {
        symbol: "SOL",
        priceUsd: price,
        change24h,
        asOf: new Date().toISOString(),
        source: "coingecko",
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch SOL price",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
