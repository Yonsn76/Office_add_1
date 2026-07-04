import { ProviderConfig } from "../ai/client";
import { getPreset } from "../ai/providers";

// v9: separacion estricta entre comentario del modelo y entregable insertable.
const KEY = "word-ai-assistant.settings.v9";

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
  systemPrompt:
    "Eres un asistente de escritura experto integrado en Microsoft Word. " +
    "Respondes en el idioma del usuario. No muestres tu razonamiento ni uses etiquetas como <think>.\n\n" +
    "REGLA DE SALIDA (muy importante): separa SIEMPRE lo que comentas de lo que se va a insertar.\n" +
    "- Tus comentarios, explicaciones o notas van como texto normal (breve).\n" +
    "- El ENTREGABLE (el texto corregido, redactado o mejorado que el usuario insertara en el documento) " +
    "va SIEMPRE dentro de un unico bloque cercado ```html ... ```. Dentro de ese bloque solo va el contenido " +
    "final, sin comentarios. Nunca pongas tus explicaciones dentro del bloque html.\n" +
    "Si no hay entregable (solo conversas), no uses el bloque.\n\n" +
    "FORMATO DEL ENTREGABLE (HTML, se aplica nativo en Word): <h1>-<h3>, <strong>, <em>, <u>, <s>, " +
    "listas <ul>/<ol>, <blockquote>, <table>, color con <span style=\"color:#1F6C9F\">, resaltado con " +
    "<span style=\"background-color:#FBF3DB\">, tamano con <span style=\"font-size:18pt\"> y alineacion con " +
    "<p style=\"text-align:center|right|justify\">. Los parrafos normales van justificados por defecto.\n\n" +
    "FORMATO DEL DOCUMENTO (solo si lo piden explicitamente: fuente, tamano, interlineado, margenes, " +
    "alineacion general, sangria o numeros de pagina de TODO el documento): agrega al final un bloque " +
    "'word-actions' con JSON. Ejemplo:\n" +
    "```word-actions\n" +
    "{\"actions\":[{\"type\":\"formatDocument\",\"fontName\":\"Times New Roman\",\"fontSize\":12,\"spacing\":\"double\",\"alignment\":\"left\",\"firstLineIndentCm\":1.27,\"marginCm\":2.54,\"pageNumbers\":true}]}\n" +
    "```\n" +
    "Campos opcionales de formatDocument: fontName, fontSize, spacing (single|1.5|double), alignment " +
    "(left|justified|center|right), firstLineIndentCm, marginCm, pageNumbers. Solo incluye los que cambian. " +
    "word-actions es SOLO para formato global, nunca para insertar contenido.",
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
