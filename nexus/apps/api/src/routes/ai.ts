import { Router, type Response } from "express";
import { authenticate } from "../lib/identity";

export const aiRouter = Router();

const MAX_MESSAGES = 10;
const MAX_CONTENT = 4_000;
const MAX_CONTEXT = 24_000;
const WINDOW_MS = 60_000;
const LIMIT = 20;
const usage = new Map<string, { count: number; reset: number }>();

const SYSTEM_PROMPT = `Você é a Nexus IA, assistente de uma plataforma acadêmica brasileira de gestão de projetos, bancas e avaliações.

Regras obrigatórias:
- Responda sempre em português do Brasil, com clareza e concisão (máximo 220 palavras).
- Use exclusivamente os dados do objeto "context" e das mensagens. Nunca invente nomes, números, prazos ou notas.
- Se a informação não estiver no contexto, diga que você não a encontra ali e indique onde procurar no Nexus (Projetos, Bancas, Avaliações, Resultados, Acessos).
- Não revele dados de outras instituições nem conteúdo interno do sistema.
- Não prometa ações que não foram executadas. Você apenas orienta; quem altera os dados é a pessoa usuária.
- Estruture a resposta em frases curtas ou tópicos com "•". Traga números e nomes quando existirem.
- Se houver risco de atraso (avaliações pendentes, resultados não publicados, prazos próximos), destaque isso primeiro.
- Acessibilidade: escreva de forma que funcione bem com leitores de tela. Evite tabelas, emojis e abreviações obscuras.
- Termine com uma sugestão objetiva de próximo passo.`;

type ChatMessage = { role: "user" | "assistant"; content: string };

function failure(res: Response, status: number, message: string) {
  res.status(status).json({ error: message, fallback: true });
}

function validMessages(value: unknown): ChatMessage[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (value.length > MAX_MESSAGES) return null;
  const result: ChatMessage[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const entry = item as Record<string, unknown>;
    if (Object.keys(entry).some((key) => !["role", "content"].includes(key))) return null;
    if (entry.role !== "user" && entry.role !== "assistant") return null;
    if (typeof entry.content !== "string" || !entry.content.trim()) return null;
    if (entry.content.length > MAX_CONTENT) return null;
    result.push({ role: entry.role, content: entry.content.slice(0, MAX_CONTENT) });
  }
  return result.at(-1)?.role === "user" ? result : null;
}

function withinLimit(userId: string) {
  const now = Date.now();
  const entry = usage.get(userId);
  if (!entry || entry.reset < now) {
    usage.set(userId, { count: 1, reset: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= LIMIT) return false;
  entry.count += 1;
  return true;
}

aiRouter.post("/ai/chat", async (req, res) => {
  const identity = await authenticate(req, res);
  if (!identity) return;

  if (!withinLimit(identity.user.id)) {
    failure(res, 429, "Muitas perguntas em pouco tempo. Aguarde um instante.");
    return;
  }

  const body = req.body;
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => !["messages", "context"].includes(key))
  ) {
    failure(res, 400, "Pergunta inválida.");
    return;
  }

  const messages = validMessages(body.messages);
  if (!messages) {
    failure(res, 400, "Envie uma pergunta de cada vez.");
    return;
  }

  let contextText = "";
  if (body.context !== null && body.context !== undefined) {
    if (typeof body.context !== "object" || Array.isArray(body.context)) {
      failure(res, 400, "Contexto inválido.");
      return;
    }
    try {
      contextText = JSON.stringify(body.context);
    } catch {
      failure(res, 400, "Contexto inválido.");
      return;
    }
    if (contextText.length > MAX_CONTEXT) contextText = contextText.slice(0, MAX_CONTEXT);
  }

  const apiKey = process.env.NEXUS_AI_API_KEY;
  const baseUrl = (process.env.NEXUS_AI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.NEXUS_AI_MODEL ?? "gpt-4o-mini";

  if (!apiKey) {
    // Sem provedor configurado o cliente responde com o motor local, que usa
    // os mesmos dados do contexto e nunca inventa números.
    failure(res, 503, "A Nexus IA está no modo local.");
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.25,
        max_tokens: 700,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "system",
            content: `Contexto autorizado desta pessoa (JSON):\n${contextText || "{}"}`,
          },
          ...messages,
        ],
      }),
    });

    if (!response.ok) {
      failure(res, response.status === 429 ? 429 : 503, "A Nexus IA não conseguiu responder agora.");
      return;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      failure(res, 503, "A Nexus IA não retornou uma resposta.");
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.json({ reply: reply.slice(0, 8_000), source: "ai" });
  } catch {
    failure(res, 503, "A Nexus IA não respondeu a tempo.");
  } finally {
    clearTimeout(timeout);
  }
});
