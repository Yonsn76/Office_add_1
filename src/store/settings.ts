import { ProviderConfig } from "../ai/client";
import { getPreset } from "../ai/providers";
import { SYSTEM_PROMPT } from "../ai/systemprompt";

// v10: system prompt maestro con ejemplos few-shot.
const KEY = "word-ai-assistant.settings.v10";

export interface AppSettings {
  active: ProviderConfig;
  systemPrompt: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  active: {
    presetId: "opencode-go",
    baseUrl: getPreset("opencode-go")!.baseUrl,
    apiKey: "",
    model: "glm-5.2",
    temperature: 0.7,
  },
  systemPrompt: SYSTEM_PROMPT,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT_SETTINGS);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(DEFAULT_SETTINGS),
      ...parsed,
      active: { ...DEFAULT_SETTINGS.active, ...(parsed.active ?? {}) },
    };
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export function saveSettings(s: AppSettings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}
