import { NextRequest, NextResponse } from "next/server";
import { AIRDROP_RULES } from "@/lib/airdrops";
import { getSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase";
import { isPlainObject, isValidHttpsUrl } from "@/lib/security";

const ALLOWED_CATEGORIES = new Set(["defi", "nft", "infrastructure", "consumer"]);
const ALLOWED_STATUSES = new Set(["upcoming", "active", "snapshot_taken", "ended"]);
const ALLOWED_RISK_LEVELS = new Set(["low", "medium", "high"]);
const ID_PATTERN = /^[a-z0-9][a-z0-9-_]{2,63}$/;

export async function GET() {
  if (!hasSupabaseConfig()) {
    const res = NextResponse.json({
      source: "fallback",
      configured: false,
      data: AIRDROP_RULES,
      note: "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to manage persistent rules.",
    });
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("airdrops")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const res = NextResponse.json({ source: "supabase", configured: true, data });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function POST(req: NextRequest) {
  if (!hasSupabaseConfig()) {
    return NextResponse.json(
      { error: "Supabase is not configured on the server." },
      { status: 400 },
    );
  }

  if (!req.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isPlainObject(body)) {
    return NextResponse.json({ error: "JSON object body is required" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const project = typeof body.project === "string" ? body.project.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim().toLowerCase() : "defi";
  const status = typeof body.status === "string" ? body.status.trim().toLowerCase() : "upcoming";
  const officialClaimUrl =
    typeof body.officialClaimUrl === "string" ? body.officialClaimUrl.trim() : "";
  const sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl.trim() : "";
  const riskLevel = typeof body.riskLevel === "string" ? body.riskLevel.trim().toLowerCase() : "medium";
  const checks = body.checks;

  if (!id || !project || !officialClaimUrl || !sourceUrl) {
    return NextResponse.json(
      { error: "id, project, officialClaimUrl, and sourceUrl are required" },
      { status: 400 },
    );
  }

  if (!ID_PATTERN.test(id)) {
    return NextResponse.json(
      { error: "id must be 3-64 chars and only use a-z, 0-9, - and _" },
      { status: 400 },
    );
  }

  if (project.length < 2 || project.length > 80) {
    return NextResponse.json({ error: "project must be between 2 and 80 characters" }, { status: 400 });
  }

  if (!ALLOWED_CATEGORIES.has(category)) {
    return NextResponse.json({ error: "Invalid category value" }, { status: 400 });
  }

  if (!ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
  }

  if (!ALLOWED_RISK_LEVELS.has(riskLevel)) {
    return NextResponse.json({ error: "Invalid riskLevel value" }, { status: 400 });
  }

  if (!isValidHttpsUrl(officialClaimUrl) || !isValidHttpsUrl(sourceUrl)) {
    return NextResponse.json({ error: "officialClaimUrl and sourceUrl must be valid HTTPS URLs" }, { status: 400 });
  }

  if (checks !== undefined && !isPlainObject(checks)) {
    return NextResponse.json({ error: "checks must be a JSON object" }, { status: 400 });
  }

  if (checks && JSON.stringify(checks).length > 10_000) {
    return NextResponse.json({ error: "checks payload is too large" }, { status: 413 });
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("airdrops")
    .insert({
      id,
      project,
      network: "solana",
      category,
      status,
      official_claim_url: officialClaimUrl,
      source_url: sourceUrl,
      risk_level: riskLevel,
      checks: checks || {},
      is_active: true,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ created: true, data }, { status: 201 });
}
