import { useState, useRef, useEffect } from "react";
import { AppSettings } from "../../store/settings";
import { ChatMessage, ContentPart, streamChat, listModels } from "../../ai/client";
import { getPreset } from "../../ai/providers";
import { stripReasoning, markdownToPlain } from "../../ai/format";
import { liveDeliverable } from "../../ai/live";
import { parseActions } from "../../ai/actions";
import { splitResponse } from "../../ai/content";
import { getSelectedText, getBodyText, insertRich } from "../../word/doc";
import { runActions } from "../../word/agent";
import { LiveWriter } from "../../word/livewriter";
import RichPreview from "./RichPreview";

interface Props {
  settings: AppSettings;
  onChange: (s: AppSettings) => void;
}

interface Attachment {
  name: string;
  dataUrl: string;
}

interface UiMessage {
  role: "user" | "assistant";
  content: string;
  images?: string[];
}

const QUICK_ACTIONS: { label: string; build: (text: string) => string }[] = [
  { label: "Mejorar", build: (t) => `Mejora la redaccion del siguiente texto manteniendo su significado:\n\n${t}` },
  { label: "Resumir", build: (t) => `Resume el siguiente texto en pocas frases:\n\n${t}` },
  { label: "Traducir", build: (t) => `Traduce al ingles el siguiente texto:\n\n${t}` },
  { label: "Corregir", build: (t) => `Corrige ortografia y gramatica del siguiente texto:\n\n${t}` },
  { label: "Con formato", build: (t) => `Reescribe y mejora el siguiente texto aplicando formato rico (titulos, negritas, colores y resaltados donde aporten):\n\n${t}` },
];

