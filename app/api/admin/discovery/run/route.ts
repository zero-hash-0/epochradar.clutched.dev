import { NextResponse } from "next/server";
import { persistDiscoveryLeads, runDiscoveryScan } from "@/lib/discovery/scan";

export async function POST() {
  try {
    const leads = await runDiscoveryScan(80);
    const persisted = await persistDiscoveryLeads(leads);

    const res = NextResponse.json({
      scannedAt: new Date().toISOString(),
      total: leads.length,
      persisted,
      leads,
    });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Discovery scan failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
