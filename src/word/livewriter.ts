// Escritor incremental: teclea texto en el documento en tiempo real, como un
// agente. Mantiene un rango-cursor y va insertando los deltas segun llegan.
// Escribe TEXTO PLANO durante el stream (el formato rico mid-stream seria
// inestable); el usuario puede reformatear despues si quiere.
//
// Para no saturar Word con un sync por token, acumula deltas y los descarga
// en lotes cada ~250 ms.

export class LiveWriter {
  private queue = "";
  private flushing = false;
  private started = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly atEnd: boolean;

  // atEnd=true escribe al final del documento; si no, reemplaza la seleccion
  // actual y sigue escribiendo desde ahi.
  constructor(atEnd = true) {
    this.atEnd = atEnd;
  }

  // Encola un fragmento de texto para escribir.
  push(delta: string) {
    if (delta) this.queue += delta;
  }

  // Arranca el bucle de escritura por lotes.
  start() {
    if (this.timer) return;
    this.timer = setInterval(() => void this.flush(), 250);
  }

  // Descarga lo que quede y detiene el bucle.
  async finish() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.flush();
  }

  private async flush() {
    if (this.flushing) return;
    if (!this.queue) return;
    this.flushing = true;
    const chunk = this.queue;
    this.queue = "";

    try {
      await Word.run(async (context) => {
        const doc = context.document;
        if (!this.started) {
          // Primer lote: fija el punto de insercion.
          if (this.atEnd) {
            doc.body.insertText(chunk, Word.InsertLocation.end);
          } else {
            const sel = doc.getSelection();
            sel.insertText(chunk, Word.InsertLocation.replace);
          }
          this.started = true;
        } else {
          // Lotes siguientes: siempre al final del cuerpo (el cursor avanza).
          doc.body.insertText(chunk, Word.InsertLocation.end);
        }
        await context.sync();
      });
    } catch {
      // Si un lote falla, devuelve el texto a la cola para reintentar.
      this.queue = chunk + this.queue;
    } finally {
      this.flushing = false;
    }
  }
}
