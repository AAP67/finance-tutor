# Finance Tutor

**Self-correcting AI tutor that learns from its mistakes — classifies questions by difficulty, routes to the right model, and improves over time via a feedback loop stored in Supabase.**

Submit a finance question → Haiku classifies difficulty → the appropriate Claude model solves it step-by-step → you can submit the textbook answer → the system compares, logs its errors, and injects past mistakes into future prompts.

![Demo Screenshot](assets/demo-screenshot_finance_tutor.png)
<!-- Replace with actual screenshot -->

**[Try the Live Demo →](your-vercel-url)**

---

## How It Works

```
Question → Classify (Haiku) → Route by difficulty → Solve (Haiku or Sonnet)
                                                          ↓
                                              User submits correct answer
                                                          ↓
                                              Compare (Haiku) → Log to Supabase
                                                          ↓
                                              Past mistakes injected into future solves
```

The self-correcting loop is the core idea: when Claude gets something wrong, the mistake type and lesson are stored in Supabase. On future questions in the same topic, those learnings are pulled into the system prompt — so the tutor avoids repeating the same errors.

## Architecture Decisions

- **Difficulty-based model routing** — Haiku classifies the question first, then routes easy questions to Haiku (cheap/fast) and medium/hard to Sonnet (accurate). Cost per question ranges from ~$0.001 to ~$0.02.
- **Cost transparency** — every API call's actual token cost is tracked and displayed to the user, broken down by classify/solve/compare stages.
- **Structured output validation** — all LLM responses are parsed as JSON with error handling and retry logic.
- **Feedback as training data** — the compare step doesn't just check correctness; it categorizes the mistake type (arithmetic, wrong formula, conceptual, etc.) and extracts an actionable lesson.

**Stack:** Next.js · TypeScript · Claude API (Haiku + Sonnet) · Supabase · Vercel

## Project Structure

```
src/
├── app/
│   ├── page.tsx                 # Main UI (staged workflow)
│   └── api/
│       ├── classify/route.ts    # Difficulty classification → model selection
│       ├── solve/route.ts       # Solution generation with past-mistake injection
│       ├── compare/route.ts     # Answer validation + Supabase logging
│       └── learnings/route.ts   # Learnings retrieval
├── components/
│   └── InputStep.tsx            # Question input form
└── lib/
    ├── claude.ts                # Claude API wrapper
    └── supabase.ts              # Supabase client
```

## Quickstart

```bash
git clone https://github.com/your-repo/finance-tutor.git
cd finance-tutor
npm install
```

Create a `.env.local` file:

```
ANTHROPIC_API_KEY=your_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
```

```bash
npm run dev
```

### Supabase Setup

Create a `learnings` table with columns: `subject`, `difficulty`, `topic`, `question`, `claude_answer`, `student_answer`, `comparison`, `was_correct` (bool), `mistake_type`, `lesson`, `created_at`.

## Built By

**[Karan Rajpal](https://www.linkedin.com/in/krajpal/)** — UC Berkeley Haas MBA '25 · LLM Validation @ Handshake AI (OpenAI/Perplexity) · Former 5th hire at Borderless Capital
