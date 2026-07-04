// Protocolo de acciones. La IA puede incluir en su respuesta un bloque:
//   ```word-actions
//   { "actions": [ ... ] }
//   ```
// Solo se usan para FORMATO del documento (fuente, margenes, interlineado...).
// La insercion de contenido (texto/HTML) NO va por aqui: se hace manualmente
// con los botones Reemplazar / Insertar / Al final del chat.

import { DocFormat } from "../word/format";

export type Action = { type: "formatDocument" } & DocFormat;

export interface ParsedResponse {
  text: string;        // respuesta visible, sin el bloque de acciones
  actions: Action[];   // acciones de formato a ejecutar
}

const BLOCK_RE = /```\s*word-actions\s*([\s\S]*?)```/i;

export function parseActions(raw: string): ParsedResponse {
  const m = raw.match(BLOCK_RE);
  if (!m) return { text: raw, actions: [] };

  let all: any[] = [];
  try {
    const json = JSON.parse(m[1].trim());
    if (Array.isArray(json)) all = json;
    else if (Array.isArray(json.actions)) all = json.actions;
  } catch {
    return { text: raw.replace(BLOCK_RE, "").trim(), actions: [] };
  }

  // Solo aceptamos acciones de formato de documento.
  const actions = all.filter((a) => a && a.type === "formatDocument") as Action[];
  const text = raw.replace(BLOCK_RE, "").trim();
  return { text, actions };
}

// Resumen humano de una accion de formato.
export function describeAction(a: Action): string {
  const parts: string[] = [];
  if (a.fontName) parts.push(`${a.fontName}${a.fontSize ? " " + a.fontSize : ""}`);
  else if (a.fontSize) parts.push(`tamano ${a.fontSize}`);
  if (a.spacing) parts.push(a.spacing === "double" ? "doble espacio" : `interlineado ${a.spacing}`);
  if (a.alignment) parts.push(
    a.alignment === "justified" ? "justificado" :
    a.alignment === "center" ? "centrado" :
    a.alignment === "right" ? "derecha" : "izquierda"
  );
  if (a.firstLineIndentCm != null) parts.push(`sangria ${a.firstLineIndentCm}cm`);
  if (a.marginCm != null) parts.push(`margenes ${a.marginCm}cm`);
  if (a.pageNumbers) parts.push("numeros de pagina");
  return `Formato: ${parts.join(", ") || "documento"}`;
}
