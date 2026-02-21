import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const filePath = process.argv[2] || path.join(process.cwd(), "scripts", "curated-airdrops.json");
const raw = await fs.readFile(filePath, "utf8");
const rows = JSON.parse(raw);

if (!Array.isArray(rows)) {
  console.error("Expected JSON array");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const now = new Date().toISOString();
const upsertRows = rows.map((row) => ({
  ...row,
  last_verified_at: row.last_verified_at || now,
  verification_config: row.verification_config || {},
  trusted_domains: row.trusted_domains || [],
  timeline: row.timeline || {},
  checks: row.checks || {},
  is_active: row.is_active ?? true,
}));

const { error, data } = await supabase
  .from("airdrops")
  .upsert(upsertRows, { onConflict: "id" })
  .select("id, project, status, verification_method, source_confidence");

if (error) {
  console.error(error.message);
  process.exit(1);
}

console.log(`Upserted ${data.length} airdrops from ${filePath}`);
for (const row of data) {
  console.log(`- ${row.id} (${row.project}) status=${row.status} method=${row.verification_method} confidence=${row.source_confidence}`);
}
