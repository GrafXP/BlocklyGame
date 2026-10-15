import { defineConfig } from "vite";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Blockly's cursors, sprites and sounds, served from this app at /blockly-media/
// (src/blockly/workspace.js sets Blockly's `media` option to it). Left alone,
// Blockly fetches them from static.blockly.com, which an offline game can't reach
// and a CSP of default-src 'self' blocks. The dev server serves them straight from
// node_modules; a build copies them into dist.
const MEDIA_URL = "/blockly-media/";
const MEDIA_DIR = fileURLToPath(new URL("./node_modules/blockly/media/", import.meta.url));
const TYPES = {
  ".cur": "image/vnd.microsoft.icon",
  ".gif": "image/gif",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function blocklyMedia() {
  return {
    name: "blockly-media",
    configureServer(server) {
      server.middlewares.use(MEDIA_URL, (req, res, next) => {
        const name = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "");
        const file = join(MEDIA_DIR, name);
        if (!name || name.includes("..") || !existsSync(file)) return next();
        res.setHeader("Content-Type", TYPES[extname(name)] ?? "application/octet-stream");
        res.end(readFileSync(file));
      });
    },
    generateBundle() {
      for (const name of readdirSync(MEDIA_DIR)) {
        this.emitFile({ type: "asset", fileName: `${MEDIA_URL.slice(1)}${name}`, source: readFileSync(join(MEDIA_DIR, name)) });
      }
    },
  };
}

export default defineConfig({
  plugins: [blocklyMedia()],
  build: {
    // Blockly alone is about 0.7 MB before compression; the lab page loads it on
    // demand, so the warning says nothing new.
    chunkSizeWarningLimit: 1500,
    rolldownOptions: {
      // English is bundled (src/i18n/index.js), and its files also match the
      // pattern that fetches other languages' on demand; that fetch never runs
      // for English, which is what the warning is about.
      onwarn(warning, warn) {
        if (warning.code === "INEFFECTIVE_DYNAMIC_IMPORT" && /src[\\/]i18n[\\/]en[\\/]/.test(warning.message)) return;
        warn(warning);
      },
    },
  },
});
