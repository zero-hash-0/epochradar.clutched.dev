"use client";

import { FormEvent, useEffect, useState } from "react";

type AdminRow = {
  id: string;
  project: string;
  category: string;
  status: string;
  risk_level?: string;
  riskLevel?: string;
  official_claim_url?: string;
  officialClaimUrl?: string;
  source_url?: string;
  sourceUrl?: string;
};

type DiscoveryLead = {
  id: string;
  project: string;
  title: string;
  summary: string;
  url: string;
  sourceName: string;
  publishedAt: string;
  score: number;
  tags: string[];
};

const initialForm = {
  id: "",
  project: "",
  category: "defi",
  status: "upcoming",
  riskLevel: "medium",
  officialClaimUrl: "",
  sourceUrl: "",
  checksJson: '{"minRecentTransactions": 10}',
};

export default function AdminPage() {
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [leads, setLeads] = useState<DiscoveryLead[]>([]);
  const [scanning, setScanning] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/airdrops");
      const payload = await res.json();

      if (!res.ok) {
        throw new Error(payload.error || "Failed to load airdrops");
      }

      setRows(payload.data || []);
      setNote(payload.note || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    void loadDiscovery();
  }, []);

  const loadDiscovery = async () => {
    try {
      const res = await fetch("/api/discovery", { cache: "no-store" });
      const payload = await res.json();
      if (res.ok) {
        setLeads(payload.leads || []);
      }
    } catch {
      // Non-blocking in admin UI.
    }
  };

  const runDiscovery = async () => {
    setScanning(true);
    try {
      const res = await fetch("/api/admin/discovery/run", { method: "POST" });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || "Discovery scan failed");
      }
      setLeads(payload.leads || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown discovery error");
    } finally {
      setScanning(false);
    }
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    let checks: Record<string, unknown> = {};
    try {
      checks = JSON.parse(form.checksJson);
    } catch {
      setError("checksJson must be valid JSON");
      return;
    }

    const res = await fetch("/api/admin/airdrops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: form.id,
        project: form.project,
        category: form.category,
        status: form.status,
        riskLevel: form.riskLevel,
        officialClaimUrl: form.officialClaimUrl,
        sourceUrl: form.sourceUrl,
        checks,
      }),
    });

    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error || "Failed to create airdrop");
      return;
    }

    setForm(initialForm);
    await load();
  };

  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">Admin</p>
        <h1>Airdrop Rules Manager</h1>
        <p className="subhead">Create and review airdrop eligibility rules stored in Supabase.</p>
        <p className="subhead">Back to checker at <a href="/">/</a>.</p>
        {note ? <p className="safety-note">{note}</p> : null}
      </section>

      <section className="profile-panel">
        <h2>Add rule</h2>
        <form className="admin-form" onSubmit={onSubmit}>
          <input
            placeholder="id (example: drift-phase-2)"
            value={form.id}
            onChange={(e) => setForm((s) => ({ ...s, id: e.target.value }))}
            required
          />
          <input
            placeholder="project"
            value={form.project}
            onChange={(e) => setForm((s) => ({ ...s, project: e.target.value }))}
            required
          />
          <select value={form.category} onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))}>
            <option value="defi">defi</option>
            <option value="nft">nft</option>
            <option value="infrastructure">infrastructure</option>
            <option value="consumer">consumer</option>
          </select>
          <select value={form.status} onChange={(e) => setForm((s) => ({ ...s, status: e.target.value }))}>
            <option value="upcoming">upcoming</option>
            <option value="active">active</option>
            <option value="snapshot_taken">snapshot_taken</option>
            <option value="ended">ended</option>
          </select>
          <select value={form.riskLevel} onChange={(e) => setForm((s) => ({ ...s, riskLevel: e.target.value }))}>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
          <input
            placeholder="official claim URL"
            value={form.officialClaimUrl}
            onChange={(e) => setForm((s) => ({ ...s, officialClaimUrl: e.target.value }))}
            required
          />
          <input
            placeholder="source URL"
            value={form.sourceUrl}
            onChange={(e) => setForm((s) => ({ ...s, sourceUrl: e.target.value }))}
            required
          />
          <textarea
            placeholder='checks JSON, example: {"minRecentTransactions": 20}'
            value={form.checksJson}
            onChange={(e) => setForm((s) => ({ ...s, checksJson: e.target.value }))}
            rows={5}
            required
          />
          <button className="check-btn" type="submit">
            Save rule
          </button>
        </form>
        {error ? <p className="error">{error}</p> : null}
      </section>

      <section className="results-shell">
        <h2>Existing rules</h2>
        {loading ? <p className="empty-state">Loading...</p> : null}
        {!loading && rows.length === 0 ? <p className="empty-state">No rules yet.</p> : null}
        <ul className="result-list">
          {rows.map((row) => (
            <li key={row.id} className="result-card">
              <div className="result-top-row">
                <strong>{row.project}</strong>
                <span className="pill">{row.status}</span>
              </div>
              <p className="meta-row">
                {row.category} | risk {(row.risk_level || row.riskLevel || "unknown").toString()}
              </p>
              <p className="reason">ID: {row.id}</p>
              <div className="links-row">
                <a href={(row.official_claim_url || row.officialClaimUrl || "#").toString()} target="_blank" rel="noreferrer">
                  Official site
                </a>
                <a href={(row.source_url || row.sourceUrl || "#").toString()} target="_blank" rel="noreferrer">
                  Source
                </a>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="results-shell">
        <div className="result-top-row">
          <h2>Discovery Radar</h2>
          <button type="button" className="ghost-btn" onClick={runDiscovery} disabled={scanning}>
            {scanning ? "Scanning..." : "Run scan now"}
          </button>
        </div>
        <p className="empty-state">
          High-coverage feed from Solana ecosystem sources. Always verify claim URLs before listing.
        </p>
        <ul className="result-list">
          {leads.slice(0, 12).map((lead) => (
            <li key={lead.id} className="result-card">
              <div className="result-top-row">
                <strong>{lead.project}</strong>
                <span className="pill">score {lead.score}</span>
              </div>
              <p className="meta-row">
                {lead.sourceName} | {new Date(lead.publishedAt).toLocaleString()}
              </p>
              <p className="reason">{lead.title}</p>
              <p className="reason">{lead.summary}</p>
              <div className="chip-row">
                {lead.tags.map((tag) => (
                  <span key={tag} className="proof-chip proof-met">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="links-row">
                <a href={lead.url} target="_blank" rel="noreferrer">
                  Open source post
                </a>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <footer className="credit">
        <span>Made with Love</span>
        <span className="credit-heart" aria-hidden="true">❤️</span>
        <span>by</span>
        <a href="https://x.com/notT0KY0" target="_blank" rel="noreferrer">
          @notT0KY0
        </a>
      </footer>
    </main>
  );
}
