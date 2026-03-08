"use client";

import { useState } from "react";
import InputStep, { SubmitPayload } from "../components/InputStep";

interface Classification {
  difficulty: string;
  subject: string;
  reasoning: string;
}

interface ClassifyResult {
  classification: Classification;
  model: { id: string; label: string };
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCost: number;
  classifyCost: number;
}

type Stage = "input" | "classifying" | "approval" | "error";

export default function Home() {
  const [stage, setStage] = useState<Stage>("input");
  const [payload, setPayload] = useState<SubmitPayload | null>(null);
  const [classifyResult, setClassifyResult] = useState<ClassifyResult | null>(null);
  const [error, setError] = useState("");

  const handleSubmit = async (data: SubmitPayload) => {
    setPayload(data);
    setStage("classifying");
    setError("");

    try {
      const res = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: data.question, subject: data.subject }),
      });
      const result = await res.json();

      if (result.error) {
        setError(result.error);
        setStage("error");
        return;
      }

      setClassifyResult(result);
      setStage("approval");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStage("error");
    }
  };

  const handleApprove = () => {
    // Step 3 will hook in here — solve call
    console.log("Approved! Ready to solve.");
  };

  const handleReset = () => {
    setStage("input");
    setPayload(null);
    setClassifyResult(null);
    setError("");
  };

  const difficultyConfig: Record<string, { label: string; icon: string; color: string }> = {
    easy: { label: "Straightforward", icon: "◆", color: "#22c55e" },
    medium: { label: "Multi-step", icon: "◆◆", color: "#f59e0b" },
    hard: { label: "Complex", icon: "◆◆◆", color: "#ef4444" },
  };

  return (
    <main style={{ maxWidth: 620, margin: "0 auto", padding: "36px 20px 60px" }}>
      {/* Header */}
      <div style={{ marginBottom: 44, animation: "fd 0.5s ease-out" }}>
        <h1 style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 30, fontWeight: 700,
          color: "var(--text-bright)",
          letterSpacing: -0.5, marginBottom: 4,
        }}>
          Finance <span style={{ color: "var(--gold)" }}>Tutor</span>
        </h1>
        <div style={{
          fontSize: 11, color: "var(--text-dim)",
          letterSpacing: 2, textTransform: "uppercase" as const,
        }}>
          Self-correcting · Multi-model · Step-by-step
        </div>
      </div>

      {/* Stage: Input */}
      {stage === "input" && <InputStep onSubmit={handleSubmit} />}

      {/* Stage: Classifying */}
      {stage === "classifying" && payload && (
        <div style={{
          background: "var(--bg-card)", border: "1.5px solid var(--border)",
          borderRadius: 12, padding: 22, animation: "fd 0.4s ease-out",
        }}>
          <div className="badge">{payload.subject}</div>
          {payload.question && (
            <div style={{ fontSize: 13, color: "var(--text-bright)", lineHeight: 1.6, marginBottom: 10, whiteSpace: "pre-wrap" }}>
              {payload.question}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18, fontSize: 12, color: "var(--gold-dim)" }}>
            <div className="spinner" />
            Classifying difficulty...
          </div>
        </div>
      )}

      {/* Stage: Approval */}
      {stage === "approval" && classifyResult && payload && (
        <div style={{ animation: "fd 0.4s ease-out" }}>
          {/* Question recap */}
          <div style={{
            background: "var(--bg-card)", border: "1.5px solid var(--border)",
            borderRadius: 12, padding: 22, marginBottom: 16,
          }}>
            <div className="badge">{payload.subject}</div>
            <div style={{ fontSize: 13, color: "var(--text-bright)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
              {payload.question}
            </div>
          </div>

          {/* Classification result */}
          <div style={{
            background: "var(--bg-card)", border: "1.5px solid var(--border)",
            borderRadius: 12, padding: 22, marginBottom: 16,
          }}>
            <div className="label">Classification</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <span style={{
                color: difficultyConfig[classifyResult.classification.difficulty]?.color || "var(--gold)",
                fontSize: 14,
              }}>
                {difficultyConfig[classifyResult.classification.difficulty]?.icon || "◆"}
              </span>
              <div>
                <div style={{ fontSize: 14, color: "var(--text-bright)", fontWeight: 500 }}>
                  {difficultyConfig[classifyResult.classification.difficulty]?.label || classifyResult.classification.difficulty}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                  {classifyResult.classification.reasoning}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 10, color: "var(--text-dim)", letterSpacing: 1, textTransform: "uppercase" as const, marginBottom: 4 }}>Model</div>
                <div style={{ fontSize: 13, color: "var(--text-bright)" }}>{classifyResult.model.label}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "var(--text-dim)", letterSpacing: 1, textTransform: "uppercase" as const, marginBottom: 4 }}>Est. Tokens</div>
                <div style={{ fontSize: 13, color: "var(--text-bright)" }}>
                  ~{classifyResult.estimatedInputTokens + classifyResult.estimatedOutputTokens}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "var(--text-dim)", letterSpacing: 1, textTransform: "uppercase" as const, marginBottom: 4 }}>Est. Cost</div>
                <div style={{ fontSize: 13, color: "var(--gold)", fontWeight: 600 }}>
                  ${classifyResult.estimatedCost.toFixed(4)}
                </div>
              </div>
            </div>
          </div>

          {/* Approve / Reject buttons */}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={handleReset} style={{
              flex: 1, padding: 14,
              background: "transparent",
              border: "1.5px solid var(--border)",
              borderRadius: 10,
              color: "var(--text-dim)",
              fontFamily: "'DM Mono', monospace",
              fontSize: 12, cursor: "pointer",
              letterSpacing: 1, textTransform: "uppercase" as const,
              transition: "all 0.2s",
            }}>
              Cancel
            </button>
            <button onClick={handleApprove} style={{
              flex: 2, padding: 14,
              background: "var(--gold)",
              border: "none",
              borderRadius: 10,
              color: "var(--bg-deep)",
              fontFamily: "'DM Mono', monospace",
              fontSize: 12, fontWeight: 500, cursor: "pointer",
              letterSpacing: 1, textTransform: "uppercase" as const,
              transition: "all 0.2s",
            }}>
              Approve & Solve →
            </button>
          </div>
        </div>
      )}

      {/* Stage: Error */}
      {stage === "error" && (
        <div style={{ animation: "fd 0.4s ease-out" }}>
          <div style={{
            background: "var(--bg-card)", border: "1.5px solid var(--danger)",
            borderRadius: 12, padding: 22, marginBottom: 16,
          }}>
            <div style={{ fontSize: 13, color: "var(--danger)", marginBottom: 8, fontWeight: 500 }}>
              Something went wrong
            </div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.5 }}>
              {error}
            </div>
          </div>
          <button onClick={handleReset} style={{
            width: "100%", padding: 14,
            background: "transparent",
            border: "1.5px solid var(--border)",
            borderRadius: 10,
            color: "var(--text-dim)",
            fontFamily: "'DM Mono', monospace",
            fontSize: 12, cursor: "pointer",
            letterSpacing: 1, textTransform: "uppercase" as const,
          }}>
            Try Again
          </button>
        </div>
      )}

      <style>{`
        .label {
          font-size: 11px; color: var(--text-dim);
          letter-spacing: 1.5px; text-transform: uppercase;
          margin-bottom: 10px;
        }
        .badge {
          display: inline-block; font-size: 10px;
          letter-spacing: 1.5px; text-transform: uppercase;
          color: var(--gold); border: 1px solid var(--gold-dim);
          border-radius: 4px; padding: 3px 8px; margin-bottom: 14px;
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
