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
  const [showDashboard, setShowDashboard] = useState(false);
  const [dashboardData, setDashboardData] = useState<{
    stats: { total: number; correct: number; incorrect: number; accuracyRate: number; mistakeTypes: Record<string, number>; topicAccuracy: { topic: string; total: number; correct: number; accuracy: number }[] } | null;
    learnings: { question: string; mistake_type: string; lesson: string; subject: string; difficulty: string; topic: string }[];
    history: { date: string; total: number; correct: number; questions: string[] }[];
  } | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  const fetchDashboard = async () => {
    setDashboardLoading(true);
    try {
      const res = await fetch("/api/learnings?view=all");
      const data = await res.json();
      setDashboardData(data);
    } catch {
      setDashboardData(null);
    }
    setDashboardLoading(false);
  };

  const toggleDashboard = () => {
    if (!showDashboard) fetchDashboard();
    setShowDashboard(!showDashboard);
    setShowPractice(false);
  };

  // Practice mode state
  const [showPractice, setShowPractice] = useState(false);
  const [practiceSubject, setPracticeSubject] = useState<string | null>(null);
  const [practiceDifficulty, setPracticeDifficulty] = useState<string>("medium");
  const [practiceTopic, setPracticeTopic] = useState<string>("");
  const [practiceTopics, setPracticeTopics] = useState<string[]>([]);
  const [practiceLoading, setPracticeLoading] = useState(false);

  const fetchPracticeTopics = async (subject: string) => {
    try {
      const res = await fetch(`/api/practice?subject=${subject}`);
      const data = await res.json();
      setPracticeTopics(data.topics || []);
    } catch {
      setPracticeTopics([]);
    }
  };

  const handlePracticeSubject = (subject: string) => {
    setPracticeSubject(subject);
    setPracticeTopic("");
    fetchPracticeTopics(subject);
  };

  const togglePractice = () => {
    setShowPractice(!showPractice);
    setShowDashboard(false);
  };

  const generatePractice = async () => {
    if (!practiceSubject) return;
    setPracticeLoading(true);
    try {
      const res = await fetch("/api/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: practiceSubject,
          difficulty: practiceDifficulty,
          topic: practiceTopic,
        }),
      });
      const data = await res.json();
      if (data.question) {
        // Pre-fill the question into the main input by simulating a submit
        setShowPractice(false);
        setPayload({
          subject: practiceSubject,
          question: data.question,
          files: [],
          mode: "solve",
        });
        // Go straight to classify
        setStage("classifying");
        setError("");
        const classifyRes = await fetch("/api/classify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: data.question,
            subject: practiceSubject,
            files: [],
          }),
        });
        const classifyResult = await classifyRes.json();
        if (classifyResult.error) {
          setError(classifyResult.error);
          setStage("error");
        } else {
          setClassifyResult(classifyResult);
          setStage("approval");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Practice generation failed");
      setStage("error");
    }
    setPracticeLoading(false);
  };

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
      <div style={{ marginBottom: 44, animation: "fd 0.5s ease-out", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
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
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={togglePractice}
            style={{
              background: showPractice ? "var(--gold-dim)" : "var(--bg-card)",
              border: `1.5px solid ${showPractice ? "var(--gold)" : "var(--border)"}`,
              borderRadius: 8, padding: "8px 12px",
              color: showPractice ? "var(--bg-deep)" : "var(--text-dim)",
              fontFamily: "'DM Mono', monospace", fontSize: 10,
              cursor: "pointer", letterSpacing: 1,
              textTransform: "uppercase" as const,
              transition: "all 0.2s",
            }}
          >
            {showPractice ? "✕" : "🎯 Practice"}
          </button>
          <button
            onClick={toggleDashboard}
            style={{
              background: showDashboard ? "var(--gold-dim)" : "var(--bg-card)",
              border: `1.5px solid ${showDashboard ? "var(--gold)" : "var(--border)"}`,
              borderRadius: 8, padding: "8px 12px",
              color: showDashboard ? "var(--bg-deep)" : "var(--text-dim)",
              fontFamily: "'DM Mono', monospace", fontSize: 10,
              cursor: "pointer", letterSpacing: 1,
              textTransform: "uppercase" as const,
              transition: "all 0.2s",
            }}
          >
            {showDashboard ? "✕" : "📊 Learnings"}
          </button>
        </div>
      </div>

      {/* Practice Panel */}
      {showPractice && (
        <div style={{ animation: "fd 0.4s ease-out", marginBottom: 32 }}>
          <div style={{
            background: "var(--bg-card)", border: "1.5px solid var(--gold-dim)",
            borderRadius: 12, padding: 22,
          }}>
            <div className="label">Generate Practice Question</div>

            {/* Subject picker */}
            <div style={{ fontSize: 10, color: "var(--text-dim)", letterSpacing: 1, textTransform: "uppercase" as const, marginBottom: 8 }}>Subject</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 16 }}>
              {[
                { id: "gmat", label: "GMAT" },
                { id: "cfa", label: "CFA" },
                { id: "finance", label: "Finance" },
                { id: "series7", label: "Series 7" },
                { id: "series24", label: "Series 24" },
                { id: "statistics", label: "Stats" },
                { id: "accounting", label: "Acctg" },
                { id: "economics", label: "Econ" },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => handlePracticeSubject(s.id)}
                  style={{
                    padding: "8px 4px", fontSize: 10,
                    background: practiceSubject === s.id ? "var(--bg-hover)" : "transparent",
                    border: `1px solid ${practiceSubject === s.id ? "var(--gold)" : "var(--border)"}`,
                    borderRadius: 6, cursor: "pointer",
                    color: practiceSubject === s.id ? "var(--gold)" : "var(--text-dim)",
                    fontFamily: "'DM Mono', monospace",
                    transition: "all 0.2s",
                  }}
                >{s.label}</button>
              ))}
            </div>

            {/* Difficulty */}
            <div style={{ fontSize: 10, color: "var(--text-dim)", letterSpacing: 1, textTransform: "uppercase" as const, marginBottom: 8 }}>Difficulty</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {["easy", "medium", "hard"].map((d) => (
                <button
                  key={d}
                  onClick={() => setPracticeDifficulty(d)}
                  style={{
                    flex: 1, padding: "8px", fontSize: 11,
                    background: practiceDifficulty === d ? "var(--bg-hover)" : "transparent",
                    border: `1px solid ${practiceDifficulty === d ? "var(--gold)" : "var(--border)"}`,
                    borderRadius: 6, cursor: "pointer",
                    color: practiceDifficulty === d ? "var(--gold)" : "var(--text-dim)",
                    fontFamily: "'DM Mono', monospace",
                    textTransform: "capitalize" as const,
                    transition: "all 0.2s",
                  }}
                >{d}</button>
              ))}
            </div>

            {/* Topic selector */}
            {practiceTopics.length > 0 && (
              <>
                <div style={{ fontSize: 10, color: "var(--text-dim)", letterSpacing: 1, textTransform: "uppercase" as const, marginBottom: 8 }}>Topic (optional)</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                  <button
                    onClick={() => setPracticeTopic("")}
                    style={{
                      padding: "5px 10px", fontSize: 10,
                      background: !practiceTopic ? "var(--bg-hover)" : "transparent",
                      border: `1px solid ${!practiceTopic ? "var(--gold)" : "var(--border)"}`,
                      borderRadius: 20, cursor: "pointer",
                      color: !practiceTopic ? "var(--gold)" : "var(--text-dim)",
                      fontFamily: "'DM Mono', monospace",
                      transition: "all 0.2s",
                    }}
                  >Random</button>
                  {practiceTopics.map((t) => (
                    <button
                      key={t}
                      onClick={() => setPracticeTopic(t)}
                      style={{
                        padding: "5px 10px", fontSize: 10,
                        background: practiceTopic === t ? "var(--bg-hover)" : "transparent",
                        border: `1px solid ${practiceTopic === t ? "var(--gold)" : "var(--border)"}`,
                        borderRadius: 20, cursor: "pointer",
                        color: practiceTopic === t ? "var(--gold)" : "var(--text-dim)",
                        fontFamily: "'DM Mono', monospace",
                        transition: "all 0.2s",
                      }}
                    >{t}</button>
                  ))}
                </div>
              </>
            )}

            {/* Generate button */}
            <button
              onClick={generatePractice}
              disabled={!practiceSubject || practiceLoading}
              className="btn-primary"
              style={{
                width: "100%", opacity: practiceSubject && !practiceLoading ? 1 : 0.3,
              }}
            >
              {practiceLoading ? "Generating..." : "Generate Question →"}
            </button>
          </div>
        </div>
      )}

      {/* Dashboard Panel */}
      {showDashboard && (
        <div style={{ animation: "fd 0.4s ease-out", marginBottom: 32 }}>
          {dashboardLoading ? (
            <div style={{
              background: "var(--bg-card)", border: "1.5px solid var(--border)",
              borderRadius: 12, padding: 22, textAlign: "center",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontSize: 12, color: "var(--gold-dim)" }}>
                <div className="spinner" />
                Loading learnings...
              </div>
            </div>
          ) : !dashboardData?.stats ? (
            <div style={{
              background: "var(--bg-card)", border: "1.5px solid var(--border)",
              borderRadius: 12, padding: 22, textAlign: "center",
            }}>
              <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
                No data yet. Submit some questions and feedback to see learnings.
              </div>
            </div>
          ) : (
            <>
              {/* Stats Overview */}
              <div style={{
                background: "var(--bg-card)", border: "1.5px solid var(--border)",
                borderRadius: 12, padding: 22, marginBottom: 12,
              }}>
                <div className="label">Performance Overview</div>
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 16 }}>
                  <div>
                    <div className="stat-label">Total Questions</div>
                    <div className="stat-value" style={{ fontSize: 22 }}>{dashboardData.stats.total}</div>
                  </div>
                  <div>
                    <div className="stat-label">Accuracy</div>
                    <div className="stat-value" style={{
                      fontSize: 22,
                      color: dashboardData.stats.accuracyRate >= 80 ? "#22c55e"
                        : dashboardData.stats.accuracyRate >= 60 ? "#f59e0b" : "var(--danger)",
                    }}>{dashboardData.stats.accuracyRate}%</div>
                  </div>
                  <div>
                    <div className="stat-label">Correct</div>
                    <div className="stat-value" style={{ color: "#22c55e" }}>{dashboardData.stats.correct}</div>
                  </div>
                  <div>
                    <div className="stat-label">Errors</div>
                    <div className="stat-value" style={{ color: "var(--danger)" }}>{dashboardData.stats.incorrect}</div>
                  </div>
                </div>

                {/* Mistake Types */}
                {Object.keys(dashboardData.stats.mistakeTypes).length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div className="stat-label" style={{ marginBottom: 8 }}>Error Types</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {Object.entries(dashboardData.stats.mistakeTypes)
                        .sort(([, a], [, b]) => b - a)
                        .map(([type, count]) => (
                          <div key={type} style={{
                            background: "var(--bg-deep)", borderRadius: 6,
                            padding: "6px 10px", fontSize: 11,
                            color: "var(--text)",
                          }}>
                            <span style={{ color: "var(--danger)", fontWeight: 600 }}>{count}</span>
                            {" "}{type.replace(/_/g, " ")}
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Topic Accuracy */}
                {dashboardData.stats.topicAccuracy.length > 0 && (
                  <div>
                    <div className="stat-label" style={{ marginBottom: 8 }}>Accuracy by Topic</div>
                    {dashboardData.stats.topicAccuracy.slice(0, 8).map((t) => (
                      <div key={t.topic} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "6px 0", borderBottom: "1px solid var(--border)",
                        fontSize: 12,
                      }}>
                        <span style={{ color: "var(--text)" }}>{t.topic}</span>
                        <span style={{
                          color: t.accuracy >= 80 ? "#22c55e" : t.accuracy >= 60 ? "#f59e0b" : "var(--danger)",
                          fontWeight: 600, fontFamily: "'DM Mono', monospace",
                        }}>
                          {t.accuracy}% ({t.correct}/{t.total})
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Mistakes */}
              {dashboardData.learnings.length > 0 && (
                <div style={{
                  background: "var(--bg-card)", border: "1.5px solid var(--border)",
                  borderRadius: 12, padding: 22, marginBottom: 12,
                }}>
                  <div className="label">Recent Mistakes & Lessons</div>
                  {dashboardData.learnings.slice(0, 5).map((l, i) => (
                    <div key={i} style={{
                      borderBottom: i < 4 ? "1px solid var(--border)" : "none",
                      padding: "10px 0",
                    }}>
                      <div style={{ fontSize: 12, color: "var(--text)", marginBottom: 4 }}>
                        {l.question.slice(0, 100)}{l.question.length > 100 ? "..." : ""}
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        {l.mistake_type && (
                          <span style={{
                            fontSize: 10, background: "rgba(239,68,68,0.15)",
                            color: "var(--danger)", padding: "2px 6px",
                            borderRadius: 4,
                          }}>
                            {l.mistake_type.replace(/_/g, " ")}
                          </span>
                        )}
                        {l.lesson && (
                          <span style={{ fontSize: 11, color: "var(--gold-dim)", fontStyle: "italic" }}>
                            {l.lesson.slice(0, 80)}{l.lesson.length > 80 ? "..." : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Session History */}
              {dashboardData.history.length > 0 && (
                <div style={{
                  background: "var(--bg-card)", border: "1.5px solid var(--border)",
                  borderRadius: 12, padding: 22,
                }}>
                  <div className="label">Session History</div>
                  {dashboardData.history.slice(0, 7).map((s, i) => (
                    <div key={i} style={{
                      borderBottom: i < 6 ? "1px solid var(--border)" : "none",
                      padding: "10px 0",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: "var(--text-bright)", fontWeight: 500 }}>
                          {s.date}
                        </span>
                        <span style={{
                          fontSize: 12, fontFamily: "'DM Mono', monospace",
                          color: (s.correct / s.total) >= 0.8 ? "#22c55e" : (s.correct / s.total) >= 0.6 ? "#f59e0b" : "var(--danger)",
                        }}>
                          {s.correct}/{s.total} correct
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                        {s.questions.slice(0, 3).map((q, j) => (
                          <div key={j} style={{ marginTop: 2 }}>› {q}</div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Export button */}
              <button
                onClick={() => window.open("/api/export", "_blank")}
                className="btn-primary"
                style={{ width: "100%", marginTop: 4 }}
              >
                📄 Export Study Notes
              </button>
            </>
          )}
        </div>
      )}

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