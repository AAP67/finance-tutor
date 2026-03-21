interface FileData {
  base64: string;
  mediaType: string;
}

interface ClaudeRequest {
  model: string;
  system: string;
  userMessage: string;
  files?: FileData[];
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
  files,
  maxTokens = 4000,
}: ClaudeRequest): Promise<ClaudeResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your_key_here") {
    throw new Error("ANTHROPIC_API_KEY not set");
  }

  // Build content blocks — images first, then text
  type ContentBlock =
    | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
    | { type: "document"; source: { type: "base64"; media_type: string; data: string } }
    | { type: "text"; text: string };

  const content: ContentBlock[] = [];

  if (files && files.length > 0) {
    for (const file of files) {
      if (file.mediaType === "application/pdf") {
        content.push({
          type: "document",
          source: {
            type: "base64",
            media_type: file.mediaType,
            data: file.base64,
          },
        });
      } else {
        content.push({
          type: "image",
          source: {
            type: "base64",
            media_type: file.mediaType,
            data: file.base64,
          },
        });
      }
    }
  }

  // Always add the text message (even if empty, as context for the image)
  content.push({
    type: "text",
    text: userMessage || "Please analyze the attached file and solve the problem shown.",
  });

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
      messages: [{ role: "user", content }],
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

// Multi-turn conversation support
export interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ClaudeMultiTurnRequest {
  model: string;
  system: string;
  messages: Message[];
  maxTokens?: number;
}

export async function callClaudeMultiTurn({
  model,
  system,
  messages,
  maxTokens = 4000,
}: ClaudeMultiTurnRequest): Promise<ClaudeResponse> {
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
      messages,
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