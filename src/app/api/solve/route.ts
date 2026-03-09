import { NextRequest, NextResponse } from "next/server";
import { callClaude } from "../../../lib/claude";

const SOLVE_PROMPT = (difficulty: string, subject: string) =>
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

export async function POST(req: NextRequest) {
  try {
    const { question, difficulty, subject } = await req.json();

    if (!question) {
      return NextResponse.json({ error: "No question provided" }, { status: 400 });
    }

    const diff = difficulty || "medium";
    const sub = subject || "finance";
    const model = MODELS[diff] || MODELS.medium;

    const result = await callClaude({
      model,
      system: SOLVE_PROMPT(diff, sub),
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
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Solve failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
