// Separa la respuesta del modelo en dos partes:
//  - comment: lo que el modelo DICE (comentarios). Solo se muestra.
//  - content: el ENTREGABLE (texto/HTML). Es lo unico que se inserta.
//
// Estrategia (en orden):
//  1) Bloque cercado ```lang ... ``` (preferido: html).
//  2) Bloque ABIERTO ```lang ... (sin cierre): pasa durante el streaming, para
//     que el entregable se vaya mostrando token a token en lugar de aparecer
//     todo de golpe al final.
//  3) Etiquetas [[CONTENIDO]] ... [[/CONTENIDO]].
//  4) Heuristica: si parece HTML/markdown estructurado, es contenido.

export interface SplitResult {
  comment: string;
  content: string;
  hasBlock: boolean;
}

const FENCE_RE = /```[ \t]*([a-zA-Z0-9_-]*)[ \t]*\r?\n([\s\S]*?)```/g;
const OPEN_FENCE_RE = /```[ \t]*([a-zA-Z0-9_-]*)[ \t]*\r?\n([\s\S]*)$/;
const TAG_RE = /\[\[\s*CONTENIDO\s*\]\]([\s\S]*?)\[\[\s*\/\s*CONTENIDO\s*\]\]/i;

function looksStructured(text: string): boolean {
  if (/<\/?(p|div|h[1-6]|ul|ol|li|table|blockquote|strong|em|span)\b/i.test(text)) return true;
  const headings = (text.match(/^#{1,3}\s+/gm) || []).length;
  return headings >= 1;
}

export function splitResponse(raw: string): SplitResult {
  // Ignora el bloque de acciones al separar comentario/contenido.
  const noActions = raw.replace(/```\s*word-actions[\s\S]*?```/gi, "");

  // 1) Bloques cerrados.
  const blocks: { lang: string; body: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  FENCE_RE.lastIndex = 0;
  while ((m = FENCE_RE.exec(noActions)) !== null) {
    const lang = (m[1] || "").toLowerCase();
    if (lang === "word-actions") continue;
    blocks.push({ lang, body: m[2], start: m.index, end: m.index + m[0].length });
  }
  if (blocks.length > 0) {
    const chosen = blocks.find((b) => b.lang === "html") ?? blocks[0];
    const comment = (noActions.slice(0, chosen.start) + noActions.slice(chosen.end)).trim();
    return { comment, content: chosen.body.trim(), hasBlock: true };
  }

  // 2) Bloque abierto (streaming en curso): muestra el contenido parcial ya.
  const open = noActions.match(OPEN_FENCE_RE);
  if (open) {
    const comment = noActions.slice(0, open.index).trim();
    return { comment, content: open[2].trimStart(), hasBlock: true };
  }

  // 3) Etiquetas explicitas.
  const tag = noActions.match(TAG_RE);
  if (tag) {
    const comment = noActions.replace(TAG_RE, "").trim();
    return { comment, content: tag[1].trim(), hasBlock: true };
  }

  // 4) Heuristica.
  if (looksStructured(noActions)) {
    return { comment: "", content: noActions.trim(), hasBlock: false };
  }
  return { comment: noActions.trim(), content: "", hasBlock: false };
}
