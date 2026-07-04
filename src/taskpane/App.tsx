import { useState, useEffect } from "react";
import { AppSettings, loadSettings, saveSettings } from "../store/settings";
import ChatPanel from "./components/ChatPanel";
import SettingsPanel from "./components/SettingsPanel";

type Tab = "chat" | "settings";

export default function App() {
  const [tab, setTab] = useState<Tab>("chat");
  const [settings, setSettings] = useState<AppSettings>(loadSettings());

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const configured = !!settings.active.model && !!settings.active.baseUrl;

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <div className="brand-dots" aria-hidden="true">
            <span /><span /><span />
          </div>
          <span className="brand-name">Asistente</span>
        </div>
        <nav className="tabs">
          <button className={tab === "chat" ? "tab active" : "tab"} onClick={() => setTab("chat")}>
            Redactar
          </button>
          <button
            className={tab === "settings" ? "tab-icon active" : "tab-icon"}
            onClick={() => setTab(tab === "settings" ? "chat" : "settings")}
            title="Ajustes"
            aria-label="Ajustes"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </nav>
      </header>

      <main className="app-body">
        {tab === "chat" ? (
          configured ? (
            <ChatPanel settings={settings} onChange={setSettings} />
          ) : (
            <div className="empty">
              <p>Conecta un proveedor de IA para empezar a redactar.</p>
              <button className="btn primary" onClick={() => setTab("settings")}>
                Configurar proveedor
              </button>
            </div>
          )
        ) : (
          <SettingsPanel settings={settings} onChange={setSettings} />
        )}
      </main>
    </div>
  );
}
