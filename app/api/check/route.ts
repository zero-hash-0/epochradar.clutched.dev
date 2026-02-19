import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { buildWalletProfile } from "@/lib/solanaProfile";
import { evaluateWalletAirdrops } from "@/lib/evaluator";
import { getAirdropRules } from "@/lib/dbAirdrops";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { walletAddress?: string };
    const walletAddress = body.walletAddress?.trim();

    if (!walletAddress) {
      return NextResponse.json(
        { error: "walletAddress is required" },
        { status: 400 },
      );
    }

    try {
      new PublicKey(walletAddress);
    } catch {
      return NextResponse.json(
        { error: "walletAddress is not a valid Solana address" },
        { status: 400 },
      );
    }

    const [profile, rules] = await Promise.all([
      buildWalletProfile(walletAddress),
      getAirdropRules(),
    ]);
    const results = evaluateWalletAirdrops(profile, rules);

    return NextResponse.json(
      {
        checkedAt: new Date().toISOString(),
        profile,
        results,
        safety: {
          readOnly: true,
          privateKeysRequested: false,
          note: "Only use official claim URLs. Never share seed phrases.",
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to evaluate wallet",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
