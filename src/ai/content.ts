// Separa la respuesta del modelo en dos partes:
//  - comment: lo que el modelo DICE (comentarios, explicaciones). Solo se muestra.
//  - content: el ENTREGABLE (texto/HTML corregido o redactado). Es lo unico que
//    se inserta en el documento.
//
// Estrategia (en orden de preferencia):
//  1) Bloque cercado ```html ... ``` (o cualquier bloque cercado no word-actions).
//  2) Etiquetas explicitas [[CONTENIDO]] ... [[/CONTENIDO]].
//  3) Heuristica: si la respuesta parece HTML/markdown estructurado (titulos,
//     tags), se trata como contenido; si no, como comentario/conversacion.

export interface SplitResult {
  comment: string;
  content: string;
  hasBlock: boolean;
}

const FENCE_RE = /```[ \t]*([a-zA-Z0-9_-]*)[ \t]*\r?\n([\s\S]*?)```/g;
const TAG_RE = /\[\[\s*CONTENIDO\s*\]\]([\s\S]*?)\[\[\s*\/\s*CONTENIDO\s*\]\]/i;

function looksStructured(text: string): boolean {
  // Contiene tags HTML de bloque o varios encabezados markdown.
  if (/<\/?(p|div|h[1-6]|ul|ol|li|table|blockquote|strong|em|span)\b/i.test(text)) return true;
  const headings = (text.match(/^#{1,3}\s+/gm) || []).length;
  return headings >= 1;
}

export function splitResponse(raw: string): SplitResult {
  // 1) Bloques cercados.
  const blocks: { lang: string; body: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  FENCE_RE.lastIndex = 0;
  while ((m = FENCE_RE.exec(raw)) !== null) {
    const lang = (m[1] || "").toLowerCase();
    if (lang === "word-actions") continue;
    blocks.push({ lang, body: m[2], start: m.index, end: m.index + m[0].length });
  }
  if (blocks.length > 0) {
    const chosen = blocks.find((b) => b.lang === "html") ?? blocks[0];
    const comment = (raw.slice(0, chosen.start) + raw.slice(chosen.end)).trim();
    return { comment, content: chosen.body.trim(), hasBlock: true };
  }

  // 2) Etiquetas explicitas.
  const tag = raw.match(TAG_RE);
  if (tag) {
    const comment = raw.replace(TAG_RE, "").trim();
    return { comment, content: tag[1].trim(), hasBlock: true };
  }

  // 3) Heuristica.
  if (looksStructured(raw)) {
    return { comment: "", content: raw.trim(), hasBlock: false };
  }
  // Texto corto conversacional: es comentario, no entregable.
  return { comment: raw.trim(), content: "", hasBlock: false };
}
