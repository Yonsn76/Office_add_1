// Utilidades de formato: limpiar tokens de razonamiento y parsear markdown.

// Elimina bloques de "pensamiento" que algunos modelos (minimax, deepseek, qwen)
// emiten: <think>...</think>, <reasoning>...</reasoning>, y variantes.
// Tambien maneja el caso de stream incompleto (etiqueta de apertura sin cierre).
export function stripReasoning(text: string): string {
  let out = text;
  // Bloques completos.
  out = out.replace(/<(think|reasoning|thought|thinking)>[\s\S]*?<\/\1>/gi, "");
  // Apertura sin cierre (mientras llega el stream): corta desde la etiqueta.
  out = out.replace(/<(think|reasoning|thought|thinking)>[\s\S]*$/i, "");
  return out.replace(/^\s+/, "");
}

export interface MdBlock {
  type: "h1" | "h2" | "h3" | "p" | "li" | "quote" | "code" | "hr";
  text: string;
  ordered?: boolean;
}

// Segmento de texto en linea, con marca de negrita/cursiva/codigo.
export interface Span {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

// Parse muy ligero de markdown a bloques. Suficiente para respuestas de chat.
export function parseMarkdown(md: string): MdBlock[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: MdBlock[] = [];
  let inCode = false;
  let codeBuf: string[] = [];

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");

    if (/^```/.test(line)) {
      if (inCode) {
        blocks.push({ type: "code", text: codeBuf.join("\n") });
        codeBuf = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(raw);
      continue;
    }

    if (!line.trim()) continue;
    if (/^#{1}\s+/.test(line)) blocks.push({ type: "h1", text: line.replace(/^#\s+/, "") });
    else if (/^#{2}\s+/.test(line)) blocks.push({ type: "h2", text: line.replace(/^#{2}\s+/, "") });
    else if (/^#{3,}\s+/.test(line)) blocks.push({ type: "h3", text: line.replace(/^#{3,}\s+/, "") });
    else if (/^>\s?/.test(line)) blocks.push({ type: "quote", text: line.replace(/^>\s?/, "") });
    else if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) blocks.push({ type: "hr", text: "" });
    else if (/^\s*[-*+]\s+/.test(line)) blocks.push({ type: "li", text: line.replace(/^\s*[-*+]\s+/, ""), ordered: false });
    else if (/^\s*\d+[.)]\s+/.test(line)) blocks.push({ type: "li", text: line.replace(/^\s*\d+[.)]\s+/, ""), ordered: true });
    else blocks.push({ type: "p", text: line });
  }
  if (inCode && codeBuf.length) blocks.push({ type: "code", text: codeBuf.join("\n") });
  return blocks;
}

// Divide texto en spans segun **negrita**, *cursiva* y `codigo`.
export function parseSpans(text: string): Span[] {
  const spans: Span[] = [];
  const re = /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_|`([^`]+)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) spans.push({ text: text.slice(last, m.index) });
    if (m[2] !== undefined) spans.push({ text: m[2], bold: true });
    else if (m[3] !== undefined) spans.push({ text: m[3], bold: true });
    else if (m[4] !== undefined) spans.push({ text: m[4], italic: true });
    else if (m[5] !== undefined) spans.push({ text: m[5], italic: true });
    else if (m[6] !== undefined) spans.push({ text: m[6], code: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) spans.push({ text: text.slice(last) });
  return spans.length ? spans : [{ text }];
}

// Convierte markdown a texto plano legible (para copiar / fallback).
export function markdownToPlain(md: string): string {
  return parseMarkdown(md)
    .map((b) => {
      const t = parseSpans(b.text).map((s) => s.text).join("");
      if (b.type === "li") return `\u2022 ${t}`;
      return t;
    })
    .join("\n");
}
