import { defineConfig, loadEnv, type Plugin, type ProxyOptions } from "vite";
import { fileURLToPath, URL } from "node:url";
import { mkdirSync, writeFileSync, appendFileSync, readFileSync, existsSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { spawnCodexSession } from "./scripts/lib/codexOAuthSession.mjs";
import type { CodexSession } from "./scripts/lib/codexOAuthSession.mjs";
import { handleCompanionRequest, isCompanionPath } from "./scripts/lib/ohMyPiHttp.mjs";
import { createOhMyPiAdapters, stopOhMyPiWorker } from "./scripts/lib/ohMyPiPiAi.mjs";
import { readRequestJson, writeCompanionResult } from "./scripts/lib/companionHttpUtil.mjs";

const DEFAULT_DEV_SERVER_PORT = 9999;

/**
 * dev 서버 TLS. `https://localhost:9999` 로 접속하려면 반드시 있어야 한다.
 *
 * 이게 없던 동안 `https://localhost:9999` 는 TLS 핸드셰이크에서 죽었다(실측 curl 코드 000).
 * 서버는 살아서 http 로 200 을 주고 있었으므로 "서버가 안 뜬다"가 아니라
 * **평문 서버에 https 로 노크하고 있었던 것**이 원인이었다.
 *
 * 인증서는 자기서명이고 `.certs/` 에 두며 커밋하지 않는다. 없으면 평문 http 로 뜬다
 * (CI·컨테이너처럼 인증서를 만들지 않는 환경을 막지 않기 위해).
 * 재발급: scripts/dev-certs.sh
 */
function devServerHttps(): { key: Buffer; cert: Buffer } | undefined {
  if (process.env.DEV_SERVER_NO_TLS === "1") return undefined;
  const key = fileURLToPath(new URL("./.certs/localhost-key.pem", import.meta.url));
  const cert = fileURLToPath(new URL("./.certs/localhost-cert.pem", import.meta.url));
  if (!existsSync(key) || !existsSync(cert)) return undefined;
  return { key: readFileSync(key), cert: readFileSync(cert) };
}

/**
 * 브라우저가 Supabase 로 나갈 때 쓰는 같은-오리진 경로. `src/project/supabaseProxyPath.ts` 와 반드시 같아야 한다.
 * (순환 import 를 만들지 않기 위해 값만 복제하고, 계약은 테스트가 고정한다.)
 */
const SUPABASE_PROXY_PATH = "/supabase";

/** /supabase 프록시가 바라보는 실제 Supabase(Kong) 오리진. */
function supabaseUpstreamUrl(mode: string): string {
  const env = loadEnv(mode, process.cwd(), "");
  const raw = (env.SUPABASE_UPSTREAM_URL ?? env.VITE_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
  // 상대 경로(이미 프록시 경로로 설정된 경우)는 업스트림이 될 수 없다.
  return /^https?:\/\//.test(raw) ? raw : "http://dbserver:8100";
}

function devServerPort(mode: string): number {
  const rawPort = loadEnv(mode, process.cwd(), "").DEV_SERVER_PORT;
  const port = Number(rawPort ?? DEFAULT_DEV_SERVER_PORT);
  return Number.isInteger(port) && port > 0 ? port : DEFAULT_DEV_SERVER_PORT;
}

// 게이트웨이 키는 서버 전용 APITOPIA_API_KEY (non-VITE) 에서 읽는다 — 클라이언트 번들에 인라인되지
// 않는다. Vite 는 .env/.env.local 을 process.env 에 넣지 않으므로 반드시 loadEnv 로 읽어야 한다.
// (과거 `process.env.APITOPIA_API_KEY` 직접 읽기는 항상 undefined 여서 `Authorization: "Bearer "`
// 빈 값이 게이트웨이로 전송됐다 — 인증이 조용히 실패하던 원인.)
function gatewayApiKey(mode: string): string {
  const fromEnvFiles = loadEnv(mode, process.cwd(), "").APITOPIA_API_KEY;
  return (fromEnvFiles ?? process.env.APITOPIA_API_KEY ?? "").trim();
}

// qwencloud(알리바바 MaaS OpenAI 호환) 경로 /api/qwen 의 키도 서버 전용 QWENCLOUD_API_KEY (non-VITE)
// 에서 읽는다 — gatewayApiKey 와 같은 이유: Vite 는 .env 를 process.env 에 넣지 않으므로 loadEnv 필수.
function qwenCloudApiKey(mode: string): string {
  const fromEnvFiles = loadEnv(mode, process.cwd(), "").QWENCLOUD_API_KEY;
  return (fromEnvFiles ?? process.env.QWENCLOUD_API_KEY ?? "").trim();
}

// cpenrouter.space(OpenAI 호환 게이트웨이) 경로 /api/cpen 의 키도 서버 전용 CPENROUTER_API_KEY
// (non-VITE) 에서 읽는다 — gatewayApiKey 와 같은 이유: Vite 는 .env 를 process.env 에 넣지 않으므로
// loadEnv 필수.
function cpenRouterApiKey(mode: string): string {
  const fromEnvFiles = loadEnv(mode, process.cwd(), "").CPENROUTER_API_KEY;
  return (fromEnvFiles ?? process.env.CPENROUTER_API_KEY ?? "").trim();
}

// 루프백 여부 판정 — IPv4/IPv6/IPv4-mapped-IPv6 모두 커버.
function isLoopbackAddress(address: string | undefined): boolean {
  if (!address) return false;
  const host = address.replace(/^::ffff:/, "");
  return host === "::1" || host.startsWith("127.");
}

// /api/ai, /api/qwen, /api/cpen 프록시는 서버 측에서 유료 게이트웨이 키를 주입한다. dev 서버는
// 0.0.0.0 에 바인드되므로 (LAN 기기 테스트용) 가드 없이는 같은 네트워크의 누구나 이 경로로 키를
// 무제한 사용할 수 있다 — 오픈 릴레이. 아래 CORS 미들웨어와 동일한 위협 모델을 프록시에도 적용한다.
// Origin 헤더는 위조 가능하므로 소켓 원격 주소가 루프백인지로 판정한다.
const LOCAL_ONLY_PROXY_PATHS = ["/api/ai", "/api/qwen", "/api/cpen"] as const;
function localOnlyAiProxyPlugin(): Plugin {
  return {
    name: "rpgzzu-local-only-ai-proxy",
    // configureServer 에서 반환 함수를 쓰지 않고 즉시 등록하면 내부 proxy 미들웨어보다 앞선다.
    configureServer(server) {
      for (const proxyPath of LOCAL_ONLY_PROXY_PATHS) {
        server.middlewares.use(proxyPath, (req, res, next) => {
          if (isLoopbackAddress(req.socket?.remoteAddress ?? undefined)) return next();
          res.statusCode = 403;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.end(`forbidden: ${proxyPath} is loopback-only (the gateway key is injected server-side)`);
        });
      }
    },
  };
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

// DEV-only same-origin bridge to the local codex app-server (ChatGPT OAuth).
// Removes the need to run `npm run ai:oauth` alongside `npm run dev` — the browser
// hits /auth/* and /v1/chat/completions on the same dev port. preview/dist still
// route to the standalone 127.0.0.1:17832 companion (npm run ai:oauth).
function codexOAuthPlugin(): Plugin {
  let session: CodexSession | null = null;
  let sessionPromise: Promise<CodexSession> | null = null;
  let adaptersPromise: ReturnType<typeof createOhMyPiAdapters> | null = null;
  function getSession(): Promise<CodexSession> {
    if (!sessionPromise) {
      sessionPromise = (async () => {
        session = spawnCodexSession();
        await session.ready();
        return session;
      })();
      sessionPromise.catch(() => {
        sessionPromise = null;
      });
    }
    return sessionPromise;
  }
  function getAdapters() {
    if (!adaptersPromise) adaptersPromise = createOhMyPiAdapters({ getCodexSession: getSession });
    return adaptersPromise;
  }
  function errorStatus(error: unknown): number {
    if (error && typeof error === "object" && "status" in error) {
      const status = (error as { status: unknown }).status;
      if (typeof status === "number") return status;
    }
    return 500;
  }
  return {
    name: "rpgzzu-codex-oauth",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? "";
        if (!isCompanionPath(url)) return next();
        try {
          if (req.method === "OPTIONS") {
            res.statusCode = 204;
            res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
            res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Rpgzzu-Provider");
            res.end();
            return;
          }
          const body = await readRequestJson(req);
          const result = await handleCompanionRequest(
            { method: req.method, url, headers: req.headers as Record<string, string>, body },
            await getAdapters(),
          );
          writeCompanionResult(res, result);
        } catch (error) {
          res.statusCode = errorStatus(error);
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : "OAuth dev bridge failed" }));
        }
      });
      server.httpServer?.on("close", () => {
        session?.kill();
        session = null;
        sessionPromise = null;
        adaptersPromise = null;
        stopOhMyPiWorker();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const apitopiaKey = gatewayApiKey(mode);
  if (!apitopiaKey) {
    // 키가 없으면 프록시를 아예 등록하지 않는다 — 빈 Bearer 로 401 을 받고 원인을 못 찾는 대신
    // /api/ai 가 404 로 명확히 실패하고, 클라이언트의 "API 키 없음" 안내가 정상 동작한다.
    console.warn(
      "[rpg-zzu] APITOPIA_API_KEY 가 없어 /api/ai 프록시를 등록하지 않습니다. .env.local 에 키를 넣으세요."
    );
  }
  const qwenKey = qwenCloudApiKey(mode);
  if (!qwenKey) {
    console.warn(
      "[rpg-zzu] QWENCLOUD_API_KEY 가 없어 /api/qwen 프록시를 등록하지 않습니다. .env.local 에 키를 넣으세요."
    );
  }
  const cpenKey = cpenRouterApiKey(mode);
  if (!cpenKey) {
    console.warn(
      "[rpg-zzu] CPENROUTER_API_KEY 가 없어 /api/cpen 프록시를 등록하지 않습니다. .env.local 에 키를 넣으세요."
    );
  }
  // 키가 있는 경로만 프록시를 등록한다(빈 Bearer 전송 금지). 접근은 localOnlyAiProxyPlugin 이 루프백으로 제한.
  const proxy: Record<string, ProxyOptions> = {};
  // Supabase(Kong) 는 평문 HTTP 라, dev 서버를 HTTPS 로 열면 브라우저가 mixed content 로 차단한다.
  // 같은 오리진의 /supabase 로 프록시해 두면 페이지 프로토콜과 무관하게 항상 붙는다(CORS 도 불필요).
  // 업스트림은 .env 의 절대 URL 을 그대로 쓴다 — node 스크립트들이 같은 값을 쓰므로 .env 는 절대 URL 로 유지한다.
  proxy[SUPABASE_PROXY_PATH] = {
    target: supabaseUpstreamUrl(mode),
    changeOrigin: true,
    rewrite: (path: string) => path.replace(new RegExp(`^${SUPABASE_PROXY_PATH}`), ""),
  };
  if (apitopiaKey) {
    proxy["/api/ai"] = {
      target: "https://apitopia.labs.mengmota.com/v1",
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/api\/ai/, ""),
      headers: {
        Authorization: `Bearer ${apitopiaKey}`,
      },
    };
  }
  if (qwenKey) {
    // qwencloud(알리바바 MaaS) OpenAI 호환 엔드포인트. rewrite 로 /api/qwen 접두사를 제거하면
    // /api/qwen/chat/completions → target 뒤의 /compatible-mode/v1/chat/completions 로 이어진다.
    proxy["/api/qwen"] = {
      target: "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1",
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/api\/qwen/, ""),
      headers: {
        Authorization: `Bearer ${qwenKey}`,
      },
    };
  }
  if (cpenKey) {
    // cpenrouter.space OpenAI 호환 게이트웨이(라이브 검증: POST /v1/chat/completions, GET /v1/models).
    // rewrite 로 /api/cpen 접두사를 제거하면 /api/cpen/chat/completions → target 뒤의
    // /chat/completions, 즉 https://cpenrouter.space/v1/chat/completions 로 이어진다.
    proxy["/api/cpen"] = {
      target: "https://cpenrouter.space/v1",
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/api\/cpen/, ""),
      headers: {
        Authorization: `Bearer ${cpenKey}`,
      },
    };
  }
  return {
  plugins: [aiActivityDiskPlugin(), codexOAuthPlugin(), localOnlyAiProxyPlugin()],
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
    // 인증서가 있으면 https 로 뜬다. 없으면 평문 http (undefined = vite 기본).
    https: devServerHttps(),
    fs: {
      // 워크트리에서 node_modules 를 정션(mklink /J)으로 쓰면 @fs 실경로가 원본 저장소의
      // node_modules 로 풀린다 — 기본 allow(워크스페이스 루트)만으로는 403. 그 경로만 추가 허용.
      allow: (() => {
        const roots = [fileURLToPath(new URL("./", import.meta.url)), fileURLToPath(new URL("../rpg-zzu/node_modules", import.meta.url))];
        for (const root of [...roots]) {
          try {
            const real = realpathSync(root);
            if (real !== root) roots.push(real);
          } catch {
          }
        }
        return [...new Set(roots)];
      })(),
    },
    watch: {
      ignored: ["**/.omo/**", "**/output/**", "**/tmp/**", "**/test-results/**"],
    },
    // 상대 baseUrl(/api/ai, /api/qwen, /api/cpen)을 쓰는 클라이언트는 Authorization 을 보내지 않고
    // 이 프록시가 주입한다. 키가 없는 경로는 등록하지 않는다(빈 Bearer 전송 금지). 접근은
    // localOnlyAiProxyPlugin 이 루프백으로 제한.
    proxy: Object.keys(proxy).length > 0 ? proxy : undefined,
  },
  preview: {
    host: "127.0.0.1",
    port: 9888,
    strictPort: true,
    https: devServerHttps(),
    proxy: Object.keys(proxy).length > 0 ? proxy : undefined,
  },
  build: {
    // MPA: 루트 index.html(에디터)과 benchmark.html(벤치마크 사이트)을 각각 엔트리로
    // 빌드한다. dev 서버에서는 /benchmark.html 이 그대로 서빙된다.
    // `main` 을 명시해야 기본 엔트리(index.html)가 benchmark 추가 시 사라지지 않는다.
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        benchmark: fileURLToPath(new URL("./benchmark.html", import.meta.url)),
      },
    },
    target: "es2022",
    sourcemap: false,
  },
  };
});
