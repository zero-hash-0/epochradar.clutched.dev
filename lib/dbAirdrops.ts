import { AIRDROP_RULES } from "@/lib/airdrops";
import { AirdropRule } from "@/lib/types";
import { DbAirdropRow, getSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase";

function rowToRule(row: DbAirdropRow): AirdropRule {
  return {
    id: row.id,
    project: row.project,
    network: row.network,
    category: row.category,
    status: row.status,
    officialClaimUrl: row.official_claim_url,
    sourceUrl: row.source_url,
    trustedDomains: row.trusted_domains || undefined,
    verificationMethod: row.verification_method || "unverified",
    distributorProgramId: row.distributor_program_id || undefined,
    claimApiEndpoint: row.claim_api_endpoint || undefined,
    snapshotProofType: row.snapshot_proof_type || undefined,
    lastVerifiedAt: row.last_verified_at || undefined,
    sourceConfidence: row.source_confidence || undefined,
    verificationConfig: row.verification_config || undefined,
    verified: (row.verification_method || "unverified") !== "unverified",
    timeline: row.timeline || undefined,
    riskLevel: row.risk_level,
    checks: row.checks || {},
  };
}

export async function getAirdropRules(): Promise<AirdropRule[]> {
  if (!hasSupabaseConfig()) {
    return AIRDROP_RULES;
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("airdrops")
    .select("*")
    .eq("is_active", true)
    .order("project", { ascending: true });

  if (error || !data) {
    return AIRDROP_RULES;
  }

  return data.map((row) => rowToRule(row as DbAirdropRow));
}
