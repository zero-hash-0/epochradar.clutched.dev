import { createClient } from "@supabase/supabase-js";

export type DbAirdropRow = {
  id: string;
  project: string;
  network: "solana";
  category: "defi" | "nft" | "infrastructure" | "consumer";
  status: "upcoming" | "active" | "snapshot_taken" | "ended";
  official_claim_url: string;
  source_url: string;
  trusted_domains?: string[] | null;
  verification_method?: "claim_api" | "distributor_program" | "manual_verified" | "unverified" | null;
  distributor_program_id?: string | null;
  claim_api_endpoint?: string | null;
  snapshot_proof_type?: string | null;
  last_verified_at?: string | null;
  source_confidence?: number | null;
  verification_config?: Record<string, unknown> | null;
  timeline?: {
    announcedAt?: string;
    snapshotAt?: string;
    claimOpensAt?: string;
    claimEndsAt?: string;
  } | null;
  risk_level: "low" | "medium" | "high";
  checks: {
    minSolBalance?: number;
    minTokenAccounts?: number;
    minRecentTransactions?: number;
    requiresAnyTokens?: string[];
    minNftCount?: number;
    maxLastActiveDays?: number;
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export function hasSupabaseConfig() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getSupabaseServerClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
