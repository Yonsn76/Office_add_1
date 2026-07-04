import { Action } from "../ai/actions";
import { applyDocumentFormat } from "./format";

export interface RunResult {
  applied: number;
  warnings: string[];
}

// Ejecuta las acciones de formato que emitio la IA contra el documento.
export async function runActions(actions: Action[]): Promise<RunResult> {
  const warnings: string[] = [];
  let applied = 0;

  for (const a of actions) {
    if (a.type === "formatDocument") {
      const { type, ...fmt } = a as any;
      void type;
      const res = await applyDocumentFormat(fmt);
      warnings.push(...res.warnings);
      applied++;
    }
  }

  return { applied, warnings };
}
