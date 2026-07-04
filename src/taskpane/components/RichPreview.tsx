import Markdown from "./Markdown";
import { looksLikeHtml, sanitizeHtml } from "../../ai/richtext";

// Muestra la respuesta del asistente. Si viene HTML enriquecido (color, tamano,
// sombreado...), lo renderiza saneado; si no, usa el render de markdown.
export default function RichPreview({ text }: { text: string }) {
  if (looksLikeHtml(text)) {
    return (
      <div
        className="rich-preview"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(text) }}
      />
    );
  }
  return <Markdown text={text} />;
}
