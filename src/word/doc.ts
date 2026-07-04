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

export async function insertRich(content: string, where: InsertWhere = "replace"): Promise<void> {
  const html = toWordHtml(content);
  return Word.run(async (context) => {
    const doc = context.document;
    if (where === "end") {
      doc.body.insertHtml(html, Word.InsertLocation.end);
    } else {
      const sel = doc.getSelection();
      const loc =
        where === "replace"
          ? Word.InsertLocation.replace
          : where === "after"
          ? Word.InsertLocation.after
          : Word.InsertLocation.before;
      sel.insertHtml(html, loc);
    }
    await context.sync();
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

// Inserta una imagen en el documento a partir de su base64 (sin el prefijo
// data:...). widthPt opcional fija el ancho en puntos (manteniendo proporcion).
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

// Lee un File de imagen y devuelve su base64 puro (sin el prefijo data URL).
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
