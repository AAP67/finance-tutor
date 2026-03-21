import { NextRequest, NextResponse } from "next/server";
import { callClaude } from "../../../lib/claude";

const CLASSIFY_PROMPT = `You are a finance question classifier. Given a question, respond with ONLY a JSON object (no markdown, no backticks):
{"difficulty": "easy|medium|hard", "subject": "brief subject tag", "reasoning": "one sentence why"}

Classification rules:
- easy: Single concept, direct calculation, basic definitions (e.g., simple interest, basic ratios, single TVM calc)
- medium: Multi-step calculations, moderate conceptual depth (e.g., bond pricing, multi-period TVM, WACC, basic derivatives)
- hard: Multi-concept integration, complex modeling, edge cases (e.g., LBO modeling, options strategies, complex portfolio theory, multi-step CFA vignettes)`;

const MODELS = {
  easy: { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5", inputPer1k: 0.001, outputPer1k: 0.005 },
  medium: { id: "claude-sonnet-4-20250514", label: "Sonnet 4", inputPer1k: 0.003, outputPer1k: 0.015 },
  hard: { id: "claude-sonnet-4-20250514", label: "Sonnet 4", inputPer1k: 0.003, outputPer1k: 0.015 },
};

const OUTPUT_ESTIMATES = {
  easy: 600,
  medium: 1200,
  hard: 2000,
};

export async function POST(req: NextRequest) {
  try {
    const { question, subject, files } = await req.json();

    if (!question && !subject && (!files || files.length === 0)) {
      return NextResponse.json({ error: "No question provided" }, { status: 400 });
    }

    // Call Haiku to classify
    const result = await callClaude({
      model: "claude-haiku-4-5-20251001",
      system: CLASSIFY_PROMPT,
      userMessage: question || "Classify the problem shown in the attached file.",
      files: files || [],
      maxTokens: 200,
    });

    // Parse classification
    const cleaned = result.text.replace(/```json|```/g, "").trim();
    const classification = JSON.parse(cleaned);
    const difficulty = classification.difficulty as "easy" | "medium" | "hard";

    // Calculate cost estimate
    const model = MODELS[difficulty] || MODELS.medium;
    const estimatedInputTokens = Math.ceil(question.length / 3.5) + 800; // question + system prompt
    const estimatedOutputTokens = OUTPUT_ESTIMATES[difficulty] || 1200;
    const estimatedCost =
      (estimatedInputTokens / 1000) * model.inputPer1k +
      (estimatedOutputTokens / 1000) * model.outputPer1k;

    // Actual cost of this classification call
    const classifyCost =
      (result.inputTokens / 1000) * 0.001 +
      (result.outputTokens / 1000) * 0.005;

    return NextResponse.json({
      classification,
      model: model,
      estimatedInputTokens,
      estimatedOutputTokens,
      estimatedCost: Number(estimatedCost.toFixed(6)),
      classifyCost: Number(classifyCost.toFixed(6)),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Classification failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}