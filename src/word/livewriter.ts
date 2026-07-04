import { toWordHtml } from "../ai/richtext";

// Escritor incremental estilo agente. Durante el stream teclea TEXTO PLANO en
// la hoja (efecto en vivo). Al finalizar, reemplaza SOLO lo que el mismo
// escribio por la version con FORMATO REAL (HTML -> formato nativo de Word).
//
// Acota lo escrito con dos marcadores (inicio y fin) para no tocar NUNCA el
// resto del documento. Cada lote se inserta justo en el marcador de fin y lo
// reposiciona, asi el texto crece de forma contigua sin saltar al final del doc.

export class LiveWriter {
  private queue = "";
  private flushing = false;
  private started = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly atEnd: boolean;
  private readonly bmStart = "__ai_live_start__";
  private readonly bmEnd = "__ai_live_end__";

  constructor(atEnd = true) {
    this.atEnd = atEnd;
  }

  push(delta: string) {
    if (delta) this.queue += delta;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => void this.flush(), 220);
  }

  private async flush() {
    if (this.flushing || !this.queue) return;
    this.flushing = true;
    const chunk = this.queue;
    this.queue = "";
    try {
      await Word.run(async (context) => {
        const doc = context.document;

        if (!this.started) {
          // Primer lote: fija el punto de insercion (fin del doc o seleccion).
          const range = this.atEnd
            ? doc.body.getRange(Word.RangeLocation.end)
            : doc.getSelection();
          if (!this.atEnd) range.clear();
          const written = range.insertText(chunk, Word.InsertLocation.replace);
          // Marca inicio (al comienzo) y fin (al final) de lo escrito.
          written.getRange(Word.RangeLocation.start).insertBookmark(this.bmStart);
          written.getRange(Word.RangeLocation.end).insertBookmark(this.bmEnd);
          this.started = true;
        } else {
          // Lotes siguientes: insertar EN el marcador de fin y reposicionarlo,
          // para crecer de forma contigua sin tocar el resto del documento.
          const endBm = doc.getBookmarkRangeOrNullObject(this.bmEnd);
          endBm.load("isNullObject");
          await context.sync();
          const anchor = endBm.isNullObject
            ? doc.body.getRange(Word.RangeLocation.end)
            : endBm;
          const written = anchor.insertText(chunk, Word.InsertLocation.end);
          written.getRange(Word.RangeLocation.end).insertBookmark(this.bmEnd);
        }
        await context.sync();
      });
    } catch {
      this.queue = chunk + this.queue;
    } finally {
      this.flushing = false;
    }
  }

  // Termina el tecleo. Si se pasa `finalContent`, reemplaza SOLO el rango
  // escrito (entre los dos marcadores) por su version con formato real.
  async finish(finalContent?: string) {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.flush();

    const cleanup = async () => {
      try {
        await Word.run(async (context) => {
          const doc = context.document;
          const a = doc.getBookmarkRangeOrNullObject(this.bmStart);
          const b = doc.getBookmarkRangeOrNullObject(this.bmEnd);
          a.load("isNullObject");
          b.load("isNullObject");
          await context.sync();
          if (!a.isNullObject) doc.deleteBookmark(this.bmStart);
          if (!b.isNullObject) doc.deleteBookmark(this.bmEnd);
          await context.sync();
        });
      } catch {
        /* noop */
      }
    };

    if (!finalContent || !this.started) {
      await cleanup();
      return;
    }

    const html = toWordHtml(finalContent);
    try {
      await Word.run(async (context) => {
        const doc = context.document;
        const startRange = doc.getBookmarkRangeOrNullObject(this.bmStart);
        const endRange = doc.getBookmarkRangeOrNullObject(this.bmEnd);
        startRange.load("isNullObject");
        endRange.load("isNullObject");
        await context.sync();
        if (startRange.isNullObject || endRange.isNullObject) return;

        // Rango acotado SOLO a lo que escribimos (inicio -> fin).
        const full = startRange.expandTo(endRange);
        full.insertHtml(html, Word.InsertLocation.replace);
        await context.sync();
      });
    } catch {
      // Si falla, se queda el texto plano ya tecleado (no destructivo).
    }
    await cleanup();
  }
}
