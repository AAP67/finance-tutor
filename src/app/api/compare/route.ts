import { NextRequest, NextResponse } from "next/server";
import { callClaude } from "../../../lib/claude";
import { supabase } from "../../../lib/supabase";

const COMPARE_PROMPT = [
  "You are a finance answer validator. You will receive:",
  "1. A question",
  "2. Claude's solution", 
  "3. The student's answer",
  "",
  "Compare them and respond with ONLY a JSON object (no markdown, no backticks).",
  "The JSON must have these fields:",
  '- "match": boolean (do the answers agree?)',
  '- "claude_correct": boolean',
  '- "student_correct": boolean',
  '- "explanation": string (brief comparison explanation)',
  '- "mistake_type": string (one of: none, arithmetic_error, wrong_formula, conceptual_error, incomplete, misread_question)',
  '- "lesson": string or null (actionable advice for similar problems in future, null if no mistakes)',
  "",
  "Rules:",
  "- Be precise. Recalculate if needed.",
  "- If both answers agree, mark both as correct unless both are wrong.",
  "- If they disagree, determine who is right by solving independently.",
  "- mistake_type describes Claude's mistake if Claude was wrong, or none if Claude was correct.",
].join("\n");

export async function POST(req: NextRequest) {
  try {
    const { question, claudeAnswer, studentAnswer, subject, difficulty, topic } = await req.json();

    if (!studentAnswer?.trim()) {
      return NextResponse.json({ error: "No student answer provided" }, { status: 400 });
    }

    const userMessage = "## Question\n" + question + "\n\n## Claude's Solution\n" + claudeAnswer + "\n\n## Student's Answer\n" + studentAnswer;

    const result = await callClaude({
      model: "claude-haiku-4-5-20251001",
      system: COMPARE_PROMPT,
      userMessage,
      maxTokens: 500,
    });

    const cleaned = result.text.replace(/```json|```/g, "").trim();
    const comparison = JSON.parse(cleaned);

    const compareCost =
      (result.inputTokens / 1000) * 0.001 +
      (result.outputTokens / 1000) * 0.005;

    const { error: dbError } = await supabase.from("learnings").insert({
      subject,
      difficulty,
      topic: topic || null,
      question,
      claude_answer: claudeAnswer,
      student_answer: studentAnswer,
      comparison: comparison.explanation,
      was_correct: comparison.claude_correct,
      mistake_type: comparison.mistake_type === "none" ? null : comparison.mistake_type,
      lesson: comparison.lesson,
    });

    if (dbError) {
      console.error("Supabase insert error:", dbError);
    }

    return NextResponse.json({
      comparison,
      compareCost: Number(compareCost.toFixed(6)),
      stored: !dbError,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Comparison failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}