import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

export async function GET(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({
        learnings: [],
        stats: null,
        history: [],
        message: "Supabase not configured",
      });
    }

    const { searchParams } = new URL(req.url);
    const view = searchParams.get("view") || "all";

    // Recent mistakes with lessons (original behavior)
    const { data: learnings } = await supabase
      .from("learnings")
      .select("question, mistake_type, lesson, subject, difficulty, topic")
      .eq("was_correct", false)
      .not("lesson", "is", null)
      .order("created_at", { ascending: false })
      .limit(10);

    // Aggregate stats
    const { data: allRows } = await supabase
      .from("learnings")
      .select("was_correct, mistake_type, topic, subject, difficulty, created_at")
      .order("created_at", { ascending: false })
      .limit(500);

    let stats = null;
    if (allRows && allRows.length > 0) {
      const total = allRows.length;
      const correct = allRows.filter((r) => r.was_correct).length;
      const incorrect = total - correct;

      // Mistake type breakdown
      const mistakeTypes: Record<string, number> = {};
      allRows.forEach((r) => {
        if (!r.was_correct && r.mistake_type) {
          mistakeTypes[r.mistake_type] = (mistakeTypes[r.mistake_type] || 0) + 1;
        }
      });

      // Accuracy by topic
      const topicStats: Record<string, { total: number; correct: number }> = {};
      allRows.forEach((r) => {
        const t = r.topic || r.subject || "unknown";
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
        .sort((a, b) => b.total - a.total);

      stats = {
        total,
        correct,
        incorrect,
        accuracyRate: Math.round((correct / total) * 100),
        mistakeTypes,
        topicAccuracy,
      };
    }

    // Session history — group by date
    let history: { date: string; total: number; correct: number; questions: string[] }[] = [];
    if (view === "all" && allRows && allRows.length > 0) {
      const byDate: Record<string, { total: number; correct: number; questions: string[] }> = {};
      
      // Need full question text for history
      const { data: historyRows } = await supabase
        .from("learnings")
        .select("question, was_correct, topic, created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      if (historyRows) {
        historyRows.forEach((r) => {
          const date = r.created_at ? r.created_at.split("T")[0] : "unknown";
          if (!byDate[date]) byDate[date] = { total: 0, correct: 0, questions: [] };
          byDate[date].total++;
          if (r.was_correct) byDate[date].correct++;
          if (byDate[date].questions.length < 5) {
            byDate[date].questions.push(
              (r.question || "").slice(0, 80) + ((r.question || "").length > 80 ? "..." : "")
            );
          }
        });
      }

      history = Object.entries(byDate)
        .map(([date, s]) => ({ date, ...s }))
        .sort((a, b) => b.date.localeCompare(a.date));
    }

    return NextResponse.json({
      learnings: learnings || [],
      stats,
      history,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch learnings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}