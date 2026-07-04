import { parseMarkdown, parseSpans } from "./format";

// Detecta si el texto ya viene como HTML (la IA puede responder en HTML para
// formato rico: color, tamano, sombreado, alineacion, etc.).
export function looksLikeHtml(text: string): boolean {
  return /<\/?(p|div|span|h[1-6]|ul|ol|li|strong|b|em|i|u|mark|br|blockquote|table|tr|td|th|font)\b/i.test(text);
}

// Sanea HTML para la vista previa: quita scripts/estilos peligrosos y on*=...,
// conserva estilo inline (color, tamano, fondo, alineacion).
export function sanitizeHtml(html: string): string {
  let out = html;
  out = out.replace(/<\s*(script|style|iframe|object|embed|link|meta)[\s\S]*?<\/\s*\1\s*>/gi, "");
  out = out.replace(/<\s*(script|style|iframe|object|embed|link|meta)\b[^>]*>/gi, "");
  out = out.replace(/\son\w+\s*=\s*"[^"]*"/gi, "");
  out = out.replace(/\son\w+\s*=\s*'[^']*'/gi, "");
  out = out.replace(/(href|src)\s*=\s*"javascript:[^"]*"/gi, "");
  return out;
}

// Alineacion por defecto de los parrafos del cuerpo. Justificado como pidio
// el usuario. Los titulos y celdas conservan su alineacion natural salvo que
// la IA especifique otra con style="text-align:...".
const DEFAULT_ALIGN = "justify";

// Asegura que un tag de parrafo tenga alineacion. Si ya trae text-align en su
// style, se respeta; si no, se le inyecta el default justificado.
function withDefaultAlign(openTag: string): string {
  if (/text-align\s*:/i.test(openTag)) return openTag;
  if (/style\s*=\s*"/i.test(openTag)) {
    return openTag.replace(/style\s*=\s*"/i, `style="text-align:${DEFAULT_ALIGN};`);
  }
  return openTag.replace(/<p\b/i, `<p style="text-align:${DEFAULT_ALIGN}"`);
}

// Aplica la alineacion por defecto a todos los <p> de un HTML que no la tengan.
export function applyDefaultAlignment(html: string): string {
  return html.replace(/<p\b[^>]*>/gi, (tag) => withDefaultAlign(tag));
}

// Convierte markdown ligero a HTML. Los parrafos salen justificados por defecto.
export function markdownToHtml(md: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const inline = (t: string) =>
    parseSpans(t)
      .map((s) => {
        const safe = esc(s.text);
        if (s.code) return `<code>${safe}</code>`;
        if (s.bold) return `<strong>${safe}</strong>`;
        if (s.italic) return `<em>${safe}</em>`;
        return safe;
      })
      .join("");

  const blocks = parseMarkdown(md);
  const html: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const items = list.items.map((t) => `<li>${inline(t)}</li>`).join("");
    html.push(list.ordered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`);
    list = null;
  };

  for (const b of blocks) {
    if (b.type === "li") {
      if (!list || list.ordered !== !!b.ordered) {
        flush();
        list = { ordered: !!b.ordered, items: [] };
      }
      list.items.push(b.text);
      continue;
    }
    flush();
    switch (b.type) {
      case "h1": html.push(`<h1>${inline(b.text)}</h1>`); break;
      case "h2": html.push(`<h2>${inline(b.text)}</h2>`); break;
      case "h3": html.push(`<h3>${inline(b.text)}</h3>`); break;
      case "quote": html.push(`<blockquote>${inline(b.text)}</blockquote>`); break;
      case "code": html.push(`<pre>${esc(b.text)}</pre>`); break;
      case "hr": html.push(`<hr>`); break;
      default: html.push(`<p style="text-align:${DEFAULT_ALIGN}">${inline(b.text)}</p>`);
    }
  }
  flush();
  return html.join("");
}

// HTML final para insertar en Word (respuesta en HTML o markdown), con los
// parrafos justificados por defecto salvo alineacion explicita de la IA.
export function toWordHtml(content: string): string {
  const html = looksLikeHtml(content) ? content : markdownToHtml(content);
  return applyDefaultAlignment(sanitizeHtml(html));
}
