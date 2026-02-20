"use client";

import { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";

type SavedAddress = {
  id: string;
  label: string;
  address: string;
  note: string;
  addedAt: string;
  tags: string[];
};

const STORAGE_KEY = "epochradar_address_book_v1";
const AVATAR_COLORS = ["#14f195", "#23d3ff", "#9945ff", "#f97316", "#ec4899", "#84cc16"];

function randomColor(address: string) {
  const idx = address.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function isValid(address: string) {
  try { new PublicKey(address); return true; } catch { return false; }
}

export default function AddressBook() {
  const [entries, setEntries] = useState<SavedAddress[]>([]);
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setEntries(JSON.parse(raw) as SavedAddress[]);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); } catch { /* ignore */ }
  }, [entries, mounted]);

  const addEntry = () => {
    if (!label.trim()) { setError("Label is required."); return; }
    if (!address.trim()) { setError("Address is required."); return; }
    if (!isValid(address.trim())) { setError("Invalid Solana address."); return; }
    if (entries.some((e) => e.address === address.trim())) { setError("Address already saved."); return; }

    const entry: SavedAddress = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label: label.trim(),
      address: address.trim(),
      note: note.trim(),
      addedAt: new Date().toISOString(),
      tags,
    };
    setEntries((prev) => [entry, ...prev]);
    setLabel(""); setAddress(""); setNote(""); setTags([]); setTagInput(""); setError(null);
  };

  const removeEntry = (id: string) => setEntries((prev) => prev.filter((e) => e.id !== id));

  const copyAddress = async (addr: string) => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(addr);
      setTimeout(() => setCopied(null), 1800);
    } catch { /* ignore */ }
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput("");
  };

  const filtered = entries.filter((e) =>
    e.label.toLowerCase().includes(search.toLowerCase()) ||
    e.address.toLowerCase().includes(search.toLowerCase()) ||
    e.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="ab-shell">
      {/* ── Add entry form ── */}
      <div className="ab-form-card">
        <h3 className="ab-section-title">Add Address</h3>
        <div className="ab-form-grid">
          <input
            className="ab-input"
            placeholder="Label (e.g. My Trading Wallet)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <input
            className="ab-input ab-input-mono"
            placeholder="Solana wallet address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <input
            className="ab-input"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="ab-tag-row">
            <input
              className="ab-input"
              placeholder="Add tag (press Enter)"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
            />
            <button type="button" className="ghost-btn" onClick={addTag}>+ Tag</button>
          </div>
          {tags.length > 0 && (
            <div className="chip-row">
              {tags.map((t) => (
                <button key={t} type="button" className="profile-chip" onClick={() => setTags((prev) => prev.filter((x) => x !== t))}>
                  {t} ×
                </button>
              ))}
            </div>
          )}
          {error && <p className="error">{error}</p>}
          <button type="button" className="check-btn" style={{ width: "fit-content" }} onClick={addEntry}>
            Save Address
          </button>
        </div>
      </div>

      {/* ── Search ── */}
      {entries.length > 0 && (
        <div className="ab-search-row">
          <input
            className="ab-input ab-search"
            placeholder="Search by label, address, or tag…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="ab-count">{filtered.length} / {entries.length}</span>
        </div>
      )}

      {/* ── Entries ── */}
      {filtered.length === 0 && entries.length === 0 && (
        <p className="empty-state">No addresses saved yet. Add one above.</p>
      )}
      {filtered.length === 0 && entries.length > 0 && (
        <p className="empty-state">No results for &quot;{search}&quot;.</p>
      )}

      <div className="ab-list">
        {filtered.map((entry) => {
          const color = randomColor(entry.address);
          return (
            <article key={entry.id} className="ab-card">
              <div className="ab-card-left">
                {/* Avatar */}
                <div className="ab-avatar" style={{ background: `${color}20`, border: `1.5px solid ${color}55` }}>
                  <span style={{ color, fontWeight: 700, fontSize: 13 }}>
                    {entry.label.slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="ab-card-info">
                  <div className="ab-card-label">{entry.label}</div>
                  <div className="ab-card-addr">{shortAddr(entry.address)}</div>
                  {entry.note && <div className="ab-card-note">{entry.note}</div>}
                  {entry.tags.length > 0 && (
                    <div className="chip-row" style={{ marginTop: 6 }}>
                      {entry.tags.map((t) => (
                        <span key={t} className="proof-chip proof-met">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="ab-card-actions">
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => copyAddress(entry.address)}
                  title="Copy address"
                >
                  {copied === entry.address ? "✓ Copied" : "Copy"}
                </button>
                <a
                  href={`https://solscan.io/account/${entry.address}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ghost-btn"
                  style={{ display: "inline-flex", alignItems: "center" }}
                >
                  Solscan ↗
                </a>
                <button type="button" className="ghost-btn ab-delete" onClick={() => removeEntry(entry.id)} title="Remove">
                  ×
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
