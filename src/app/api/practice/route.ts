import { NextRequest, NextResponse } from "next/server";
import { callClaude } from "../../../lib/claude";

const PRACTICE_PROMPT = (subject: string, difficulty: string, topic: string) =>
  `You are a ${subject} question writer creating practice problems for students.

Generate ONE original practice question.

Requirements:
- Subject: ${subject}
- Difficulty: ${difficulty}
- Topic focus: ${topic || "any topic within " + subject}
- The question must be solvable with a specific numerical or multiple-choice answer
- For medium/hard: make it multi-step
- For multiple choice: provide 4-5 answer options labeled A through E
- Do NOT include the solution or answer
- Do NOT include hints
- Just the question text and answer choices (if applicable)
- Make it realistic — similar to what appears on actual exams

Output the question text only, nothing else.`;

const TOPIC_SUGGESTIONS: Record<string, string[]> = {
  gmat: ["arithmetic", "algebra", "geometry", "probability", "data sufficiency", "percent", "rate problems", "number properties", "combinatorics"],
  cfa: ["time value of money", "bond pricing", "equity valuation", "portfolio theory", "derivatives", "financial reporting", "ethics", "fixed income", "alternative investments"],
  finance: ["present value", "NPV", "WACC", "capital budgeting", "ratio analysis", "working capital", "cost of capital", "dividend policy", "risk and return"],
  series7: ["equity securities", "debt securities", "options", "mutual funds", "margin accounts", "suitability", "municipal bonds", "tax rules", "retirement accounts"],
  series24: ["supervision", "registration", "compliance", "net capital", "customer accounts", "trading practices", "municipal rules", "communications"],
  statistics: ["descriptive statistics", "probability", "hypothesis testing", "regression", "confidence intervals", "distributions", "sampling", "ANOVA"],
  accounting: ["journal entries", "financial statements", "depreciation", "inventory", "revenue recognition", "accounts receivable", "cost accounting", "ratio analysis"],
  economics: ["supply and demand", "elasticity", "GDP", "monetary policy", "fiscal policy", "trade", "market structures", "inflation", "unemployment"],
};

export async function POST(req: NextRequest) {
  try {
    const { subject, difficulty, topic } = await req.json();

    if (!subject) {
      return NextResponse.json({ error: "No subject provided" }, { status: 400 });
    }

    const diff = difficulty || "medium";
    const sub = subject || "finance";

    const result = await callClaude({
      model: "claude-haiku-4-5-20251001",
      system: PRACTICE_PROMPT(sub, diff, topic || ""),
      userMessage: `Generate a ${diff} ${sub} practice question${topic ? ` about ${topic}` : ""}.`,
      maxTokens: 800,
    });

    const practiceCost =
      (result.inputTokens / 1000) * 0.001 +
      (result.outputTokens / 1000) * 0.005;

    return NextResponse.json({
      question: result.text,
      subject: sub,
      difficulty: diff,
      topic: topic || null,
      practiceCost: Number(practiceCost.toFixed(6)),
      topicSuggestions: TOPIC_SUGGESTIONS[sub] || TOPIC_SUGGESTIONS.finance,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Practice generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET returns topic suggestions for a subject
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const subject = searchParams.get("subject") || "finance";
  return NextResponse.json({
    topics: TOPIC_SUGGESTIONS[subject] || TOPIC_SUGGESTIONS.finance,
  });
}