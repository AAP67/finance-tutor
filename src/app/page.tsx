"use client";

import { useState } from "react";
import InputStep, { SubmitPayload } from "../components/InputStep";

export default function Home() {
  const [payload, setPayload] = useState<SubmitPayload | null>(null);

  const handleSubmit = (data: SubmitPayload) => {
    setPayload(data);
    console.log("Submitted:", data);
  };

  return (
    <main style={{ maxWidth: 620, margin: "0 auto", padding: "36px 20px 60px" }}>
      {/* Header */}
      <div style={{ marginBottom: 44, animation: "fd 0.5s ease-out" }}>
        <h1 style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 30,
          fontWeight: 700,
          color: "var(--text-bright)",
          letterSpacing: -0.5,
          marginBottom: 4,
        }}>
          Finance <span style={{ color: "var(--gold)" }}>Tutor</span>
        </h1>
        <div style={{
          fontSize: 11,
          color: "var(--text-dim)",
          letterSpacing: 2,
          textTransform: "uppercase" as const,
        }}>
          Self-correcting · Multi-model · Step-by-step
        </div>
      </div>

      {!payload ? (
        <InputStep onSubmit={handleSubmit} />
      ) : (
        <div style={{
          background: "var(--bg-card)",
          border: "1.5px solid var(--border)",
          borderRadius: 12,
          padding: 22,
          animation: "fd 0.4s ease-out",
        }}>
          <div style={{
            display: "inline-block",
            fontSize: 10,
            letterSpacing: 1.5,
            textTransform: "uppercase" as const,
            color: "var(--gold)",
            border: "1px solid var(--gold-dim)",
            borderRadius: 4,
            padding: "3px 8px",
            marginBottom: 14,
          }}>
            {payload.subject}
          </div>
          {payload.question && (
            <div style={{ fontSize: 13, color: "var(--text-bright)", lineHeight: 1.6, marginBottom: 10, whiteSpace: "pre-wrap" }}>
              {payload.question}
            </div>
          )}
          {payload.files.length > 0 && (
            <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
              {payload.files.length} file{payload.files.length > 1 ? "s" : ""} attached
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18, fontSize: 12, color: "var(--gold-dim)" }}>
            <div className="spinner" />
            Classifying difficulty...
          </div>
        </div>
      )}

      <style>{`
        .label {
          font-size: 11px;
          color: var(--text-dim);
          letter-spacing: 1.5px;
          text-transform: uppercase;
          margin-bottom: 10px;
        }
        .spinner {
          width: 15px; height: 15px;
          border: 2px solid var(--border);
          border-top-color: var(--gold);
          border-radius: 50%;
          animation: sp 0.7s linear infinite;
        }
        @keyframes sp { to { transform: rotate(360deg); } }
        @keyframes fd { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </main>
  );
}
