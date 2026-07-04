import { stripReasoning, markdownToPlain } from "./format";

// Convierte el acumulado del stream en texto plano "escribible" en vivo:
// - quita razonamiento (<think>)
// - quita el bloque word-actions
// - quita las lineas de cerca ``` (deja el contenido interno)
// - convierte markdown ligero a texto plano
export function livePlainText(raw: string): string {
  let t = stripReasoning(raw);
  t = t.replace(/```\s*word-actions[\s\S]*?```/gi, "");
  // Quita marcadores de cerca sueltos, conservando el contenido.
  t = t.replace(/```[a-zA-Z0-9_-]*\r?\n?/g, "");
  return markdownToPlain(t).replace(/\n{3,}/g, "\n\n");
}
