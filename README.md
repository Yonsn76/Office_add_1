# AI Writing Assistant para Word

Asistente de escritura con IA como Office Add-in (React + TypeScript). Conecta modelos por API de cualquier proveedor OpenAI-compatible: **Ollama Cloud**, **opencode**, **OpenAI**, **OpenRouter** o uno personalizado.

## Requisitos
- Node.js 18+
- Microsoft Word (escritorio, Microsoft 365) o Word en la web

## Instalacion
```bash
npm install
npm run certs   # instala el certificado de desarrollo (solo la primera vez)
```

## Desarrollo
```bash
npm run dev     # inicia el servidor en https://localhost:3000
```
En otra terminal, para cargar el add-in en Word automaticamente:
```bash
npm start
```
O carga manualmente `manifest.xml` via Insertar > Complementos > Cargar mi complemento (sideload).

## Uso
1. Abre el panel desde la pestana **Inicio > Abrir asistente**.
2. Ve a **Ajustes**, elige proveedor, pega tu API key y modelo. Usa **Probar conexion**.
   - Ollama Cloud: Base URL `https://ollama.com/v1`, API key de tu cuenta Ollama.
   - Ollama local: Base URL `http://localhost:11434/v1`, sin API key.
   - opencode / otros: pega su Base URL OpenAI-compatible.
3. En **Chat**: selecciona texto en el documento y usa las acciones rapidas (Mejorar, Resumir, Traducir, Corregir, Alargar) o escribe una instruccion.
4. Inserta la respuesta en el documento con **Reemplazar seleccion**, **Insertar despues** o **Al final del doc**.

## Estructura
```
src/
  ai/           capa de proveedores + cliente de streaming (OpenAI-compatible)
  store/        ajustes persistidos en localStorage
  word/         helpers de Office.js (leer/insertar texto)
  taskpane/     UI de React (chat + ajustes)
  commands/     entrada de comandos de la cinta
manifest.xml    definicion del add-in
```

## Notas
- Las API keys se guardan en el localStorage del panel, en tu equipo.
- Todos los proveedores usan el endpoint `POST /chat/completions` con `stream: true`.
- Para produccion: `npm run build` genera `dist/` y actualiza las URLs del manifest a tu dominio HTTPS.
