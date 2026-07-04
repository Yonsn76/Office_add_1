import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./composer.css";

/* global Office */
Office.onReady(() => {
  const container = document.getElementById("root");
  if (container) {
    createRoot(container).render(<App />);
  }
});
