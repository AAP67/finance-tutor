import { NextRequest, NextResponse } from "next/server";
import { callClaudeMultiTurn, Message } from "../../../lib/claude";
import { getTopicTemplate } from "../../../lib/topicTemplates";

const FOLLOWUP_SYSTEM = (subject: string, difficulty: string) =>
  `You are an expert finance tutor continuing a conversation with a student.

Subject area: ${subject}
Difficulty level: ${difficulty}

Rules:
- Answer the follow-up question in the context of the original problem
- If the student asks to explain a step differently, use a simpler approach or analogy
- If the student asks "what if" scenarios, recalculate with the new parameters
- NEVER use LaTeX, $$, \\frac, \\times, or any LaTeX notation
- Write math in plain text: use x for multiply, / for divide, parentheses for grouping
- Use $ for dollar amounts, % for percentages
- Bold key answers using **answer**
- Be concise — the student already has the full solution, they need clarification not repetition`;

const FOLLOWUP_GUIDE_SYSTEM = (subject: string, difficulty: string) =>
  `You are a Socratic finance tutor continuing a guided conversation with a student.

Subject area: ${subject}
Difficulty level: ${difficulty}

Rules:
- Evaluate the student's response — is their reasoning correct?
- If correct, praise briefly and guide them to the next step
- If incorrect, explain why gently WITHOUT giving the answer, then ask them to try again
- Give one small hint if they're stuck
- NEVER show the full calculation or final answer unless the student has worked through all steps
- NEVER use LaTeX, $$, \\frac, \\times, or any LaTeX notation
- If the student explicitly asks "just tell me the answer" or "solve it for me", then provide the full solution
- Keep responses to 3-5 sentences — stay focused and conversational`;

const MODELS: Record<string, string> = {
  easy: "claude-haiku-4-5-20251001",
  medium: "claude-sonnet-4-20250514",
  hard: "claude-sonnet-4-20250514",
};

export async function POST(req: NextRequest) {
  try {
    const { messages, difficulty, subject, mode, topic } = await req.json();

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "No messages provided" }, { status: 400 });
    }

    const diff = difficulty || "medium";
    const sub = subject || "finance";
    const tutorMode = mode || "solve";
    const model = MODELS[diff] || MODELS.medium;

    let systemPrompt = tutorMode === "guide"
      ? FOLLOWUP_GUIDE_SYSTEM(sub, diff)
      : FOLLOWUP_SYSTEM(sub, diff);

    // Inject topic-specific instructions
    const topicTemplate = getTopicTemplate(topic || "");
    if (topicTemplate) {
      systemPrompt += "\n\nTopic-specific rules:" + topicTemplate;
    }

    const result = await callClaudeMultiTurn({
      model,
      system: systemPrompt,
      messages: messages as Message[],
      maxTokens: diff === "easy" ? 1000 : 2000,
    });

    const pricing: Record<string, { input: number; output: number }> = {
      "claude-haiku-4-5-20251001": { input: 0.001, output: 0.005 },
      "claude-sonnet-4-20250514": { input: 0.003, output: 0.015 },
    };
    const p = pricing[model] || pricing["claude-sonnet-4-20250514"];
    const followupCost =
      (result.inputTokens / 1000) * p.input +
      (result.outputTokens / 1000) * p.output;

    return NextResponse.json({
      response: result.text,
      model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      followupCost: Number(followupCost.toFixed(6)),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Follow-up failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}