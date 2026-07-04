import { parseMarkdown, parseSpans } from "./format";

// Detecta si el texto ya viene como HTML.
export function looksLikeHtml(text: string): boolean {
  return /<\/?(p|div|span|h[1-6]|ul|ol|li|strong|b|em|i|u|mark|br|blockquote|table|tr|td|th|font)\b/i.test(text);
}

// Sanea HTML: quita scripts/estilos peligrosos y on*=..., conserva estilo inline.
export function sanitizeHtml(html: string): string {
  let out = html;
  out = out.replace(/<\s*(script|style|iframe|object|embed|link|meta)[\s\S]*?<\/\s*\1\s*>/gi, "");
  out = out.replace(/<\s*(script|style|iframe|object|embed|link|meta)\b[^>]*>/gi, "");
  out = out.replace(/\son\w+\s*=\s*"[^"]*"/gi, "");
  out = out.replace(/\son\w+\s*=\s*'[^']*'/gi, "");
  out = out.replace(/(href|src)\s*=\s*"javascript:[^"]*"/gi, "");
  return out;
}

const DEFAULT_ALIGN = "justify";
const HEADING_COLOR = "#2F3437"; // charcoal, igual que el preview del chat

function withDefaultAlign(openTag: string): string {
  if (/text-align\s*:/i.test(openTag)) return openTag;
  if (/style\s*=\s*"/i.test(openTag)) {
    return openTag.replace(/style\s*=\s*"/i, `style="text-align:${DEFAULT_ALIGN};`);
  }
  return openTag.replace(/<p\b/i, `<p style="text-align:${DEFAULT_ALIGN}"`);
}

export function applyDefaultAlignment(html: string): string {
  return html.replace(/<p\b[^>]*>/gi, (tag) => withDefaultAlign(tag));
}

// Extrae el style inline existente de un tag de apertura (o cadena vacia).
function extractStyle(attrs: string): string {
  const m = attrs.match(/style\s*=\s*"([^"]*)"/i);
  return m ? m[1] : "";
}

// Convierte <h1>-<h3> en <p> con formato EXPLICITO (tamano, negrita, color).
// Asi Word NO aplica sus estilos de titulo integrados (que son azules por
// defecto) y el resultado coincide con el preview del chat. Conserva la
// alineacion/estilo que el modelo haya puesto (p. ej. text-align:center o un
// color propio).
function headingsToStyledP(html: string): string {
  const sizes: Record<string, string> = { "1": "20pt", "2": "16pt", "3": "13pt" };
  return html.replace(/<h([1-3])\b([^>]*)>([\s\S]*?)<\/h\1>/gi, (_full, lvl, attrs, inner) => {
    const existing = extractStyle(attrs);
    const hasColor = /color\s*:/i.test(existing);
    const hasAlign = /text-align\s*:/i.test(existing);
    const parts: string[] = [];
    parts.push(`font-size:${sizes[lvl]}`);
    parts.push("font-weight:bold");
    if (!hasColor) parts.push(`color:${HEADING_COLOR}`);
    if (!hasAlign && lvl === "1") parts.push("text-align:center");
    parts.push("margin:0");
    parts.push("text-indent:0");
    // El style del modelo va primero (gana en color/alineacion si lo definio).
    const merged = (existing ? existing.replace(/;?\s*$/, ";") : "") + parts.join(";");
    return `<p style="${merged}">${inner}</p>`;
  });
}

function resetParagraphInheritance(html: string): string {
  const reset = "text-indent:0; margin:0;";
  return html.replace(/<(p|li)\b([^>]*)>/gi, (_full, tag, attrs) => {
    if (/text-indent\s*:/i.test(attrs) && /margin\s*:/i.test(attrs)) return `<${tag}${attrs}>`;
    if (/style\s*=\s*"/i.test(attrs)) {
      return `<${tag}${attrs.replace(/style\s*=\s*"/i, `style="${reset} `)}>`;
    }
    return `<${tag}${attrs} style="${reset}">`;
  });
}

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

// HTML final para insertar en Word: alineacion por defecto, titulos con estilo
// explicito (para no heredar el azul de Word) y reset de herencia de parrafo.
export function toWordHtml(content: string): string {
  const html = looksLikeHtml(content) ? content : markdownToHtml(content);
  return resetParagraphInheritance(headingsToStyledP(applyDefaultAlignment(sanitizeHtml(html))));
}
