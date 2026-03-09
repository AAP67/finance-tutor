import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("learnings")
      .select("question, mistake_type, lesson, subject, difficulty")
      .eq("was_correct", false)
      .not("lesson", "is", null)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ learnings: data || [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch learnings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}