import { defineConfig, loadEnv, type Plugin } from "vite";
import { fileURLToPath, URL } from "node:url";
import { mkdirSync, writeFileSync, appendFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_DEV_SERVER_PORT = 9999;

function devServerPort(mode: string): number {
  const rawPort = loadEnv(mode, process.cwd(), "").DEV_SERVER_PORT;
  const port = Number(rawPort ?? DEFAULT_DEV_SERVER_PORT);
  return Number.isInteger(port) && port > 0 ? port : DEFAULT_DEV_SERVER_PORT;
}

// 같은 머신의 Vite dev 서버(localhost/127.0.0.1, 임의 포트)만 허용 — CORS "*"는 열려 있는
// 아무 탭(신뢰 못 하는 웹사이트 포함)이 이 미들웨어를 호출할 수 있게 만든다.
const DEV_ALLOWED_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
// output/ai-activity/ 밖으로 쓰지 못하게 강제 — 영숫자/-/_ 만 허용(경로 구분자·`..` 차단).
const SAFE_ACTIVITY_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

function devCorsOrigin(req: { headers: { origin?: string | string[] } }): string | null {
  const origin = req.headers.origin;
  return typeof origin === "string" && DEV_ALLOWED_ORIGIN_PATTERN.test(origin) ? origin : null;
}

/** AI 활동 로그를 output/ai-activity/ 에 미러 — 에이전트가 디스크에서 바로 읽음. */
function aiActivityDiskPlugin(): Plugin {
  const dir = join(process.cwd(), "output", "ai-activity");
  return {
    name: "rpgzzu-ai-activity-disk",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/__rpgzzu/ai-activity")) return next();
        const allowedOrigin = devCorsOrigin(req);
        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          if (allowedOrigin) res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
          res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
          res.setHeader("Access-Control-Allow-Headers", "Content-Type");
          res.end();
          return;
        }
        if (req.method === "GET") {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          if (allowedOrigin) res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
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
            // record.id는 클라이언트가 보내는 값 그대로다 — join()은 ".." 세그먼트를 그대로
            // 해석하므로 검증 없이 파일명에 쓰면 output/ai-activity/ 밖으로 경로 탈출이 가능하다.
            const id =
              typeof record.id === "string" && SAFE_ACTIVITY_ID_PATTERN.test(record.id)
                ? record.id
                : `log_${Date.now()}`;
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
            if (allowedOrigin) res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
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
    host: "0.0.0.0",
    port: devServerPort(mode),
    strictPort: true,
    allowedHosts: true,
    open: false,
    fs: {
      // 워크트리에서 node_modules 를 정션(mklink /J)으로 쓰면 @fs 실경로가 원본 저장소의
      // node_modules 로 풀린다 — 기본 allow(워크스페이스 루트)만으로는 403. 그 경로만 추가 허용.
      allow: [
        fileURLToPath(new URL("./", import.meta.url)),
        fileURLToPath(new URL("../rpg-zzu/node_modules", import.meta.url)),
      ],
    },
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
