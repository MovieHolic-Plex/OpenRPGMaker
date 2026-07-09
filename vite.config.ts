import { defineConfig, loadEnv, type Plugin } from "vite";
import { fileURLToPath, URL } from "node:url";
import { mkdirSync, writeFileSync, appendFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_DEV_SERVER_PORT = 9173;

function devServerPort(mode: string): number {
  const rawPort = loadEnv(mode, process.cwd(), "").DEV_SERVER_PORT;
  const port = Number(rawPort ?? DEFAULT_DEV_SERVER_PORT);
  return Number.isInteger(port) && port > 0 ? port : DEFAULT_DEV_SERVER_PORT;
}

/** AI 활동 로그를 output/ai-activity/ 에 미러 — 에이전트가 디스크에서 바로 읽음. */
function aiActivityDiskPlugin(): Plugin {
  const dir = join(process.cwd(), "output", "ai-activity");
  return {
    name: "rpgzzu-ai-activity-disk",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/__rpgzzu/ai-activity")) return next();
        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
          res.setHeader("Access-Control-Allow-Headers", "Content-Type");
          res.end();
          return;
        }
        if (req.method === "GET") {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.setHeader("Access-Control-Allow-Origin", "*");
          const latestPath = join(dir, "latest.json");
          const listPath = join(dir, "index.json");
          if (req.url.includes("list") && existsSync(listPath)) {
            res.end(readFileSync(listPath, "utf8"));
            return;
          }
          if (existsSync(latestPath)) {
            res.end(readFileSync(latestPath, "utf8"));
            return;
          }
          res.end("[]");
          return;
        }
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("method not allowed");
          return;
        }
        const chunks: Buffer[] = [];
        req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        req.on("end", () => {
          try {
            mkdirSync(dir, { recursive: true });
            const raw = Buffer.concat(chunks).toString("utf8");
            const record = JSON.parse(raw) as { id?: string; at?: string; instruction?: string };
            writeFileSync(join(dir, "latest.json"), JSON.stringify(JSON.parse(raw), null, 2), "utf8");
            appendFileSync(join(dir, "activity.jsonl"), `${raw.replace(/\n/g, " ")}\n`, "utf8");
            const id = typeof record.id === "string" ? record.id : `log_${Date.now()}`;
            writeFileSync(join(dir, `${id}.json`), JSON.stringify(JSON.parse(raw), null, 2), "utf8");
            // index: last 50 summaries
            let index: unknown[] = [];
            const indexPath = join(dir, "index.json");
            if (existsSync(indexPath)) {
              try {
                index = JSON.parse(readFileSync(indexPath, "utf8")) as unknown[];
              } catch {
                index = [];
              }
            }
            const summary = {
              id,
              at: record.at ?? new Date().toISOString(),
              instruction: record.instruction ?? "",
            };
            const next = [summary, ...index.filter((row) => (row as { id?: string }).id !== id)].slice(0, 50);
            writeFileSync(indexPath, JSON.stringify(next, null, 2), "utf8");
            res.statusCode = 204;
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.end();
          } catch (error) {
            res.statusCode = 400;
            res.end(error instanceof Error ? error.message : "bad request");
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [aiActivityDiskPlugin()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
    extensions: [".ts", ".js"],
  },
  server: {
    host: "::",
    port: devServerPort(mode),
    strictPort: true,
    allowedHosts: ["mdc-server"],
    open: false,
    watch: {
      ignored: ["**/.omo/**", "**/output/**", "**/tmp/**", "**/test-results/**"],
    },
    proxy: {
      "/api/ai": {
        target: "https://yunwu.ai/v1",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ai/, ""),
      },
    },
  },
  build: {
    target: "es2022",
    sourcemap: false,
  },
}));
