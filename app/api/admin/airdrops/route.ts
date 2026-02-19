import { NextRequest, NextResponse } from "next/server";
import { AIRDROP_RULES } from "@/lib/airdrops";
import { getSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase";

export async function GET() {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({
      source: "fallback",
      configured: false,
      data: AIRDROP_RULES,
      note: "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to manage persistent rules.",
    });
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("airdrops")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ source: "supabase", configured: true, data });
}

export async function POST(req: NextRequest) {
  if (!hasSupabaseConfig()) {
    return NextResponse.json(
      { error: "Supabase is not configured on the server." },
      { status: 400 },
    );
  }

  const body = (await req.json()) as {
    id?: string;
    project?: string;
    category?: "defi" | "nft" | "infrastructure" | "consumer";
    status?: "upcoming" | "active" | "snapshot_taken" | "ended";
    officialClaimUrl?: string;
    sourceUrl?: string;
    riskLevel?: "low" | "medium" | "high";
    checks?: Record<string, unknown>;
  };

  if (!body.id || !body.project || !body.officialClaimUrl || !body.sourceUrl) {
    return NextResponse.json(
      { error: "id, project, officialClaimUrl, and sourceUrl are required" },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("airdrops")
    .insert({
      id: body.id,
      project: body.project,
      network: "solana",
      category: body.category || "defi",
      status: body.status || "upcoming",
      official_claim_url: body.officialClaimUrl,
      source_url: body.sourceUrl,
      risk_level: body.riskLevel || "medium",
      checks: body.checks || {},
      is_active: true,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ created: true, data }, { status: 201 });
}
