import Parser from "rss-parser";
import { DISCOVERY_SOURCES } from "@/lib/discovery/sources";
import { getSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase";

const parser = new Parser();

const KEYWORDS = [
  "airdrop",
  "rewards",
  "points",
  "claim",
  "snapshot",
  "incentive",
  "retroactive",
  "loyalty",
  "season",
];

export type DiscoveryLead = {
  id: string;
  project: string;
  title: string;
  summary: string;
  url: string;
  sourceId: string;
  sourceName: string;
  publishedAt: string;
  score: number;
  tags: string[];
};

function slug(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);
}

function scoreEntry(text: string, sourceWeight: number) {
  const lower = text.toLowerCase();
  const matched = KEYWORDS.filter((k) => lower.includes(k));
  const score = Math.round((matched.length * 12 + sourceWeight * 20) * 10) / 10;
  return { score, matched };
}

function projectFromTitle(title: string) {
  const cleaned = title.replace(/[|:\-].*$/, "").trim();
  return cleaned || "Unknown project";
}

export async function runDiscoveryScan(limit = 50) {
  const leads: DiscoveryLead[] = [];

  for (const source of DISCOVERY_SOURCES) {
    try {
      const feed = await parser.parseURL(source.url);
      for (const item of feed.items || []) {
        const title = item.title?.trim() || "Untitled";
        const summary = (item.contentSnippet || item.content || "").toString().slice(0, 360);
        const combined = `${title}\n${summary}`;
        const { score, matched } = scoreEntry(combined, source.weight);

        if (matched.length === 0) {
          continue;
        }

        const link = item.link || feed.link || "";
        if (!link) {
          continue;
        }

        const publishedAt = item.isoDate || item.pubDate || new Date().toISOString();
        const id = `${source.id}-${slug(title)}-${new Date(publishedAt).getTime()}`;

        leads.push({
          id,
          project: projectFromTitle(title),
          title,
          summary,
          url: link,
          sourceId: source.id,
          sourceName: source.name,
          publishedAt: new Date(publishedAt).toISOString(),
          score,
          tags: matched,
        });
      }
    } catch {
      // Keep scan resilient if one source fails.
    }
  }

  const deduped = Array.from(
    new Map(
      leads
        .sort((a, b) => b.score - a.score)
        .map((lead) => [`${slug(lead.project)}-${slug(lead.title)}`, lead]),
    ).values(),
  );

  return deduped.slice(0, limit);
}

export async function persistDiscoveryLeads(leads: DiscoveryLead[]) {
  if (!hasSupabaseConfig() || leads.length === 0) {
    return { stored: 0, configured: false };
  }

  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("airdrop_leads").upsert(
    leads.map((lead) => ({
      id: lead.id,
      project: lead.project,
      title: lead.title,
      summary: lead.summary,
      url: lead.url,
      source_id: lead.sourceId,
      source_name: lead.sourceName,
      published_at: lead.publishedAt,
      score: lead.score,
      tags: lead.tags,
      discovered_at: new Date().toISOString(),
    })),
    { onConflict: "id" },
  );

  if (error) {
    return { stored: 0, configured: true, error: error.message };
  }

  return { stored: leads.length, configured: true };
}
