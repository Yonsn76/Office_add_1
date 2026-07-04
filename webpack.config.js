const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const devCerts = require("office-addin-dev-certs");

module.exports = async (env, options) => {
  const dev = options.mode === "development";
  const httpsOptions = await devCerts.getHttpsServerOptions();

  return {
    devtool: "source-map",
    entry: {
      taskpane: "./src/taskpane/index.tsx",
      commands: "./src/commands/commands.ts",
    },
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "[name].js",
      clean: true,
    },
    resolve: {
      extensions: [".ts", ".tsx", ".js", ".jsx"],
    },
    module: {
      rules: [
        {
          test: /\.(ts|tsx)$/,
          exclude: /node_modules/,
          use: "babel-loader",
        },
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader"],
        },
        {
          test: /\.(png|jpg|jpeg|gif|ico|svg)$/,
          type: "asset/resource",
          generator: { filename: "assets/[name][ext]" },
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        filename: "taskpane.html",
        template: "./src/taskpane/taskpane.html",
        chunks: ["taskpane"],
      }),
      new HtmlWebpackPlugin({
        filename: "commands.html",
        template: "./src/commands/commands.html",
        chunks: ["commands"],
      }),
      new CopyWebpackPlugin({
        patterns: [{ from: "assets", to: "assets" }],
      }),
    ],
    devServer: {
      headers: { "Access-Control-Allow-Origin": "*" },
      server: {
        type: "https",
        options: { key: httpsOptions.key, cert: httpsOptions.cert, ca: httpsOptions.ca },
      },
      port: 3000,
      hot: true,
      // Proxy anti-CORS: el cliente llama /__ai_proxy/... con el header
      // x-ai-target = base URL real del proveedor. El dev-server reenvia la
      // peticion server-side (sin CORS) al proveedor y devuelve la respuesta.
      proxy: [
        {
          context: ["/__ai_proxy"],
          target: "https://opencode.ai", // placeholder, se sobreescribe con router()
          changeOrigin: true,
          secure: false,
          ws: false,
          router: (req) => {
            const t = req.headers["x-ai-target"];
            if (t) return new URL(String(t)).origin;
            return undefined;
          },
          pathRewrite: (reqPath, req) => {
            const t = req.headers["x-ai-target"];
            const basePath = t ? new URL(String(t)).pathname.replace(/\/+$/, "") : "";
            return reqPath.replace(/^\/__ai_proxy/, basePath);
          },
          onProxyReq: (proxyReq) => {
            // No reenviar el header interno al proveedor.
            proxyReq.removeHeader("x-ai-target");
          },
        },
      ],
    },
  };
};
