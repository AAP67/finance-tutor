import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

export async function GET() {
  try {
    if (!supabase) {
      return new NextResponse(
        generateHTML(null, [], []),
        { headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    // Fetch all data
    const { data: allRows } = await supabase
      .from("learnings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (!allRows || allRows.length === 0) {
      return new NextResponse(
        generateHTML(null, [], []),
        { headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    // Compute stats
    const total = allRows.length;
    const correct = allRows.filter((r) => r.was_correct).length;

    const mistakeTypes: Record<string, number> = {};
    const topicStats: Record<string, { total: number; correct: number }> = {};
    allRows.forEach((r) => {
      if (!r.was_correct && r.mistake_type) {
        mistakeTypes[r.mistake_type] = (mistakeTypes[r.mistake_type] || 0) + 1;
      }
      const t = r.topic || r.subject || "General";
      if (!topicStats[t]) topicStats[t] = { total: 0, correct: 0 };
      topicStats[t].total++;
      if (r.was_correct) topicStats[t].correct++;
    });

    const topicAccuracy = Object.entries(topicStats)
      .map(([topic, s]) => ({
        topic,
        total: s.total,
        correct: s.correct,
        accuracy: Math.round((s.correct / s.total) * 100),
      }))
      .sort((a, b) => a.accuracy - b.accuracy);

    const stats = {
      total,
      correct,
      incorrect: total - correct,
      accuracyRate: Math.round((correct / total) * 100),
      mistakeTypes,
      topicAccuracy,
    };

    // Get mistakes with lessons
    const mistakes = allRows
      .filter((r) => !r.was_correct && r.lesson)
      .slice(0, 15)
      .map((r) => ({
        question: (r.question || "").slice(0, 150),
        topic: r.topic || r.subject || "General",
        mistake_type: r.mistake_type || "unknown",
        lesson: r.lesson,
      }));

    // Session history
    const byDate: Record<string, { total: number; correct: number; topics: Set<string> }> = {};
    allRows.forEach((r) => {
      const date = r.created_at ? r.created_at.split("T")[0] : "unknown";
      if (!byDate[date]) byDate[date] = { total: 0, correct: 0, topics: new Set() };
      byDate[date].total++;
      if (r.was_correct) byDate[date].correct++;
      if (r.topic) byDate[date].topics.add(r.topic);
    });
    const sessions = Object.entries(byDate)
      .map(([date, s]) => ({ date, total: s.total, correct: s.correct, topics: Array.from(s.topics) }))
      .sort((a, b) => b.date.localeCompare(a.date));

    const html = generateHTML(stats, mistakes, sessions);

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Export failed";
    return new NextResponse(`<html><body><h1>Export Error</h1><p>${message}</p></body></html>`, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
      status: 500,
    });
  }
}

interface Stats {
  total: number;
  correct: number;
  incorrect: number;
  accuracyRate: number;
  mistakeTypes: Record<string, number>;
  topicAccuracy: { topic: string; total: number; correct: number; accuracy: number }[];
}

interface Mistake {
  question: string;
  topic: string;
  mistake_type: string;
  lesson: string;
}

interface Session {
  date: string;
  total: number;
  correct: number;
  topics: string[];
}

function generateHTML(
  stats: Stats | null,
  mistakes: Mistake[],
  sessions: Session[]
): string {
  const now = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  if (!stats) {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Study Notes</title>
<style>${CSS}</style></head>
<body><div class="container">
<h1>Finance Tutor — Study Notes</h1>
<p class="date">${now}</p>
<div class="card"><p class="dim">No data available. Submit questions and feedback to generate study notes.</p></div>
</div></body></html>`;
  }

  // Weak areas — topics with <80% accuracy
  const weakAreas = stats.topicAccuracy.filter((t) => t.accuracy < 80 && t.total >= 1);
  const strongAreas = stats.topicAccuracy.filter((t) => t.accuracy >= 80 && t.total >= 1);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Finance Tutor — Study Notes | ${now}</title>
<style>${CSS}</style>
</head>
<body>
<div class="container">

<div class="header">
  <h1>Finance <span class="gold">Tutor</span> — Study Notes</h1>
  <p class="date">Generated ${now} · ${stats.total} questions analyzed</p>
</div>

<!-- Performance Summary -->
<div class="card">
  <h2>Performance Summary</h2>
  <div class="stats-row">
    <div class="stat">
      <div class="stat-num">${stats.total}</div>
      <div class="stat-label">Questions</div>
    </div>
    <div class="stat">
      <div class="stat-num ${stats.accuracyRate >= 80 ? 'green' : stats.accuracyRate >= 60 ? 'amber' : 'red'}">${stats.accuracyRate}%</div>
      <div class="stat-label">Accuracy</div>
    </div>
    <div class="stat">
      <div class="stat-num green">${stats.correct}</div>
      <div class="stat-label">Correct</div>
    </div>
    <div class="stat">
      <div class="stat-num red">${stats.incorrect}</div>
      <div class="stat-label">Errors</div>
    </div>
  </div>
</div>

<!-- Areas Needing Work -->
${weakAreas.length > 0 ? `
<div class="card">
  <h2>Areas Needing Work</h2>
  <p class="dim">Topics with accuracy below 80% — prioritize these in your study plan.</p>
  <table>
    <tr><th>Topic</th><th>Accuracy</th><th>Score</th></tr>
    ${weakAreas.map((t) => `
    <tr>
      <td>${esc(t.topic)}</td>
      <td class="${t.accuracy < 60 ? 'red' : 'amber'}">${t.accuracy}%</td>
      <td>${t.correct}/${t.total}</td>
    </tr>`).join("")}
  </table>
</div>
` : ""}

<!-- Strong Areas -->
${strongAreas.length > 0 ? `
<div class="card">
  <h2>Strong Areas</h2>
  <table>
    <tr><th>Topic</th><th>Accuracy</th><th>Score</th></tr>
    ${strongAreas.map((t) => `
    <tr>
      <td>${esc(t.topic)}</td>
      <td class="green">${t.accuracy}%</td>
      <td>${t.correct}/${t.total}</td>
    </tr>`).join("")}
  </table>
</div>
` : ""}

<!-- Common Mistake Types -->
${Object.keys(stats.mistakeTypes).length > 0 ? `
<div class="card">
  <h2>Common Mistake Types</h2>
  <div class="tags">
    ${Object.entries(stats.mistakeTypes).sort(([,a],[,b]) => b - a).map(([type, count]) =>
      `<span class="tag"><strong>${count}x</strong> ${esc(type.replace(/_/g, " "))}</span>`
    ).join("")}
  </div>
</div>
` : ""}

<!-- Key Lessons Learned -->
${mistakes.length > 0 ? `
<div class="card">
  <h2>Key Lessons Learned</h2>
  <p class="dim">Mistakes the tutor made and lessons extracted — review these before your next session.</p>
  ${mistakes.map((m, i) => `
  <div class="lesson">
    <div class="lesson-header">
      <span class="lesson-num">${i + 1}</span>
      <span class="tag-sm">${esc(m.topic)}</span>
      <span class="tag-sm red-bg">${esc(m.mistake_type.replace(/_/g, " "))}</span>
    </div>
    <div class="lesson-q">${esc(m.question)}${m.question.length >= 150 ? "..." : ""}</div>
    <div class="lesson-text">${esc(m.lesson)}</div>
  </div>`).join("")}
</div>
` : ""}

<!-- Session History -->
${sessions.length > 0 ? `
<div class="card">
  <h2>Session History</h2>
  <table>
    <tr><th>Date</th><th>Score</th><th>Topics Covered</th></tr>
    ${sessions.slice(0, 10).map((s) => `
    <tr>
      <td>${esc(s.date)}</td>
      <td class="${(s.correct/s.total) >= 0.8 ? 'green' : (s.correct/s.total) >= 0.6 ? 'amber' : 'red'}">${s.correct}/${s.total}</td>
      <td>${s.topics.map((t) => esc(t)).join(", ") || "—"}</td>
    </tr>`).join("")}
  </table>
</div>
` : ""}

<!-- Study Recommendations -->
<div class="card">
  <h2>Recommended Study Plan</h2>
  <ol>
    ${weakAreas.length > 0
      ? weakAreas.slice(0, 3).map((t) =>
        `<li><strong>Practice ${esc(t.topic)}</strong> — currently at ${t.accuracy}% accuracy (${t.correct}/${t.total}). Focus on this area before moving on.</li>`
      ).join("")
      : `<li>All topics at 80%+ accuracy — keep practicing to maintain your edge.</li>`}
    ${Object.keys(stats.mistakeTypes).length > 0
      ? `<li><strong>Watch for ${esc(Object.entries(stats.mistakeTypes).sort(([,a],[,b]) => b - a)[0][0].replace(/_/g, " "))} errors</strong> — this is your most common mistake type. Double-check these in your work.</li>`
      : ""}
    <li>Continue submitting feedback after each question to build the learning database.</li>
  </ol>
</div>

<div class="footer">
  <p>Finance Tutor · Study Notes · Karan Rajpal</p>
  <p class="dim">Print this page (Ctrl/Cmd + P) to save as PDF</p>
</div>

</div>
</body>
</html>`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Georgia', 'Times New Roman', serif;
    background: #0a0a14;
    color: #d4d4d4;
    line-height: 1.6;
  }
  .container { max-width: 800px; margin: 0 auto; padding: 40px 24px; }
  .header { margin-bottom: 32px; border-bottom: 1px solid #2a2a3a; padding-bottom: 20px; }
  h1 { font-size: 28px; color: #f0f0f0; font-weight: 700; margin-bottom: 4px; }
  h2 { font-size: 16px; color: #e2c066; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 14px; font-family: monospace; }
  .gold { color: #e2c066; }
  .date { font-size: 13px; color: #666; font-family: monospace; }
  .dim { font-size: 13px; color: #666; margin-bottom: 12px; }
  .card { background: #12121e; border: 1px solid #2a2a3a; border-radius: 10px; padding: 22px; margin-bottom: 16px; }
  .stats-row { display: flex; gap: 32px; flex-wrap: wrap; }
  .stat { text-align: center; }
  .stat-num { font-size: 28px; font-weight: 700; color: #f0f0f0; font-family: monospace; }
  .stat-label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; }
  .green { color: #22c55e; }
  .amber { color: #f59e0b; }
  .red { color: #ef4444; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 8px 12px; border-bottom: 1px solid #2a2a3a; color: #888; font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
  td { padding: 8px 12px; border-bottom: 1px solid #1a1a2a; }
  .tags { display: flex; gap: 8px; flex-wrap: wrap; }
  .tag { background: #1a1a2e; border-radius: 6px; padding: 6px 12px; font-size: 13px; color: #d4d4d4; }
  .tag strong { color: #ef4444; margin-right: 4px; }
  .tag-sm { font-size: 10px; background: #1a1a2e; border-radius: 4px; padding: 2px 8px; color: #999; }
  .red-bg { background: rgba(239,68,68,0.15); color: #ef4444; }
  .lesson { border-bottom: 1px solid #1a1a2a; padding: 12px 0; }
  .lesson:last-child { border-bottom: none; }
  .lesson-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .lesson-num { width: 22px; height: 22px; background: #e2c066; color: #0a0a14; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; }
  .lesson-q { font-size: 12px; color: #888; margin-bottom: 4px; }
  .lesson-text { font-size: 13px; color: #d4d4d4; font-style: italic; }
  ol { padding-left: 20px; }
  li { margin-bottom: 10px; font-size: 14px; }
  li strong { color: #e2c066; }
  .footer { text-align: center; margin-top: 32px; padding-top: 20px; border-top: 1px solid #2a2a3a; }
  .footer p { font-size: 12px; color: #666; font-family: monospace; }
  @media print {
    body { background: white; color: #222; }
    .card { border-color: #ddd; background: #fafafa; }
    .gold, h2, li strong, .lesson-num { color: #b8860b; }
    .footer .dim { display: none; }
    td, th { border-color: #ddd; }
    .tag, .tag-sm { background: #f0f0f0; }
  }
`;