function dissect(raw: string) {
  const clean = stripReasoning(raw);
  const { text: noActions, actions } = parseActions(clean);
  const { comment, content } = splitResponse(noActions);
  return { comment, content, actions };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export default function ChatPanel({ settings, onChange }: Props) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [useSelection, setUseSelection] = useState(true);
  const [liveWrite, setLiveWrite] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [pending, setPending] = useState<Attachment[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const active = settings.active;
  const preset = getPreset(active.presetId);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await listModels(active);
      if (alive) setModels(list);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.baseUrl, active.apiKey, active.presetId]);

  // Cierra el menu al hacer clic fuera.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const options = Array.from(
    new Set([active.model, ...models, ...(preset?.sampleModels ?? [])].filter(Boolean))
  );

  function setModel(model: string) {
    onChange({ ...settings, active: { ...active, model } });
  }

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    const imgs = files.filter((f) => f.type.startsWith("image/"));
    if (imgs.length < files.length) setError("Por ahora solo se adjuntan imagenes.");
    const next: Attachment[] = [];
    for (const f of imgs) {
      try {
        next.push({ name: f.name, dataUrl: await readFileAsDataUrl(f) });
      } catch {
        /* ignora el que falle */
      }
    }
    setPending((p) => [...p, ...next]);
  }

  function removePending(idx: number) {
    setPending((p) => p.filter((_, i) => i !== idx));
  }

  async function run(prompt: string) {
    if ((!prompt.trim() && pending.length === 0) || busy) return;
    setError(null);
    setNotice(null);

    let context = "";
    if (useSelection) {
      try {
        context = await getSelectedText();
      } catch {
        /* sin seleccion */
      }
    }

    const promptText = context.trim()
      ? `${prompt}\n\n---\nTexto seleccionado en el documento:\n${context}`
      : prompt;

    const attached = pending.slice();
    let userContent: string | ContentPart[];
    if (attached.length > 0) {
      const parts: ContentPart[] = [];
      if (promptText.trim()) parts.push({ type: "text", text: promptText });
      for (const a of attached) parts.push({ type: "image_url", image_url: { url: a.dataUrl } });
      userContent = parts;
    } else {
      userContent = promptText;
    }

    const history: ChatMessage[] = [
      { role: "system", content: settings.systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content } as ChatMessage)),
      { role: "user", content: userContent },
    ];

    setMessages((m) => [
      ...m,
      { role: "user", content: prompt, images: attached.map((a) => a.dataUrl) },
      { role: "assistant", content: "" },
    ]);
    setInput("");
    setPending([]);
    setBusy(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const wref: { current: LiveWriter | null } = { current: null };
    let writtenLen = 0;

    let acc = "";
    try {
      await streamChat(
        active,
        history,
        (tok) => {
          acc += tok;
          const clean = stripReasoning(acc);
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = { role: "assistant", content: clean };
            return copy;
          });
          if (liveWrite) {
            const deliver = liveDeliverable(acc);
            if (deliver) {
              if (!wref.current) { wref.current = new LiveWriter(!useSelection); wref.current.start(); }
              if (deliver.length > writtenLen && deliver.startsWith(deliver.slice(0, writtenLen))) {
                wref.current.push(deliver.slice(writtenLen));
                writtenLen = deliver.length;
              }
            }
          }
        },
        ctrl.signal
      );
      if (wref.current) {
        const { content: fc } = splitResponse(parseActions(stripReasoning(acc)).text);
        await wref.current.finish(fc || undefined);
      }
      const { actions } = parseActions(stripReasoning(acc));
      if (actions.length) {
        try {
          const res = await runActions(actions);
          const warn = res.warnings.length
            ? ` Tu version de Word no permitio: ${Array.from(new Set(res.warnings)).join(", ")}.`
            : "";
          setNotice(`Formato aplicado al documento.${warn}`);
        } catch (e: any) {
          setError(e?.message ?? String(e));
        }
      }
    } catch (e: any) {
      if (wref.current) await wref.current.finish();
      if (e?.name !== "AbortError") setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  async function quick(build: (t: string) => string) {
    setMenuOpen(false);
    let text = "";
    try {
      text = await getSelectedText();
      if (!text.trim()) text = await getBodyText();
    } catch {
      /* noop */
    }
    if (!text.trim()) {
      setError("Selecciona texto en el documento o escribe algo primero.");
      return;
    }
    run(build(text));
  }

  function stop() {
    abortRef.current?.abort();
  }

  async function insertContent(content: string, where: "replace" | "after" | "end") {
    if (!content.trim()) return;
    try {
      await insertRich(content, where);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  const canSend = (!!input.trim() || pending.length > 0) && !busy;

  return (
    <div className="chat">
      <div className="messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="hint">
            Pide redactar, corregir o dar formato a tu documento. Usa el boton + para acciones rapidas.
          </div>
        )}
        {messages.map((m, i) => {
          if (m.role === "user") {
            return (
              <div key={i} className="bubble user" style={{ ["--index" as any]: Math.min(i, 6) }}>
                {m.images && m.images.length > 0 && (
                  <div className="msg-images">
                    {m.images.map((src, k) => (
                      <img key={k} src={src} alt="adjunto" />
                    ))}
                  </div>
                )}
                {m.content && <div className="bubble-text">{m.content}</div>}
              </div>
            );
          }

          const { comment, content } = dissect(m.content);
          const streaming = busy && i === messages.length - 1;
          const empty = !comment && !content;

          return (
            <div key={i} className="bubble assistant" style={{ ["--index" as any]: Math.min(i, 6) }}>
              <div className="bubble-role">{active.model}</div>
              {empty && <div className="bubble-text">{streaming ? "..." : ""}</div>}
              {comment && <RichPreview text={comment} />}
              {content && (
                <div className="deliverable">
                  <div className="deliverable-head">
                    <span className="deliverable-tag">Texto final</span>
                  </div>
                  <div className="deliverable-body">
                    <RichPreview text={content} />
                  </div>
                  {!streaming && (
                    <div className="bubble-actions">
                      <button className="mini" onClick={() => insertContent(content, "replace")}>Reemplazar seleccion</button>
                      <button className="mini" onClick={() => insertContent(content, "after")}>Insertar despues</button>
                      <button className="mini" onClick={() => insertContent(content, "end")}>Al final</button>
                      <button className="mini" onClick={() => navigator.clipboard.writeText(markdownToPlain(content))}>Copiar</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {notice && <div className="notice">{notice}</div>}
      {error && <div className="error">{error}</div>}

      {/* Composer integrado estilo agente */}
      <div className="composer">
        {pending.length > 0 && (
          <div className="attachments">
            {pending.map((a, i) => (
              <div key={i} className="attachment">
                <img src={a.dataUrl} alt={a.name} />
                <button className="attachment-remove" onClick={() => removePending(i)} aria-label="Quitar">x</button>
              </div>
            ))}
          </div>
        )}

        <div className="composer-box">
          <textarea
            value={input}
            placeholder="Pide algo a tu documento..."
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                run(input);
              }
            }}
            rows={2}
          />

          <div className="composer-toolbar">
            {/* Menu + : acciones rapidas y adjuntar */}
            <div className="menu-wrap" ref={menuRef}>
              <button className="tool-btn" title="Acciones" disabled={busy} onClick={() => setMenuOpen((o) => !o)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              </button>
              {menuOpen && (
                <div className="menu">
                  <button className="menu-item" onClick={() => { setMenuOpen(false); fileRef.current?.click(); }}>Adjuntar imagen</button>
                  <div className="menu-sep" />
                  {QUICK_ACTIONS.map((a) => (
                    <button key={a.label} className="menu-item" onClick={() => quick(a.build)}>{a.label}</button>
                  ))}
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/bmp"
              multiple
              style={{ display: "none" }}
              onChange={onPickFiles}
            />

            {/* Selector de modelo inline */}
            <select className="model-inline" value={active.model} onChange={(e) => setModel(e.target.value)} disabled={busy}>
              {options.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            {/* Toggles como iconos-pastilla */}
            <button
              className={useSelection ? "toggle-pill on" : "toggle-pill"}
              title="Usar seleccion como contexto"
              onClick={() => setUseSelection((v) => !v)}
            >
              Sel
            </button>
            <button
              className={liveWrite ? "toggle-pill on" : "toggle-pill"}
              title="Escribir en la hoja en vivo"
              onClick={() => setLiveWrite((v) => !v)}
            >
              Vivo
            </button>

            <div className="toolbar-spacer" />

            {busy ? (
              <button className="send-btn stop" onClick={stop} title="Detener">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
              </button>
            ) : (
              <button className="send-btn" onClick={() => run(input)} disabled={!canSend} title="Enviar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 11l5-5 5 5M12 6v13" /></svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
