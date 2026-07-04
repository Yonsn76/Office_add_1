import { stripReasoning, markdownToPlain } from "./format";
import { looksLikeHtml } from "./richtext";

// Quita etiquetas HTML dejando solo el texto, con saltos donde corresponde.
function htmlToPlain(html: string): string {
  let t = html;
  t = t.replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, "\n");
  t = t.replace(/<br\s*\/?>/gi, "\n");
  t = t.replace(/<li[^>]*>/gi, "\u2022 ");
  t = t.replace(/<[^>]+>/g, "");
  t = t.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"');
  return t;
}

function toPlain(t: string): string {
  const s = looksLikeHtml(t) ? htmlToPlain(t) : markdownToPlain(t);
  return s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
}

// Convierte el acumulado a texto plano completo (comentario + contenido).
export function livePlainText(raw: string): string {
  let t = stripReasoning(raw);
  t = t.replace(/```\s*word-actions[\s\S]*?```/gi, "");
  t = t.replace(/```[a-zA-Z0-9_-]*\r?\n?/g, "");
  return toPlain(t);
}

// Extrae SOLO el entregable (lo que va dentro del bloque de codigo), para
// escribir en la hoja. Si no hay bloque, devuelve "" -> es conversacion y NO
// se escribe en el documento. Funciona con el bloque a medio llegar (stream):
// si hay apertura ```lang sin cierre, toma todo lo que va despues.
export function liveDeliverable(raw: string): string {
  let t = stripReasoning(raw);
  t = t.replace(/```\s*word-actions[\s\S]*?```/gi, "");

  // Bloque cerrado ```lang ... ```
  const closed = t.match(/```[ \t]*[a-zA-Z0-9_-]*[ \t]*\r?\n([\s\S]*?)```/);
  if (closed) return toPlain(closed[1]);

  // Apertura sin cierre (mientras llega el stream).
  const open = t.match(/```[ \t]*[a-zA-Z0-9_-]*[ \t]*\r?\n([\s\S]*)$/);
  if (open) return toPlain(open[1]);

  // Sin bloque: es solo comentario/conversacion, no hay entregable.
  return "";
}
