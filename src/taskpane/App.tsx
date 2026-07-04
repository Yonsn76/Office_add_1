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
          <button className={tab === "settings" ? "tab active" : "tab"} onClick={() => setTab("settings")}>
            Ajustes
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
