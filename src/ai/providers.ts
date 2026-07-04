// Presets de proveedores. Todos hablan la API estilo OpenAI (chat/completions),
// por eso un solo cliente sirve para opencode Go, Ollama Cloud, OpenAI, etc.

export interface ProviderPreset {
  id: string;
  label: string;
  baseUrl: string;
  // Ejemplos de modelos para autocompletar en la UI.
  sampleModels: string[];
  // Si el endpoint expone /models para listar dinamicamente.
  supportsModelList: boolean;
  // Header extra opcional (ej. OpenRouter recomienda estos).
  extraHeaders?: Record<string, string>;
  docsUrl?: string;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "opencode-go",
    label: "opencode Go",
    baseUrl: "https://opencode.ai/zen/go/v1",
    // Catalogo del tier Go. La lista real se auto-carga desde /models.
    sampleModels: [
      "glm-5.2",
      "kimi-k2.7-code",
      "deepseek-v4-pro",
      "deepseek-v4-flash",
      "minimax-m3",
      "qwen3.7-max",
      "mimo-v2.5-pro",
      "mimo-v2.5",
      "hy3-preview",
    ],
    supportsModelList: true,
    docsUrl: "https://opencode.ai/docs/zen/",
  },
  {
    id: "ollama-cloud",
    label: "Ollama Cloud",
    baseUrl: "https://ollama.com/v1",
    sampleModels: ["gpt-oss:120b", "deepseek-v3.1:671b", "qwen3-coder:480b", "llama3.3:70b"],
    supportsModelList: true,
    docsUrl: "https://docs.ollama.com/cloud",
  },
  {
    id: "ollama-local",
    label: "Ollama (local)",
    baseUrl: "http://localhost:11434/v1",
    sampleModels: ["llama3.2", "qwen2.5", "mistral", "phi3"],
    supportsModelList: true,
    docsUrl: "https://ollama.com",
  },
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    sampleModels: ["gpt-4o", "gpt-4o-mini", "o4-mini"],
    supportsModelList: true,
    docsUrl: "https://platform.openai.com",
  },
  {
    id: "custom",
    label: "Personalizado (OpenAI-compatible)",
    baseUrl: "",
    sampleModels: [],
    supportsModelList: true,
    docsUrl: "",
  },
];

export function getPreset(id: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.id === id);
}
