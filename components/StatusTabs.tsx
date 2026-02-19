"use client";

import { useMemo, useState, KeyboardEvent } from "react";
import { AirdropEvaluation } from "@/lib/types";

const TAB_ORDER = ["all", "eligible", "likely", "not_eligible", "unknown"] as const;
type TabKey = (typeof TAB_ORDER)[number];

type Props = {
  results: AirdropEvaluation[];
};

const STAGES = ["announced", "snapshot", "claim_open", "claim_end"] as const;

function tierLabel(status: AirdropEvaluation["status"]) {
  if (status === "eligible") return "Genesis Tier";
  if (status === "likely") return "Epoch Tier";
  if (status === "unknown") return "Pending Slot";
  return "Out Of Scope";
}

function stageProgress(status: AirdropEvaluation["airdropStatus"]) {
  if (status === "upcoming") return 0;
  if (status === "active") return 2;
  if (status === "snapshot_taken") return 1;
  return 3;
}

function stageLabel(stage: (typeof STAGES)[number], item: AirdropEvaluation) {
  if (stage === "announced") {
    return item.timeline?.announcedAt || "Announced";
  }
  if (stage === "snapshot") {
    return item.timeline?.snapshotAt || "Snapshot";
  }
  if (stage === "claim_open") {
    return item.timeline?.claimOpensAt || "Claim";
  }
  return item.timeline?.claimEndsAt || "End";
}

export default function StatusTabs({ results }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("all");

  const grouped = useMemo(() => {
    return {
      all: results,
      eligible: results.filter((r) => r.status === "eligible"),
      likely: results.filter((r) => r.status === "likely"),
      not_eligible: results.filter((r) => r.status === "not_eligible"),
      unknown: results.filter((r) => r.status === "unknown"),
    };
  }, [results]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = TAB_ORDER.indexOf(activeTab);

    if (e.key === "ArrowRight") {
      e.preventDefault();
      setActiveTab(TAB_ORDER[(currentIndex + 1) % TAB_ORDER.length]);
    }

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setActiveTab(TAB_ORDER[(currentIndex - 1 + TAB_ORDER.length) % TAB_ORDER.length]);
    }

    if (e.key === "Home") {
      e.preventDefault();
      setActiveTab(TAB_ORDER[0]);
    }

    if (e.key === "End") {
      e.preventDefault();
      setActiveTab(TAB_ORDER[TAB_ORDER.length - 1]);
    }
  };

  const activeResults = grouped[activeTab];

  return (
    <section className="results-shell" aria-label="Eligibility results">
      <div role="tablist" aria-label="Airdrop status tabs" className="tablist" onKeyDown={onKeyDown}>
        {TAB_ORDER.map((tab) => {
          const label = tab.replaceAll("_", " ");
          const count = grouped[tab].length;

          return (
            <button
              key={tab}
              type="button"
              role="tab"
              className={`tab ${activeTab === tab ? "tab-active" : ""}`}
              aria-selected={activeTab === tab}
              aria-controls={`panel-${tab}`}
              id={`tab-${tab}`}
              onClick={() => setActiveTab(tab)}
            >
              <span>{label}</span>
              <span className="count">{count}</span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`panel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        className="tab-panel"
      >
        {activeResults.length === 0 ? (
          <p className="empty-state">No airdrops in this category.</p>
        ) : (
          <ul className="result-list">
            {activeResults.map((item, index) => (
              <li
                key={item.id}
                className="result-card"
                style={{ animationDelay: `${index * 65}ms` }}
              >
                <div className="result-top-row">
                  <strong>{item.project}</strong>
                  <span className={`pill pill-${item.status}`}>{item.status.replaceAll("_", " ")}</span>
                </div>
                <p className="meta-row">
                  {tierLabel(item.status)} | {item.category} | {item.airdropStatus} | confidence {item.confidence}%
                </p>
                <p className="reason">{item.reason}</p>
                <div className="proof-panel" aria-label="Proof of match">
                  <div className="proof-row">
                    <span className="proof-title">Proof of Match</span>
                    <span className={`claim-safety claim-safety-${item.claimSafety.grade}`}>
                      {item.claimSafety.grade}
                    </span>
                  </div>
                  <div className="chip-row">
                    {item.proof.met.slice(0, 4).map((proof) => (
                      <span key={proof} className="proof-chip proof-met">
                        {proof}
                      </span>
                    ))}
                    {item.proof.unmet.slice(0, 3).map((proof) => (
                      <span key={proof} className="proof-chip proof-unmet">
                        {proof}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="timeline" aria-label="Airdrop timeline">
                  {STAGES.map((stage, stageIndex) => {
                    const isDone = stageIndex <= stageProgress(item.airdropStatus);
                    return (
                      <div key={stage} className={`timeline-step ${isDone ? "timeline-done" : ""}`}>
                        <span className="timeline-dot" />
                        <span className="timeline-label">{stageLabel(stage, item)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="links-row">
                  <a href={item.officialClaimUrl} target="_blank" rel="noreferrer">
                    Official site
                  </a>
                  <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                    Source
                  </a>
                  <span className={`risk risk-${item.riskLevel}`}>risk: {item.riskLevel}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
