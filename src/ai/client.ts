import { ProviderPreset, getPreset } from "./providers";

// Parte de contenido multimodal (formato OpenAI vision).
export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

export interface ProviderConfig {
  presetId: string;
  baseUrl: string; // resuelto (preset o custom)
  apiKey: string;
  model: string;
  temperature: number;
}

const PROXY_PREFIX = "/__ai_proxy";

function normalizeBase(url: string): string {
  return url.replace(/\/+$/, "");
}

function useProxy(): boolean {
  return typeof location !== "undefined" && /^localhost$|^127\.0\.0\.1$/.test(location.hostname);
}

function resolve(cfg: ProviderConfig, path: string): { url: string; headers: Record<string, string> } {
  const preset: ProviderPreset | undefined = getPreset(cfg.presetId);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.apiKey) headers["Authorization"] = `Bearer ${cfg.apiKey}`;
  if (preset?.extraHeaders) Object.assign(headers, preset.extraHeaders);

  const base = normalizeBase(cfg.baseUrl);
  if (useProxy()) {
    headers["x-ai-target"] = base;
    return { url: PROXY_PREFIX + path, headers };
  }
  return { url: base + path, headers };
}

function explain(err: unknown, url: string, target: string): Error {
  const raw = err instanceof Error ? err.message : String(err);
  console.error("[AI] fetch fallo:", { url, target, error: err });
  if (/failed to fetch|load failed|networkerror/i.test(raw)) {
    return new Error(
      `No se pudo conectar a ${target}. Causas probables: ` +
        `1) El servidor de desarrollo (npm run dev) no esta corriendo o el proxy fallo. ` +
        `2) La Base URL es incorrecta. 3) Sin conexion o API key invalida. ` +
        `Detalle tecnico: ${raw}`
    );
  }
  return new Error(raw);
}

async function readError(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  let detail = text;
  try {
    const j = JSON.parse(text);
    detail = j.error?.message ?? j.message ?? j.error ?? text;
  } catch {
    /* texto plano */
  }
  return `HTTP ${res.status} ${res.statusText}. ${String(detail).slice(0, 500)}`;
}

export async function streamChat(
  cfg: ProviderConfig,
  messages: ChatMessage[],
  onToken: (t: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const { url, headers } = resolve(cfg, "/chat/completions");
  console.info("[AI] streamChat ->", url, "target:", cfg.baseUrl, "modelo:", cfg.model);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      signal,
      body: JSON.stringify({ model: cfg.model, messages, temperature: cfg.temperature, stream: true }),
    });
  } catch (e) {
    throw explain(e, url, cfg.baseUrl);
  }

  if (!res.ok || !res.body) {
    throw new Error(await readError(res));
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const raw of lines) {
      const line = raw.trim();
      if (!line || !line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) onToken(delta);
      } catch {
        // fragmento parcial; se completara en la siguiente pasada
      }
    }
  }
}

export async function chat(cfg: ProviderConfig, messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
  const { url, headers } = resolve(cfg, "/chat/completions");
  console.info("[AI] chat ->", url, "target:", cfg.baseUrl, "modelo:", cfg.model);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      signal,
      body: JSON.stringify({ model: cfg.model, messages, temperature: cfg.temperature, stream: false }),
    });
  } catch (e) {
    throw explain(e, url, cfg.baseUrl);
  }
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

export interface ModelListResult {
  models: string[];
  error?: string;
}

export async function listModelsDetailed(cfg: ProviderConfig, signal?: AbortSignal): Promise<ModelListResult> {
  const { url, headers } = resolve(cfg, "/models");
  console.info("[AI] listModels ->", url, "target:", cfg.baseUrl);
  let res: Response;
  try {
    res = await fetch(url, { headers, signal });
  } catch (e) {
    return { models: [], error: explain(e, url, cfg.baseUrl).message };
  }
  if (!res.ok) {
    return { models: [], error: await readError(res) };
  }
  try {
    const json = await res.json();
    const data = json.data ?? json.models ?? [];
    const models = data
      .map((m: any) => m.id ?? m.name)
      .filter((x: any): x is string => typeof x === "string")
      .sort();
    return { models };
  } catch (e) {
    return { models: [], error: `Respuesta no valida de ${cfg.baseUrl}/models: ${String(e)}` };
  }
}

export async function listModels(cfg: ProviderConfig, signal?: AbortSignal): Promise<string[]> {
  return (await listModelsDetailed(cfg, signal)).models;
}
