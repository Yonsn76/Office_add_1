import { parseMarkdown, parseSpans, Span } from "../../ai/format";

function Inline({ spans }: { spans: Span[] }) {
  return (
    <>
      {spans.map((s, i) => {
        if (s.code) return <code key={i} className="md-code">{s.text}</code>;
        if (s.bold) return <strong key={i}>{s.text}</strong>;
        if (s.italic) return <em key={i}>{s.text}</em>;
        return <span key={i}>{s.text}</span>;
      })}
    </>
  );
}

// Renderiza markdown ligero. Agrupa items de lista consecutivos en <ul>/<ol>.
export default function Markdown({ text }: { text: string }) {
  const blocks = parseMarkdown(text);
  const out: JSX.Element[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flush = () => {
    if (!list) return;
    const items = list.items.map((t, i) => (
      <li key={i}><Inline spans={parseSpans(t)} /></li>
    ));
    out.push(list.ordered ? <ol key={out.length} className="md-ol">{items}</ol> : <ul key={out.length} className="md-ul">{items}</ul>);
    list = null;
  };

  blocks.forEach((b) => {
    if (b.type === "li") {
      if (!list || list.ordered !== !!b.ordered) {
        flush();
        list = { ordered: !!b.ordered, items: [] };
      }
      list.items.push(b.text);
      return;
    }
    flush();
    switch (b.type) {
      case "h1": out.push(<h1 key={out.length} className="md-h1"><Inline spans={parseSpans(b.text)} /></h1>); break;
      case "h2": out.push(<h2 key={out.length} className="md-h2"><Inline spans={parseSpans(b.text)} /></h2>); break;
      case "h3": out.push(<h3 key={out.length} className="md-h3"><Inline spans={parseSpans(b.text)} /></h3>); break;
      case "quote": out.push(<blockquote key={out.length} className="md-quote"><Inline spans={parseSpans(b.text)} /></blockquote>); break;
      case "code": out.push(<pre key={out.length} className="md-pre"><code>{b.text}</code></pre>); break;
      case "hr": out.push(<hr key={out.length} className="md-hr" />); break;
      default: out.push(<p key={out.length} className="md-p"><Inline spans={parseSpans(b.text)} /></p>);
    }
  });
  flush();

  return <div className="md">{out}</div>;
}
