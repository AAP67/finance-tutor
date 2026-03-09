import { NextRequest, NextResponse } from "next/server";
import { callClaude } from "../../../lib/claude";
import { supabase } from "../../../lib/supabase";

const BASE_PROMPT = (difficulty: string, subject: string) =>
  `You are an expert finance tutor. Solve the following question step-by-step.

Subject area: ${subject}
Difficulty level: ${difficulty}

Rules:
- Start with a brief "## Approach" section (1-2 sentences explaining your strategy)
- Show each calculation step clearly
- NEVER use LaTeX, $$, \\frac, \\times, \\cdot, or any LaTeX notation
- Write math in plain text: use x for multiply, / for divide, parentheses for grouping
- Example: C(5,3) = 5! / (3! x 2!) = 10
- Use $ for dollar amounts, % for percentages
- Bold key answers using **answer**
- If there are multiple choice options, state which is correct and why others are wrong
- End with a "## Key Takeaway" the student should remember
- Match explanation depth to difficulty: simple for easy, thorough for hard
- Be precise with numbers. Double-check your arithmetic.`;

const MODELS: Record<string, string> = {
  easy: "claude-haiku-4-5-20251001",
  medium: "claude-sonnet-4-20250514",
  hard: "claude-sonnet-4-20250514",
};

async function fetchRelevantLearnings(topic: string, subject: string) {
  try {
    // First try exact topic match
    const { data: topicData } = await supabase
      .from("learnings")
      .select("question, mistake_type, lesson")
      .eq("was_correct", false)
      .not("lesson", "is", null)
      .eq("topic", topic)
      .order("created_at", { ascending: false })
      .limit(5);

    if (topicData && topicData.length > 0) return topicData;

    // Fallback to same subject area
    const { data: subjectData } = await supabase
      .from("learnings")
      .select("question, mistake_type, lesson")
      .eq("was_correct", false)
      .not("lesson", "is", null)
      .eq("subject", subject)
      .order("created_at", { ascending: false })
      .limit(5);

    return subjectData || [];
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const { question, difficulty, subject, topic } = await req.json();

    if (!question) {
      return NextResponse.json({ error: "No question provided" }, { status: 400 });
    }

    const diff = difficulty || "medium";
    const sub = subject || "finance";
    const model = MODELS[diff] || MODELS.medium;

    // Fetch past mistakes for this topic
    const learnings = await fetchRelevantLearnings(topic || sub, sub);

    // Build system prompt with learnings
    let systemPrompt = BASE_PROMPT(diff, sub);

    if (learnings.length > 0) {
      systemPrompt += "\n\n## Past Mistakes to Avoid\nYou have made errors on similar questions before. Be extra careful about:\n";
      learnings.forEach((l, i) => {
        systemPrompt += "\n" + (i + 1) + ". ";
        if (l.mistake_type) systemPrompt += "[" + l.mistake_type + "] ";
        systemPrompt += l.lesson;
      });
    }

    const result = await callClaude({
      model,
      system: systemPrompt,
      userMessage: question,
      maxTokens: diff === "easy" ? 1500 : diff === "medium" ? 3000 : 4000,
    });

    const pricing: Record<string, { input: number; output: number }> = {
      "claude-haiku-4-5-20251001": { input: 0.001, output: 0.005 },
      "claude-sonnet-4-20250514": { input: 0.003, output: 0.015 },
    };
    const p = pricing[model] || pricing["claude-sonnet-4-20250514"];
    const actualCost =
      (result.inputTokens / 1000) * p.input +
      (result.outputTokens / 1000) * p.output;

    return NextResponse.json({
      solution: result.text,
      model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      actualCost: Number(actualCost.toFixed(6)),
      learningsUsed: learnings.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Solve failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}