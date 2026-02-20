import { NextResponse } from "next/server";
import { runDiscoveryScan } from "@/lib/discovery/scan";

export async function GET() {
  const leads = await runDiscoveryScan(40);

  return NextResponse.json({
    scannedAt: new Date().toISOString(),
    total: leads.length,
    leads,
    note: "Coverage is high but not absolute. Verify every claim URL manually.",
  });
}
