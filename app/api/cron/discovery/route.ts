import { NextRequest, NextResponse } from "next/server";
import { persistDiscoveryLeads, runDiscoveryScan } from "@/lib/discovery/scan";
import { constantTimeEqual } from "@/lib/security";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");

  if (!secret || !constantTimeEqual(auth || "", `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const leads = await runDiscoveryScan(120);
    const persisted = await persistDiscoveryLeads(leads);

    const res = NextResponse.json({
      scannedAt: new Date().toISOString(),
      total: leads.length,
      persisted,
    });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cron discovery scan failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
