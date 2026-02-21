import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { scanPastAirdrops } from "@/lib/pastAirdrops";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { walletAddress?: string };
    const walletAddress = body.walletAddress?.trim();

    if (!walletAddress) {
      return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
    }

    try {
      new PublicKey(walletAddress);
    } catch {
      return NextResponse.json({ error: "Invalid Solana address" }, { status: 400 });
    }

    const pastAirdrops = await scanPastAirdrops(walletAddress);

    return NextResponse.json(
      {
        walletAddress,
        checkedAt: new Date().toISOString(),
        pastAirdrops,
        totalReceived: pastAirdrops.filter((item) => item.isLikelyAirdrop).length,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch history",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
