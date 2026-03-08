interface ClaudeRequest {
  model: string;
  system: string;
  userMessage: string;
  maxTokens?: number;
}

interface ClaudeResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export async function callClaude({
  model,
  system,
  userMessage,
  maxTokens = 4000,
}: ClaudeRequest): Promise<ClaudeResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your_key_here") {
    throw new Error("ANTHROPIC_API_KEY not set");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  const data = await res.json();

  if (data.error) {
    throw new Error(data.error.message || "Claude API error");
  }

  return {
    text: data.content.map((b: { text?: string }) => b.text || "").join("\n"),
    inputTokens: data.usage?.input_tokens || 0,
    outputTokens: data.usage?.output_tokens || 0,
  };
}
