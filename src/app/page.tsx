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

interface SolveResult {
  solution: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  actualCost: number;
}

interface CompareResult {
  comparison: {
    match: boolean;
    claude_correct: boolean;
    student_correct: boolean;
    explanation: string;
    mistake_type: string;
    lesson: string | null;
  };
  compareCost: number;
  stored: boolean;
}

type Stage = "input" | "classifying" | "approval" | "solving" | "done" | "comparing" | "feedback" | "error";

interface FollowUpMessage {
  role: "user" | "assistant";
  content: string;
  cost?: number;
}

function RenderMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div style={{ lineHeight: 1.8 }}>
      {lines.map((line, i) => {
        let html = line
          .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#e2c066">$1</strong>')
          .replace(/\*(.+?)\*/g, "<em>$1</em>")
          .replace(/`(.+?)`/g, '<code style="background:#1a1a2e;padding:2px 6px;border-radius:3px;font-size:0.9em;color:#a78bfa">$1</code>');

        if (line.startsWith("### "))
          return <h3 key={i} style={{ color: "#e2c066", margin: "16px 0 6px", fontSize: "1.05em", fontFamily: "'Cormorant Garamond', serif" }} dangerouslySetInnerHTML={{ __html: html.slice(4) }} />;
        if (line.startsWith("## "))
          return <h2 key={i} style={{ color: "#e2c066", margin: "18px 0 8px", fontSize: "1.15em", fontFamily: "'Cormorant Garamond', serif" }} dangerouslySetInnerHTML={{ __html: html.slice(3) }} />;
        if (line.startsWith("# "))
          return <h1 key={i} style={{ color: "#e2c066", margin: "20px 0 10px", fontSize: "1.3em", fontFamily: "'Cormorant Garamond', serif" }} dangerouslySetInnerHTML={{ __html: html.slice(2) }} />;
        if (line.startsWith("- "))
          return <div key={i} style={{ paddingLeft: 18, position: "relative" }}><span style={{ position: "absolute", left: 4, color: "#e2c066" }}>&#8250;</span><span dangerouslySetInnerHTML={{ __html: html.slice(2) }} /></div>;
        if (line.trim() === "") return <div key={i} style={{ height: 8 }} />;
        return <div key={i} dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </div>
  );
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("input");
  const [payload, setPayload] = useState<SubmitPayload | null>(null);
  const [classifyResult, setClassifyResult] = useState<ClassifyResult | null>(null);
  const [solveResult, setSolveResult] = useState<SolveResult | null>(null);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [studentAnswer, setStudentAnswer] = useState("");
  const [error, setError] = useState("");
  const [followUps, setFollowUps] = useState<FollowUpMessage[]>([]);
  const [followUpInput, setFollowUpInput] = useState("");
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [followUpTotalCost, setFollowUpTotalCost] = useState(0);

  const handleSubmit = async (data: SubmitPayload) => {
    setPayload(data);
    setStage("classifying");
    setError("");

    try {
      const res = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: data.question,
          subject: data.subject,
          files: data.files.map(f => ({ base64: f.base64, mediaType: f.mediaType })),
        }),
      });
      const result = await res.json();

      if (result.error) {
        setError(result.error);
        setStage("error");
        return;
      }

      setClassifyResult(result);
      setStage("approval");
      // Signal to Francium parent
      try {
        window.parent.postMessage({
          type: 'francium_signal',
          toolId: 'finance-tutor',
          event: 'question_submitted',
          data: {
            subject: data.subject,
            question: data.question.slice(0, 300),
            difficulty: result.classification.difficulty,
            topic: result.classification.subject,
            model: result.model.label,
            estimatedCost: result.estimatedCost,
          }
        }, '*');
      } catch (e) { /* silent */ }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStage("error");
    }
  };

  const handleApprove = async () => {
    if (!classifyResult || !payload) return;
    setStage("solving");

    try {
      const res = await fetch("/api/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: payload.question,
          difficulty: classifyResult.classification.difficulty,
          subject: payload.subject,
          topic: classifyResult.classification.subject,
          files: payload.files.map(f => ({ base64: f.base64, mediaType: f.mediaType })),
          mode: payload.mode,
        }),
      });
      const result = await res.json();

      if (result.error) {
        setError(result.error);
        setStage("error");
        return;
      }

      setSolveResult(result);
      setStage("done");
      // Signal to Francium parent
      try {
        window.parent.postMessage({
          type: 'francium_signal',
          toolId: 'finance-tutor',
          event: 'solution_received',
          data: {
            model: result.model,
            actualCost: result.actualCost,
            difficulty: classifyResult.classification.difficulty,
            topic: classifyResult.classification.subject,
          }
        }, '*');
      } catch (e) { /* silent */ }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Solve failed");
      setStage("error");
    }
  };

  const handleCompare = async () => {
    if (!studentAnswer.trim() || !payload || !solveResult || !classifyResult) return;
    setStage("comparing");

    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: payload.question,
          claudeAnswer: solveResult.solution,
          studentAnswer,
          subject: payload.subject,
          difficulty: classifyResult.classification.difficulty,
          topic: classifyResult.classification.subject,
        }),
      });
      const result = await res.json();

      if (result.error) {
        setError(result.error);
        setStage("error");
        return;
      }

      setCompareResult(result);
      setStage("feedback");
      // Signal to Francium parent
      try {
        window.parent.postMessage({
          type: 'francium_signal',
          toolId: 'finance-tutor',
          event: 'feedback_submitted',
          data: {
            claude_correct: result.comparison.claude_correct,
            mistake_type: result.comparison.mistake_type,
            lesson_stored: result.stored,
            topic: classifyResult.classification.subject,
            difficulty: classifyResult.classification.difficulty,
          }
        }, '*');
      } catch (e) { /* silent */ }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Compare failed");
      setStage("error");
    }
  };

  const handleReset = () => {
    setStage("input");
    setPayload(null);
    setClassifyResult(null);
    setSolveResult(null);
    setCompareResult(null);
    setStudentAnswer("");
    setError("");
    setFollowUps([]);
    setFollowUpInput("");
    setFollowUpLoading(false);
    setFollowUpTotalCost(0);
  };

  const handleFollowUp = async () => {
    if (!followUpInput.trim() || !payload || !solveResult || !classifyResult) return;
    setFollowUpLoading(true);

    // Build messages array: original question + solution + all follow-ups + new question
    const messages: { role: "user" | "assistant"; content: string }[] = [
      { role: "user", content: payload.question || "Solve the problem from the uploaded file." },
      { role: "assistant", content: solveResult.solution },
      ...followUps.map(f => ({ role: f.role, content: f.content })),
      { role: "user" as const, content: followUpInput },
    ];

    // Add user message to display immediately
    setFollowUps(prev => [...prev, { role: "user", content: followUpInput }]);
    const question = followUpInput;
    setFollowUpInput("");

    try {
      const res = await fetch("/api/followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          difficulty: classifyResult.classification.difficulty,
          subject: payload.subject,
          mode: payload.mode,
          topic: classifyResult.classification.subject,
        }),
      });
      const result = await res.json();

      if (result.error) {
        setFollowUps(prev => [...prev, { role: "assistant", content: `Error: ${result.error}` }]);
      } else {
        setFollowUps(prev => [...prev, {
          role: "assistant",
          content: result.response,
          cost: result.followupCost,
        }]);
        setFollowUpTotalCost(prev => prev + (result.followupCost || 0));
      }
    } catch (err) {
      setFollowUps(prev => [...prev, {
        role: "assistant",
        content: `Error: ${err instanceof Error ? err.message : "Follow-up failed"}`,
      }]);
    }
    setFollowUpLoading(false);
  };

  const difficultyConfig: Record<string, { label: string; icon: string; color: string }> = {
    easy: { label: "Straightforward", icon: "\u25C6", color: "#22c55e" },
    medium: { label: "Multi-step", icon: "\u25C6\u25C6", color: "#f59e0b" },
    hard: { label: "Complex", icon: "\u25C6\u25C6\u25C6", color: "#ef4444" },
  };

  const totalCost =
    (classifyResult?.classifyCost || 0) +
    (solveResult?.actualCost || 0) +
    (compareResult?.compareCost || 0) +
    followUpTotalCost;

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
          <div style={{ fontSize: 13, color: "var(--text-bright)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {payload.question}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18, fontSize: 12, color: "var(--gold-dim)" }}>
            <div className="spinner" />
            Classifying difficulty...
          </div>
        </div>
      )}

      {/* Stage: Approval */}
      {stage === "approval" && classifyResult && payload && (
        <div style={{ animation: "fd 0.4s ease-out" }}>
          <div style={{
            background: "var(--bg-card)", border: "1.5px solid var(--border)",
            borderRadius: 12, padding: 22, marginBottom: 16,
          }}>
            <div className="badge">{payload.subject}</div>
            <div style={{ fontSize: 13, color: "var(--text-bright)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
              {payload.question}
            </div>
          </div>

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
                {difficultyConfig[classifyResult.classification.difficulty]?.icon}
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
                <div className="stat-label">Model</div>
                <div className="stat-value">{classifyResult.model.label}</div>
              </div>
              <div>
                <div className="stat-label">Est. Tokens</div>
                <div className="stat-value">~{classifyResult.estimatedInputTokens + classifyResult.estimatedOutputTokens}</div>
              </div>
              <div>
                <div className="stat-label">Est. Cost</div>
                <div className="stat-value" style={{ color: "var(--gold)", fontWeight: 600 }}>
                  ${classifyResult.estimatedCost.toFixed(4)}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={handleReset} className="btn-secondary">Cancel</button>
            <button onClick={handleApprove} className="btn-primary">Approve & Solve</button>
          </div>
        </div>
      )}

      {/* Stage: Solving */}
      {stage === "solving" && payload && (
        <div style={{
          background: "var(--bg-card)", border: "1.5px solid var(--border)",
          borderRadius: 12, padding: 22, animation: "fd 0.4s ease-out",
        }}>
          <div className="badge">{payload.subject}</div>
          <div style={{ fontSize: 13, color: "var(--text-bright)", lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: 16 }}>
            {payload.question}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--gold-dim)" }}>
            <div className="spinner" />
            Solving with {classifyResult?.model.label}...
          </div>
        </div>
      )}

      {/* Stage: Done (solution + feedback input) */}
      {(stage === "done" || stage === "comparing" || stage === "feedback") && solveResult && payload && classifyResult && (
        <div style={{ animation: "fd 0.4s ease-out" }}>
          {/* Question */}
          <div style={{
            background: "var(--bg-card)", border: "1.5px solid var(--border)",
            borderRadius: 12, padding: 22, marginBottom: 16,
          }}>
            <div className="badge">{payload.subject}</div>
            <div style={{ fontSize: 13, color: "var(--text-bright)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
              {payload.question}
            </div>
          </div>

          {/* Solution */}
          <div style={{
            background: "var(--bg-card)", border: "1.5px solid var(--gold-dim)",
            borderRadius: 12, padding: 22, marginBottom: 16,
          }}>
            <div className="label">{payload.mode === "guide" ? "Guided Exploration" : "Solution"}</div>
            <div style={{ fontSize: 13, color: "var(--text-bright)" }}>
              <RenderMarkdown text={solveResult.solution} />
            </div>
          </div>

          {/* Follow-up conversation */}
          {followUps.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              {followUps.map((msg, i) => (
                <div key={i} style={{
                  background: msg.role === "user" ? "var(--bg-deep)" : "var(--bg-card)",
                  border: `1.5px solid ${msg.role === "assistant" ? "var(--gold-dim)" : "var(--border)"}`,
                  borderRadius: 12, padding: 16, marginBottom: 8,
                }}>
                  <div style={{
                    fontSize: 10, color: msg.role === "user" ? "var(--text-dim)" : "var(--gold-dim)",
                    letterSpacing: 1, textTransform: "uppercase" as const, marginBottom: 8,
                  }}>
                    {msg.role === "user" ? "You" : "Tutor"}
                    {msg.cost ? ` · $${msg.cost.toFixed(4)}` : ""}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-bright)" }}>
                    {msg.role === "assistant" ? <RenderMarkdown text={msg.content} /> : msg.content}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Follow-up input — available in done and feedback stages */}
          {(stage === "done" || stage === "feedback") && (
            <div style={{
              background: "var(--bg-card)", border: "1.5px solid var(--border)",
              borderRadius: 12, padding: 16, marginBottom: 16,
            }}>
              <div className="label">Ask a follow-up</div>
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  type="text"
                  placeholder="Explain step 2 differently... / What if the rate was 10%?..."
                  value={followUpInput}
                  onChange={(e) => setFollowUpInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && followUpInput.trim()) handleFollowUp(); }}
                  disabled={followUpLoading}
                  style={{
                    flex: 1, padding: 12,
                    background: "var(--bg-deep)", border: "1.5px solid var(--border)",
                    borderRadius: 8, color: "var(--text-bright)",
                    fontFamily: "'DM Mono', monospace", fontSize: 12,
                    outline: "none",
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = "var(--gold-dim)"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "var(--border)"}
                />
                <button
                  onClick={handleFollowUp}
                  disabled={!followUpInput.trim() || followUpLoading}
                  className="btn-primary"
                  style={{
                    padding: "12px 20px", flex: "none",
                    opacity: followUpInput.trim() && !followUpLoading ? 1 : 0.3,
                  }}
                >
                  {followUpLoading ? "..." : "Ask"}
                </button>
              </div>
            </div>
          )}

          {/* Follow-up loading spinner */}
          {followUpLoading && (
            <div style={{
              background: "var(--bg-card)", border: "1.5px solid var(--border)",
              borderRadius: 12, padding: 16, marginBottom: 16,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--gold-dim)" }}>
                <div className="spinner" />
                Thinking about your follow-up...
              </div>
            </div>
          )}

          {/* Feedback section */}
          {stage === "done" && (
            <div style={{
              background: "var(--bg-card)", border: "1.5px solid var(--border)",
              borderRadius: 12, padding: 22, marginBottom: 16,
            }}>
              <div className="label">Know the correct answer? Help improve the tutor</div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 12 }}>
                Optional — share the textbook answer or your solution to help the system learn.
              </div>
              <textarea
                placeholder="Paste the correct answer here..."
                value={studentAnswer}
                onChange={(e) => setStudentAnswer(e.target.value)}
                style={{
                  width: "100%", minHeight: 80,
                  background: "var(--bg-deep)", border: "1.5px solid var(--border)",
                  borderRadius: 8, padding: 12,
                  color: "var(--text-bright)", fontFamily: "'DM Mono', monospace",
                  fontSize: 12, lineHeight: 1.5, resize: "vertical", outline: "none",
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = "var(--gold-dim)"}
                onBlur={(e) => e.currentTarget.style.borderColor = "var(--border)"}
              />
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button onClick={handleReset} className="btn-secondary">New Question</button>
                <button
                  onClick={handleCompare}
                  disabled={!studentAnswer.trim()}
                  className="btn-primary"
                  style={{ opacity: studentAnswer.trim() ? 1 : 0.3 }}
                >
                  Submit Feedback
                </button>
              </div>
            </div>
          )}

          {/* Comparing spinner */}
          {stage === "comparing" && (
            <div style={{
              background: "var(--bg-card)", border: "1.5px solid var(--border)",
              borderRadius: 12, padding: 22, marginBottom: 16,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--gold-dim)" }}>
                <div className="spinner" />
                Comparing answers...
              </div>
            </div>
          )}

          {/* Feedback result */}
          {stage === "feedback" && compareResult && (
            <div style={{
              background: "var(--bg-card)",
              border: compareResult.comparison.claude_correct
                ? "1.5px solid #22c55e"
                : "1.5px solid var(--danger)",
              borderRadius: 12, padding: 22, marginBottom: 16,
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
              }}>
                <span style={{
                  fontSize: 18,
                  color: compareResult.comparison.claude_correct ? "#22c55e" : "var(--danger)",
                }}>
                  {compareResult.comparison.claude_correct ? "\u2713" : "\u2717"}
                </span>
                <span style={{
                  fontSize: 13, fontWeight: 600,
                  color: compareResult.comparison.claude_correct ? "#22c55e" : "var(--danger)",
                }}>
                  {compareResult.comparison.claude_correct
                    ? "Solution was correct"
                    : "Solution had an error"}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.6, marginBottom: 12 }}>
                {compareResult.comparison.explanation}
              </div>
              {compareResult.comparison.lesson && !compareResult.comparison.claude_correct && (
                <div style={{
                  background: "var(--bg-deep)", borderRadius: 8, padding: 12, marginBottom: 12,
                }}>
                  <div style={{ fontSize: 10, color: "var(--gold)", letterSpacing: 1, textTransform: "uppercase" as const, marginBottom: 6 }}>
                    Lesson Learned
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.5 }}>
                    {compareResult.comparison.lesson}
                  </div>
                </div>
              )}
              {compareResult.stored && (
                <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
                  Feedback stored — future answers will improve from this.
                </div>
              )}
            </div>
          )}

          {/* Cost breakdown */}
          {(stage === "feedback" || stage === "done") && (
            <div style={{
              background: "var(--bg-card)", border: "1.5px solid var(--border)",
              borderRadius: 12, padding: 22, marginBottom: 16,
            }}>
              <div className="label">Cost Breakdown</div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <div className="stat-label">Classify</div>
                  <div className="stat-value">${classifyResult.classifyCost.toFixed(4)}</div>
                </div>
                <div>
                  <div className="stat-label">Solve</div>
                  <div className="stat-value">${solveResult.actualCost.toFixed(4)}</div>
                </div>
                {compareResult && (
                  <div>
                    <div className="stat-label">Compare</div>
                    <div className="stat-value">${compareResult.compareCost.toFixed(4)}</div>
                  </div>
                )}
                {followUpTotalCost > 0 && (
                  <div>
                    <div className="stat-label">Follow-ups ({followUps.filter(f => f.role === "assistant").length})</div>
                    <div className="stat-value">${followUpTotalCost.toFixed(4)}</div>
                  </div>
                )}
                <div>
                  <div className="stat-label">Total</div>
                  <div className="stat-value" style={{ color: "var(--gold)", fontWeight: 600 }}>
                    ${totalCost.toFixed(4)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* New question button (only on feedback stage) */}
          {stage === "feedback" && (
            <button onClick={handleReset} className="btn-primary" style={{ width: "100%" }}>
              New Question
            </button>
          )}
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
          <button onClick={handleReset} className="btn-secondary" style={{ width: "100%" }}>
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
        .stat-label {
          font-size: 10px; color: var(--text-dim);
          letter-spacing: 1px; text-transform: uppercase;
          margin-bottom: 4px;
        }
        .stat-value {
          font-size: 13px; color: var(--text-bright);
        }
        .btn-primary {
          flex: 2; padding: 14px;
          background: var(--gold); border: none; border-radius: 10px;
          color: var(--bg-deep); font-family: 'DM Mono', monospace;
          font-size: 12px; font-weight: 500; cursor: pointer;
          letter-spacing: 1px; text-transform: uppercase;
          transition: all 0.2s;
        }
        .btn-primary:hover { background: #ecd080; box-shadow: 0 4px 24px rgba(226,192,102,0.18); }
        .btn-secondary {
          flex: 1; padding: 14px;
          background: transparent; border: 1.5px solid var(--border);
          border-radius: 10px; color: var(--text-dim);
          font-family: 'DM Mono', monospace; font-size: 12px;
          cursor: pointer; letter-spacing: 1px; text-transform: uppercase;
          transition: all 0.2s;
        }
        .btn-secondary:hover { border-color: var(--text-dim); }
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