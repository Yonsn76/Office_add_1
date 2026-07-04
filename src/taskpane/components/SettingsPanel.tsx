import { useState, useEffect, useRef } from "react";
import { AppSettings } from "../../store/settings";
import { PROVIDER_PRESETS, getPreset } from "../../ai/providers";
import { listModelsDetailed, chat } from "../../ai/client";
import { SYSTEM_PROMPT } from "../../ai/systemprompt";

interface Props {
  settings: AppSettings;
  onChange: (s: AppSettings) => void;
}

export default function SettingsPanel({ settings, onChange }: Props) {
  const [models, setModels] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [modelStatus, setModelStatus] = useState<string>("");
  const [modelError, setModelError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active = settings.active;
  const preset = getPreset(active.presetId);

  function patch(p: Partial<typeof active>) {
    onChange({ ...settings, active: { ...active, ...p } });
  }

  function selectPreset(id: string) {
    const ps = getPreset(id);
    onChange({
      ...settings,
      active: {
        ...active,
        presetId: id,
        baseUrl: ps && ps.id !== "custom" ? ps.baseUrl : active.baseUrl,
        model: ps?.sampleModels[0] ?? active.model,
      },
    });
    setModels([]);
    setTestResult(null);
    setModelError(null);
  }

  async function refreshModels() {
    if (!active.baseUrl) {
      setModels([]);
      setModelStatus("");
      setModelError(null);
      return;
    }
    setModelStatus("Cargando modelos...");
    setModelError(null);
    const res = await listModelsDetailed(active);
    setModels(res.models);
    if (res.models.length > 0) {
      setModelStatus(`${res.models.length} modelos disponibles`);
      if (!res.models.includes(active.model)) patch({ model: res.models[0] });
    } else {
      setModelStatus("");
      setModelError(res.error ?? "No se pudo listar modelos. Escribe el nombre manualmente.");
    }
  }

  // Auto-carga de modelos cuando cambia base URL, API key o proveedor.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(refreshModels, 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.baseUrl, active.apiKey, active.presetId]);

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const reply = await chat(active, [{ role: "user", content: "Responde solo con: OK" }]);
      setTestResult(`Conexion OK. Respuesta: ${reply.slice(0, 80)}`);
    } catch (e: any) {
      setTestResult(`Error: ${e?.message ?? String(e)}`);
    } finally {
      setTesting(false);
    }
  }

  const suggestions = Array.from(new Set([...(preset?.sampleModels ?? []), ...models]));

  return (
    <div className="settings">
      <label className="field">
        <span>Proveedor</span>
        <select value={active.presetId} onChange={(e) => selectPreset(e.target.value)}>
          {PROVIDER_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Base URL</span>
        <input
          type="text"
          value={active.baseUrl}
          placeholder="https://.../v1"
          onChange={(e) => patch({ baseUrl: e.target.value })}
        />
      </label>

      <label className="field">
        <span>API Key</span>
        <input
          type="password"
          value={active.apiKey}
          placeholder="sk-... (vacio para Ollama local)"
          onChange={(e) => patch({ apiKey: e.target.value })}
        />
      </label>

      <label className="field">
        <span>Modelo</span>
        {models.length > 0 ? (
          <select value={active.model} onChange={(e) => patch({ model: e.target.value })}>
            {!models.includes(active.model) && active.model && (
              <option value={active.model}>{active.model} (manual)</option>
            )}
            {models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            list="model-suggestions"
            value={active.model}
            placeholder="nombre-del-modelo"
            onChange={(e) => patch({ model: e.target.value })}
          />
        )}
        <datalist id="model-suggestions">
          {suggestions.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <div className="model-row">
          {modelStatus && <small className="model-status">{modelStatus}</small>}
          <button type="button" className="link-btn" onClick={refreshModels}>Recargar</button>
        </div>
        {modelError && <div className="error-box">{modelError}</div>}
      </label>

      <div className="row">
        <button className="btn ghost" onClick={testConnection} disabled={testing}>
          {testing ? "Probando..." : "Probar conexion"}
        </button>
      </div>

      <label className="field">
        <span>Temperatura: {active.temperature.toFixed(1)}</span>
        <input
          type="range"
          min={0}
          max={2}
          step={0.1}
          value={active.temperature}
          onChange={(e) => patch({ temperature: parseFloat(e.target.value) })}
        />
      </label>

      <label className="field">
        <span>System prompt (define como escribe y da formato la IA)</span>
        <textarea
          rows={5}
          value={settings.systemPrompt}
          onChange={(e) => onChange({ ...settings, systemPrompt: e.target.value })}
        />
        <button type="button" className="link-btn" onClick={() => onChange({ ...settings, systemPrompt: SYSTEM_PROMPT })}>Restaurar prompt por defecto</button>
      </label>

      {testResult && <div className="test-result">{testResult}</div>}
      {preset?.docsUrl && (
        <a className="docs-link" href={preset.docsUrl} target="_blank" rel="noreferrer">
          Documentacion de {preset.label}
        </a>
      )}
    </div>
  );
}

