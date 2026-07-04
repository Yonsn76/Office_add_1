import { toWordHtml } from "../ai/richtext";

// Utilidades para interactuar con el documento de Word via Office.js.

export async function getSelectedText(): Promise<string> {
  return Word.run(async (context) => {
    const sel = context.document.getSelection();
    sel.load("text");
    await context.sync();
    return sel.text ?? "";
  });
}

export async function getBodyText(): Promise<string> {
  return Word.run(async (context) => {
    const body = context.document.body;
    body.load("text");
    await context.sync();
    return body.text ?? "";
  });
}

type InsertWhere = "replace" | "after" | "before" | "end";

// Quita la sangria de primera linea y el espaciado heredados del estilo del
// documento en los parrafos de un rango, para que el resultado coincida con el
// preview del chat (sin sangria fantasma ni espacio extra).
async function normalizeParagraphs(context: Word.RequestContext, range: Word.Range) {
  const paras = range.paragraphs;
  paras.load("items");
  await context.sync();
  for (const p of paras.items) {
    p.firstLineIndent = 0;
    p.leftIndent = 0;
    p.spaceBefore = 0;
    p.spaceAfter = 6; // pequena separacion entre parrafos, como el chat
  }
  await context.sync();
}

// Inserta contenido enriquecido y normaliza los parrafos resultantes.
export async function insertRich(content: string, where: InsertWhere = "replace"): Promise<void> {
  const html = toWordHtml(content);
  return Word.run(async (context) => {
    const doc = context.document;
    let range: Word.Range;
    if (where === "end") {
      range = doc.body.insertHtml(html, Word.InsertLocation.end);
    } else {
      const sel = doc.getSelection();
      const loc =
        where === "replace"
          ? Word.InsertLocation.replace
          : where === "after"
          ? Word.InsertLocation.after
          : Word.InsertLocation.before;
      range = sel.insertHtml(html, loc);
    }
    await context.sync();
    await normalizeParagraphs(context, range);
  });
}

export async function insertText(text: string, where: InsertWhere = "replace"): Promise<void> {
  return Word.run(async (context) => {
    if (where === "end") {
      context.document.body.insertParagraph(text, Word.InsertLocation.end);
    } else {
      const sel = context.document.getSelection();
      const loc =
        where === "replace"
          ? Word.InsertLocation.replace
          : where === "after"
          ? Word.InsertLocation.after
          : Word.InsertLocation.before;
      sel.insertText(text, loc);
    }
    await context.sync();
  });
}

export async function insertImageBase64(
  base64: string,
  where: InsertWhere = "end",
  widthPt?: number
): Promise<void> {
  return Word.run(async (context) => {
    const doc = context.document;
    let pic: Word.InlinePicture;
    if (where === "end") {
      pic = doc.body.insertInlinePictureFromBase64(base64, Word.InsertLocation.end);
    } else {
      const sel = doc.getSelection();
      const loc =
        where === "replace"
          ? Word.InsertLocation.replace
          : where === "after"
          ? Word.InsertLocation.after
          : Word.InsertLocation.before;
      pic = sel.insertInlinePictureFromBase64(base64, loc);
    }
    if (widthPt && widthPt > 0) pic.width = widthPt;
    await context.sync();
  });
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
