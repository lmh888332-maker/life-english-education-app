type QwenScene = "hotel" | "airport" | "interview" | "crisis" | "roommate";

type ClientMessage = {
  role: "assistant" | "user";
  text: string;
};

type QwenRequest = {
  scene?: QwenScene;
  level?: string;
  coachMode?: boolean;
  messages?: ClientMessage[];
};

const scenarios: Record<QwenScene, { role: string; situation: string; goal: string }> = {
  hotel: {
    role: "Nora, the hotel manager",
    situation: "A guest has arrived, but the hotel cannot initially find the reservation and the original room may be unavailable.",
    goal: "Help the learner verify the booking and negotiate an equivalent room or fair compensation.",
  },
  airport: {
    role: "Alex, an airline service agent",
    situation: "The learner's flight is overbooked and they need a realistic alternative itinerary.",
    goal: "Elicit non-negotiable travel constraints and negotiate a workable rerouting solution.",
  },
  interview: {
    role: "Jordan, a product leader conducting an interview",
    situation: "The learner is answering behavioral interview questions under continuous follow-up.",
    goal: "Push the learner toward specific evidence, decisions, risks, results and reflection.",
  },
  crisis: {
    role: "Reese, a skeptical journalist",
    situation: "A company is responding to a possible data incident before the investigation is complete.",
    goal: "Make the learner separate verified facts, unknowns and immediate next actions without overpromising.",
  },
  roommate: {
    role: "Maya, the learner's new roommate",
    situation: "Two roommates are discussing shared space, household routines, expenses, noise or visitor rules after watching a short English drama.",
    goal: "Continue the exact issue raised by the learner, negotiate one practical agreement, and match the vocabulary and reasoning complexity to the learner's level.",
  },
};

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function readContent(payload: unknown) {
  const data = payload as { choices?: Array<{ message?: { content?: unknown } }> };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part && typeof part.text === "string") return part.text;
        return "";
      })
      .join("")
      .trim();
  }
  return "";
}

function parseModelReply(content: string, coachMode: boolean) {
  const cleaned = content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as { reply?: unknown; translation?: unknown; feedback?: unknown };
    const reply = typeof parsed.reply === "string" ? parsed.reply.trim() : "";
    if (!reply) throw new Error("Missing reply");
    return {
      reply,
      translation: coachMode && typeof parsed.translation === "string" ? parsed.translation.trim() : "",
      feedback: coachMode && typeof parsed.feedback === "string" ? parsed.feedback.trim() : "",
    };
  } catch {
    return { reply: cleaned, translation: "", feedback: "" };
  }
}

export async function GET() {
  return json({
    configured: Boolean(process.env.DASHSCOPE_API_KEY),
    model: process.env.QWEN_MODEL || "qwen-plus-latest",
  });
}

export async function POST(request: Request) {
  const apiKey = process.env.DASHSCOPE_API_KEY?.trim();
  if (!apiKey) {
    return json({
      code: "MISSING_API_KEY",
      message: "The server-side DashScope API key has not been configured.",
    }, 503);
  }

  let body: QwenRequest;
  try {
    body = await request.json() as QwenRequest;
  } catch {
    return json({ code: "INVALID_REQUEST", message: "Request body must be valid JSON." }, 400);
  }

  const scene = body.scene && body.scene in scenarios ? body.scene : null;
  const messages = Array.isArray(body.messages)
    ? body.messages
        .filter((message): message is ClientMessage =>
          Boolean(message)
          && (message.role === "assistant" || message.role === "user")
          && typeof message.text === "string"
          && message.text.trim().length > 0)
        .slice(-12)
    : [];

  if (!scene || messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return json({ code: "INVALID_REQUEST", message: "A valid scene and user message are required." }, 400);
  }

  const coachMode = body.coachMode !== false;
  const scenario = scenarios[scene];
  const level = typeof body.level === "string" && body.level.trim() ? body.level.trim() : "B1–B2";
  const systemPrompt = [
    `You are ${scenario.role} in a realistic English role-play for a ${level} learner.`,
    `Situation: ${scenario.situation}`,
    `Learning goal: ${scenario.goal}`,
    "Stay in role. Respond to the learner's latest message and advance the situation by exactly one natural turn.",
    "Use the full conversation context. Never repeat a stock response, never mention being an AI, and never solve the learner's side of the conversation for them.",
    "Ask at most one focused follow-up question. Keep the role reply between 35 and 85 English words.",
    coachMode
      ? "Also provide a natural Simplified Chinese translation of the role reply and concise Simplified Chinese coaching feedback on the learner's latest English. The feedback must cite one specific strength or problem and give one improved English expression."
      : "This is full immersion. Do not translate, explain, correct, or coach.",
    'Return only valid JSON with this exact shape: {"reply":"English role reply","translation":"Chinese translation or empty string","feedback":"Chinese feedback or empty string"}.',
  ].join("\n");

  const baseUrl = (process.env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1")
    .trim()
    .replace(/\/+$/, "");
  const model = (process.env.QWEN_MODEL || "qwen-plus-latest").trim();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((message) => ({ role: message.role, content: message.text.trim() })),
        ],
        temperature: 0.72,
        top_p: 0.9,
        max_tokens: 520,
      }),
      signal: controller.signal,
    });

    if (!upstream.ok) {
      return json({
        code: upstream.status === 401 ? "INVALID_API_KEY" : "UPSTREAM_ERROR",
        message: upstream.status === 401
          ? "DashScope rejected the server key. Check that the API Key and API Host belong to the same region."
          : "The Qwen service did not return a successful response.",
      }, upstream.status === 401 ? 401 : 502);
    }

    const payload = await upstream.json();
    const content = readContent(payload);
    if (!content) {
      return json({ code: "EMPTY_MODEL_REPLY", message: "Qwen returned an empty response." }, 502);
    }

    return json({ ...parseModelReply(content, coachMode), source: "qwen" });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return json({
      code: timedOut ? "UPSTREAM_TIMEOUT" : "UPSTREAM_UNAVAILABLE",
      message: timedOut ? "The Qwen request timed out." : "The Qwen service is temporarily unavailable.",
    }, 502);
  } finally {
    clearTimeout(timeout);
  }
}
