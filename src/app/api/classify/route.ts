import { NextRequest, NextResponse } from "next/server";
import { callClaude } from "../../../lib/claude";

const CLASSIFY_PROMPT = `You are a question classifier for a multi-subject tutoring platform. Given a question and its subject area, respond with ONLY a JSON object (no markdown, no backticks):
{"difficulty": "easy|medium|hard", "subject": "brief topic tag", "reasoning": "one sentence why"}

The "subject" field should be a specific topic tag (e.g., "bond pricing", "data sufficiency", "margin call", "journal entry", "supply demand", "hypothesis testing"), NOT the broad subject area.

Classification rules:
- easy: Single concept, direct calculation, basic definitions, straightforward recall
- medium: Multi-step calculations, moderate conceptual depth, requires applying a formula or framework
- hard: Multi-concept integration, complex modeling, edge cases, multi-step reasoning

Subject-specific examples:
- GMAT: easy = arithmetic/algebra, medium = word problems/probability, hard = data sufficiency with tricky logic
- CFA: easy = basic TVM, medium = bond pricing/WACC, hard = derivatives strategies/portfolio construction
- Series 7: easy = product definitions, medium = suitability/margin calcs, hard = complex options/regulatory scenarios
- Series 24: easy = registration rules, medium = supervision requirements, hard = net capital/compliance scenarios
- Statistics: easy = mean/median/mode, medium = probability distributions, hard = regression/hypothesis testing
- Accounting: easy = basic journal entries, medium = financial statement analysis, hard = revenue recognition/consolidation
- Economics: easy = supply/demand basics, medium = elasticity/GDP, hard = monetary/fiscal policy interactions`;

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
    const subjectContext = subject ? `[Subject area: ${subject}]\n\n` : "";
    const result = await callClaude({
      model: "claude-haiku-4-5-20251001",
      system: CLASSIFY_PROMPT,
      userMessage: subjectContext + (question || "Classify the problem shown in the attached file."),
      files: files || [],
      maxTokens: 400,
    });

    // Parse classification — robust JSON extraction with retry
    let classification;
    let classifyTokens = { input: result.inputTokens, output: result.outputTokens };
    try {
      const cleaned = result.text.replace(/```json|```/g, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      classification = JSON.parse(jsonMatch[0]);
    } catch {
      // Retry once if JSON parsing fails
      const retry = await callClaude({
        model: "claude-haiku-4-5-20251001",
        system: CLASSIFY_PROMPT,
        userMessage: subjectContext + (question || "Classify the problem shown in the attached file."),
        files: files || [],
        maxTokens: 400,
      });
      classifyTokens = { input: classifyTokens.input + retry.inputTokens, output: classifyTokens.output + retry.outputTokens };
      const retryClean = retry.text.replace(/```json|```/g, "").trim();
      const retryMatch = retryClean.match(/\{[\s\S]*\}/);
      if (!retryMatch) throw new Error("Classification failed after retry");
      classification = JSON.parse(retryMatch[0]);
    }
    const difficulty = classification.difficulty as "easy" | "medium" | "hard";

    // Calculate cost estimate
    const model = MODELS[difficulty] || MODELS.medium;
    const estimatedInputTokens = Math.ceil((question || "").length / 3.5) + 800;
    const estimatedOutputTokens = OUTPUT_ESTIMATES[difficulty] || 1200;
    const estimatedCost =
      (estimatedInputTokens / 1000) * model.inputPer1k +
      (estimatedOutputTokens / 1000) * model.outputPer1k;

    // Actual cost of this classification call
    const classifyCost =
      (classifyTokens.input / 1000) * 0.001 +
      (classifyTokens.output / 1000) * 0.005;

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