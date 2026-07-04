// Formato a nivel de documento via Office.js. Todos los campos son opcionales:
// solo se aplica lo que venga definido, para que la IA pueda cambiar una cosa
// (p.ej. solo interlineado) sin tocar el resto.

const CM_TO_PT = 28.3465; // 1 cm en puntos

export type AlignName = "left" | "justified" | "center" | "right";
export type Spacing = "single" | "1.5" | "double";

export interface DocFormat {
  fontName?: string;
  fontSize?: number;
  spacing?: Spacing;
  alignment?: AlignName;
  firstLineIndentCm?: number;
  marginCm?: number;
  pageNumbers?: boolean;
  scope?: "document" | "selection"; // por defecto: documento
}

function alignEnum(a: AlignName): Word.Alignment {
  switch (a) {
    case "justified": return Word.Alignment.justified;
    case "center": return Word.Alignment.centered;
    case "right": return Word.Alignment.right;
    default: return Word.Alignment.left;
  }
}

function spacingPts(s: Spacing, size: number): number {
  const mult = s === "double" ? 2 : s === "1.5" ? 1.5 : 1;
  return Math.round(size * 1.15 * mult * 10) / 10;
}

export interface ApplyResult {
  ok: boolean;
  warnings: string[];
}

export async function applyDocumentFormat(fmt: DocFormat): Promise<ApplyResult> {
  const warnings: string[] = [];
  const size = fmt.fontSize ?? 12;

  await Word.run(async (context) => {
    const doc = context.document;
    const useSel = fmt.scope === "selection";
    const target = useSel ? doc.getSelection() : doc.body;

    // Fuente
    if (fmt.fontName) target.font.name = fmt.fontName;
    if (fmt.fontSize) target.font.size = fmt.fontSize;

    // Parrafos: alineacion, interlineado, sangria
    const paras = target.paragraphs;
    paras.load("items");
    await context.sync();

    for (const p of paras.items) {
      if (fmt.alignment) p.alignment = alignEnum(fmt.alignment);
      if (fmt.spacing) p.lineSpacing = spacingPts(fmt.spacing, size);
      if (fmt.firstLineIndentCm != null) {
        p.firstLineIndent = Math.round(fmt.firstLineIndentCm * CM_TO_PT * 10) / 10;
      }
    }
    await context.sync();

    // Estilo Normal: para que el texto NUEVO herede el formato tambien.
    if (!useSel) {
      try {
        const styles = doc.getStyles();
        styles.load("items");
        await context.sync();
        const normal = styles.items.find((s: any) => {
          s.load("nameLocal");
          return false;
        });
        await context.sync();
        const normalStyle = (styles.items as any[]).find(
          (s) => /^(normal|normal)$/i.test(s.nameLocal)
        );
        if (normalStyle) {
          if (fmt.fontName) normalStyle.font.name = fmt.fontName;
          if (fmt.fontSize) normalStyle.font.size = fmt.fontSize;
          const pf = normalStyle.paragraphFormat;
          if (pf) {
            if (fmt.alignment) pf.alignment = alignEnum(fmt.alignment);
            if (fmt.spacing) pf.lineSpacing = spacingPts(fmt.spacing, size);
            if (fmt.firstLineIndentCm != null) pf.firstLineIndent = Math.round(fmt.firstLineIndentCm * CM_TO_PT * 10) / 10;
          }
          await context.sync();
        }
        void normal;
      } catch {
        /* estilos no disponibles en esta version; el formato directo ya se aplico */
      }
    }

    // Margenes + numeros de pagina (a nivel de seccion, solo documento)
    if (!useSel && (fmt.marginCm != null || fmt.pageNumbers != null)) {
      const sections = doc.sections;
      sections.load("items");
      await context.sync();
      const section = sections.items[0];

      if (fmt.marginCm != null) {
        const marginPt = Math.round(fmt.marginCm * CM_TO_PT * 10) / 10;
        const anySection = section as any;
        try {
          if (anySection.pageSetup) {
            anySection.pageSetup.topMargin = marginPt;
            anySection.pageSetup.bottomMargin = marginPt;
            anySection.pageSetup.leftMargin = marginPt;
            anySection.pageSetup.rightMargin = marginPt;
            await context.sync();
          } else {
            warnings.push("margenes");
          }
        } catch {
          warnings.push("margenes");
        }
      }

      if (fmt.pageNumbers) {
        try {
          const header = section.getHeader(Word.HeaderFooterType.primary);
          header.clear();
          await context.sync();
          const hp = header.paragraphs.getFirst();
          hp.alignment = Word.Alignment.right;
          const r = hp.getRange(Word.RangeLocation.end);
          (r as any).insertField(Word.InsertLocation.end, Word.FieldType.page);
          await context.sync();
        } catch {
          warnings.push("numeros de pagina");
        }
      }
    }
  });

  return { ok: true, warnings };
}
