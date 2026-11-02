const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const devCerts = require("office-addin-dev-certs");

const urlDev = "https://localhost:3000/";
const urlProd = "https://circleratio.github.io/outlook_calendar_template/";

module.exports = async (_env, options) => {
  const dev = options.mode === "development";

  return {
    devtool: dev ? "source-map" : false,
    entry: {
      taskpane: "./src/taskpane/taskpane.ts",
    },
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "[name].js",
      clean: true,
    },
    resolve: {
      extensions: [".ts", ".js"],
    },
    module: {
      rules: [{ test: /\.ts$/, use: "ts-loader", exclude: /node_modules/ }],
    },
    plugins: [
      new HtmlWebpackPlugin({
        filename: "taskpane.html",
        template: "./src/taskpane/taskpane.html",
        chunks: ["taskpane"],
      }),
      new CopyWebpackPlugin({
        patterns: [
          { from: "src/taskpane/taskpane.css", to: "taskpane.css" },
          { from: "assets/*", to: "assets/[name][ext]" },
          {
            from: "manifest.xml",
            to: "manifest.xml",
            transform: (content) => (dev ? content : content.toString().replaceAll(urlDev, urlProd)),
          },
        ],
      }),
    ],
    devServer: {
      port: 3000,
      headers: { "Access-Control-Allow-Origin": "*" },
      server: { type: "https", options: dev ? await devCerts.getHttpsServerOptions() : {} },
    },
  };
};
