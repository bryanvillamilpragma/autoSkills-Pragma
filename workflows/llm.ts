import { existsSync, readFileSync } from "node:fs";
import { extname } from "node:path";

// ── Tipos ─────────────────────────────────────────────────────

export interface LLMImageContent {
  type: "image";
  source: {
    type: "base64";
    media_type: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
    data: string;
  };
}

export interface LLMTextContent {
  type: "text";
  text: string;
}

export type LLMContent = LLMTextContent | LLMImageContent;

export interface LLMMessage {
  role: "user" | "assistant";
  content: LLMContent[] | string;
}

export interface LLMOptions {
  model?: string;
  maxTokens?: number;
  system?: string;
}

export interface LLMResult {
  ok: boolean;
  text: string;
  error?: string;
}

// ── API key ───────────────────────────────────────────────────

export function getApiKey(): string | null {
  // Leer .env manualmente primero — process.loadEnvFile() no sobreescribe
  // variables ya definidas en el entorno (ej: Claude Code las inyecta vacías)
  try {
    const content = readFileSync(".env", "utf-8");
    const match = content.match(/^ANTHROPIC_API_KEY=(.+)$/m);
    if (match?.[1]?.trim()) return match[1].trim();
  } catch {}
  // Fallback al entorno del shell
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  return null;
}

// ── Imagen a base64 ───────────────────────────────────────────

const MEDIA_TYPES: Record<string, LLMImageContent["source"]["media_type"]> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

export function imageToContent(imagePath: string): LLMImageContent | null {
  if (!existsSync(imagePath)) return null;

  const mediaType = MEDIA_TYPES[extname(imagePath).toLowerCase()];
  if (!mediaType) return null;

  let data: Buffer;
  try {
    data = readFileSync(imagePath);
  } catch {
    return null;
  }

  if (data.length > MAX_IMAGE_BYTES) return null;
  if (data.length === 0) return null;

  return {
    type: "image",
    source: { type: "base64", media_type: mediaType, data: data.toString("base64") },
  };
}

// ── Cliente Anthropic ─────────────────────────────────────────

export async function callLLM(
  messages: LLMMessage[],
  opts: LLMOptions = {},
): Promise<LLMResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return {
      ok: false,
      text: "",
      error: "ANTHROPIC_API_KEY no encontrada. Agrégala a tu .env o como variable de entorno.",
    };
  }

  const body = {
    model: opts.model ?? "claude-sonnet-4-5",
    max_tokens: opts.maxTokens ?? 8000,
    ...(opts.system ? { system: opts.system } : {}),
    messages,
  };

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return { ok: false, text: "", error: `Error de red: ${(err as Error).message}` };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, text: "", error: `Anthropic ${res.status}: ${text.slice(0, 300)}` };
  }

  let payload: { content: Array<{ type: string; text?: string }> };
  try {
    payload = await res.json() as typeof payload;
  } catch {
    return { ok: false, text: "", error: "Respuesta inválida de la API" };
  }

  const text = payload.content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");

  return { ok: true, text };
}

// ── Parser JSON ───────────────────────────────────────────────

export function parseJSONResponse<T>(text: string): T | null {
  const clean = text
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();
  try {
    return JSON.parse(clean) as T;
  } catch {
    return null;
  }
}
