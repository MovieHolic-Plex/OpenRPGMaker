import { defineConfig, loadEnv, type Plugin, type PreviewServer, type ProxyOptions, type ViteDevServer } from "vite";
import { fileURLToPath, URL } from "node:url";
import {
  mkdirSync,
  writeFileSync,
  appendFileSync,
  readFileSync,
  existsSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import { join } from "node:path";
import { handleCompanionRequest, isCompanionPath } from "./scripts/lib/ohMyPiHttp.mjs";
import { createOhMyPiAdapters, stopOhMyPiWorker } from "./scripts/lib/ohMyPiPiAi.mjs";
import type { OhMyPiAdapters } from "./scripts/lib/ohMyPiPiAi.mjs";
import { readRequestJson, writeCompanionResult } from "./scripts/lib/companionHttpUtil.mjs";
import { devPlayerBundlesPlugin } from "./scripts/lib/devPlayerBundles";
import { audioDeliveryPlugin } from "./scripts/lib/audioDelivery";
import { bgmInstallPlugin } from "./scripts/lib/bgmInstall";

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

/**
 * /supabase 프록시가 주입하는 Supabase anon 키. 서버 전용(non-VITE) 이라 클라이언트 번들에
 * 인라인되지 않는다 — /api/ai 와 정확히 같은 패턴이다.
 *
 * 왜: VITE_SUPABASE_ANON_KEY 는 접두사 때문에 번들에 그대로 박힌다. 지금 rpg_zzu 는 RLS 가
 * 없고(DRAFT_20260706_auth_rls.sql 미적용) anon 에게 SELECT/INSERT/UPDATE 가 열려 있으므로,
 * 빌드 산출물을 받은 사람은 전체 프로젝트·AI 대화·활동 로그를 읽고 쓸 수 있다
 * (2026-08-29 실측: project_id 필터 없이 ai_activity_logs 12,735행 전체 조회됨).
 * 키를 서버에 두면 그 열람 통로가 이 오리진 경유로 좁아진다.
 */
function supabaseAnonKey(mode: string): string {
  const fromEnvFiles = loadEnv(mode, process.cwd(), "").SUPABASE_ANON_KEY;
  return (fromEnvFiles ?? process.env.SUPABASE_ANON_KEY ?? "").trim();
}

/** 브라우저가 프록시 모드로 뜨는지(클라이언트에 실 키를 주지 않는 모드). */
function supabaseUseProxy(mode: string): boolean {
  const raw = (loadEnv(mode, process.cwd(), "").VITE_SUPABASE_USE_PROXY ?? "").trim();
  return raw === "1" || raw === "true";
}

// 루프백 여부 판정 — IPv4/IPv6/IPv4-mapped-IPv6 모두 커버.
function isLoopbackAddress(address: string | undefined): boolean {
  if (!address) return false;
  const host = address.replace(/^::ffff:/, "");
  return host === "::1" || host.startsWith("127.");
}

// /api/ai 프록시는 서버 측에서 유료 게이트웨이 키를 주입한다. dev 서버는
// 0.0.0.0 에 바인드되므로 (LAN 기기 테스트용) 가드 없이는 같은 네트워크의 누구나 이 경로로 키를
// 무제한 사용할 수 있다 — 오픈 릴레이. 아래 CORS 미들웨어와 동일한 위협 모델을 프록시에도 적용한다.
// Origin 헤더는 위조 가능하므로 소켓 원격 주소가 루프백인지로 판정한다.
const LOCAL_ONLY_PROXY_PATHS = ["/api/ai"] as const;
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
/**
 * AI 활동 로그 디스크 미러 경로. `src/ai/activityLogEndpoint.ts` 의 AI_ACTIVITY_DISK_ENDPOINT 와
 * 반드시 같아야 한다(값만 복제하고 계약은 test/aiActivityLogEndpoint.test.ts 가 고정한다).
 */
const AI_ACTIVITY_DISK_ENDPOINT = "/__oprn/ai-activity";
/**
 * 편집 행위 로그 디스크 미러 경로. `src/editor/editActivityEndpoint.ts` 의
 * EDIT_ACTIVITY_DISK_ENDPOINT 와 반드시 같아야 한다(값만 복제하고 계약은
 * test/editActivityEndpoint.test.ts 가 고정한다 — AI 쪽에서 리네임 드리프트로 404 가
 * 조용히 나던 전례가 있다).
 */
const EDIT_ACTIVITY_DISK_ENDPOINT = "/__oprn/edit-activity";
/**
 * 배치 본문 상한(2 MiB). 편집 행위 미러는 1500ms 마다 큐 전체를 보내므로 정상 배치는
 * 수십 KiB 다. 상한이 없으면 스트로크 폭풍이나 오작동 클라이언트가 edits.jsonl 을
 * 무한히 키운다 — 초과분은 413 으로 끊고 클라이언트가 미러를 스스로 끄게 한다.
 */
const EDIT_ACTIVITY_MAX_BODY_BYTES = 2 * 1024 * 1024;
/** index.json 요약 보존 개수. 링버퍼(500)·localStorage(200) 와 같은 자리수로 맞춘다. */
const EDIT_ACTIVITY_INDEX_LIMIT = 200;

/** 미러가 실제로 읽는 필드만 선언한 JSON 경계 타입(전체 레코드는 src/ai/activityLogTypes.ts). */
type AiActivityMirrorRecord = {
  id?: string;
  at?: string;
  channel?: string;
  instruction?: string;
  result?: { ok?: boolean; error?: string; stoppedReason?: string };
  toolCalls?: { name?: string; ok?: boolean }[];
  diagnostics?: { severity?: "ok" | "warning" | "error"; kinds?: string[]; failedTools?: string[] };
};

function devCorsOrigin(req: { headers: { origin?: string | string[] } }): string | null {
  const origin = req.headers.origin;
  return typeof origin === "string" && DEV_ALLOWED_ORIGIN_PATTERN.test(origin) ? origin : null;
}

/** AI 활동 로그를 output/ai-activity/ 에 미러 — 에이전트가 디스크에서 바로 읽음. */
function aiActivityDiskPlugin(): Plugin {
  const dir = join(process.cwd(), "output", "ai-activity");
  // dev 와 preview 양쪽에 같은 미들웨어를 단다. configureServer 만 있던 동안 `vite preview`
  // (9888)로 접속한 에디터의 AI 활동 로그는 POST 가 404 로 떨어지고 클라이언트가 catch{} 로
  // 삼켜서 디스크에 한 줄도 남지 않았다(2026-08-28 실측: 사용자가 실제로 친 지시가 유실).
  function attachActivityMirror(server: ViteDevServer | PreviewServer) {
    server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith(AI_ACTIVITY_DISK_ENDPOINT)) return next();
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
            const record = JSON.parse(raw) as AiActivityMirrorRecord;
            const pretty = JSON.stringify(record, null, 2);
            writeFileSync(join(dir, "latest.json"), pretty, "utf8");
            appendFileSync(join(dir, "activity.jsonl"), `${raw.replace(/\n/g, " ")}\n`, "utf8");
            // record.id는 클라이언트가 보내는 값 그대로다 — join()은 ".." 세그먼트를 그대로
            // 해석하므로 검증 없이 파일명에 쓰면 output/ai-activity/ 밖으로 경로 탈출이 가능하다.
            const id =
              typeof record.id === "string" && SAFE_ACTIVITY_ID_PATTERN.test(record.id)
                ? record.id
                : `log_${Date.now()}`;
            writeFileSync(join(dir, `${id}.json`), pretty, "utf8");
            // index: last 50 summaries
            let index: { id?: string }[] = [];
            const indexPath = join(dir, "index.json");
            if (existsSync(indexPath)) {
              try {
                index = JSON.parse(readFileSync(indexPath, "utf8")) as { id?: string }[];
              } catch {
                index = [];
              }
            }
            // 요약에 실패 신호를 같이 넣는다 — QA 가 index.json 만 보고 실패 턴을 골라낼 수 있어야 한다.
            const failedTools = (record.toolCalls ?? [])
              .filter((call) => call.ok === false)
              .map((call) => call.name ?? "?");
            const summary = {
              id,
              at: record.at ?? new Date().toISOString(),
              channel: record.channel ?? "other",
              ok: record.result?.ok !== false,
              instruction: record.instruction ?? "",
              ...(record.result?.error ? { error: record.result.error } : {}),
              ...(record.result?.stoppedReason ? { stoppedReason: record.result.stoppedReason } : {}),
              toolCalls: (record.toolCalls ?? []).length,
              ...(failedTools.length > 0 ? { failedTools } : {}),
              ...(record.diagnostics ? { diagnostics: record.diagnostics } : {}),
            };
            const next = [summary, ...index.filter((row) => row.id !== id)].slice(0, 50);
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
  }
  return {
    name: "rpgzzu-ai-activity-disk",
    configureServer(server) {
      attachActivityMirror(server);
    },
    configurePreviewServer(server) {
      attachActivityMirror(server);
    },
  };
}

/** 미러가 실제로 읽는 필드만 선언한 JSON 경계 타입(전체 레코드는 src/editor/editActivityLog.ts). */
type EditActivityMirrorEntry = {
  seq?: number;
  at?: string;
  scope?: string;
  label?: string | null;
  origin?: string;
  mapId?: string;
  collection?: string;
  cellCount?: number;
  mergedCount?: number;
  generation?: number;
};

/**
 * 편집 행위 로그를 output/edit-activity/ 에 미러 — 에이전트·CLI(`npm run edit:log`)가
 * 디스크에서 바로 읽는다.
 *
 * AI 미러와 두 군데가 다르다:
 *   1. 본문이 `{entries:[...]}` **배치**다(AI 는 단건). 편집은 스트로크 단위라 1500ms 디바운스로
 *      묶어 보낸다 — 건당 POST 면 dev 서버가 요청 폭풍을 맞는다.
 *   2. 파일명에 클라이언트 값을 **한 글자도 쓰지 않는다**. AI 쪽은 `record.id` 를 파일명에 써서
 *      `SAFE_ACTIVITY_ID_PATTERN` 으로 경로 탈출을 막아야 했는데, 여기는 append-only jsonl +
 *      고정 파일명(edits.jsonl / latest.json / index.json) 뿐이라 탈출 표면이 애초에 없다.
 */
function editActivityDiskPlugin(): Plugin {
  const dir = join(process.cwd(), "output", "edit-activity");
  // dev 와 preview 양쪽에 같은 미들웨어를 단다. AI 미러는 configureServer 만 있던 동안
  // `vite preview` 로 접속한 에디터의 POST 가 404 로 떨어졌고, 클라이언트는 첫 실패에 미러를
  // 스스로 끄기 때문에 디스크에 한 줄도 남지 않았다(2026-08-28 실측). 같은 실수를 반복하지 않는다.
  function attachEditMirror(server: ViteDevServer | PreviewServer) {
    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith(EDIT_ACTIVITY_DISK_ENDPOINT)) return next();
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
      let size = 0;
      let aborted = false;
      req.on("data", (c) => {
        if (aborted) return;
        const chunk = Buffer.isBuffer(c) ? c : Buffer.from(c);
        size += chunk.length;
        if (size > EDIT_ACTIVITY_MAX_BODY_BYTES) {
          // 상한 초과는 파싱하지 않고 즉시 끊는다 — 다 받아놓고 거절하면 상한이 의미가 없다.
          aborted = true;
          chunks.length = 0;
          res.statusCode = 413;
          if (allowedOrigin) res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
          res.end(`payload too large (> ${EDIT_ACTIVITY_MAX_BODY_BYTES} bytes)`);
          return;
        }
        chunks.push(chunk);
      });
      req.on("end", () => {
        if (aborted) return;
        try {
          mkdirSync(dir, { recursive: true });
          const raw = Buffer.concat(chunks).toString("utf8");
          const body = JSON.parse(raw) as { entries?: EditActivityMirrorEntry[] };
          const entries = Array.isArray(body.entries) ? body.entries : [];
          if (entries.length === 0) {
            // 빈 배치는 정상 응답으로 넘긴다 — 400 을 주면 클라이언트가 미러를 영구히 끈다.
            res.statusCode = 204;
            if (allowedOrigin) res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
            res.end();
            return;
          }
          // 한 줄 = 한 엔트리. 줄바꿈이 섞이면 jsonl 이 깨지므로 직렬화 후 공백으로 치환한다.
          const lines = entries.map((entry) => `${JSON.stringify(entry).replace(/\n/g, " ")}\n`).join("");
          appendFileSync(join(dir, "edits.jsonl"), lines, "utf8");
          const last = entries[entries.length - 1];
          writeFileSync(join(dir, "latest.json"), JSON.stringify(last, null, 2), "utf8");

          let index: EditActivityMirrorEntry[] = [];
          const indexPath = join(dir, "index.json");
          if (existsSync(indexPath)) {
            try {
              index = JSON.parse(readFileSync(indexPath, "utf8")) as EditActivityMirrorEntry[];
            } catch {
              index = [];
            }
          }
          // 요약은 CLI 표가 쓰는 열만 담는다(fields 상세는 edits.jsonl 에만 남는다) —
          // index.json 이 필드 diff 까지 들면 200건에서 수 MB 가 된다.
          const summaries = entries.map((entry) => ({
            seq: entry.seq,
            at: entry.at ?? new Date().toISOString(),
            scope: entry.scope ?? "project",
            label: entry.label ?? null,
            ...(entry.mapId === undefined ? {} : { mapId: entry.mapId }),
            ...(entry.collection === undefined ? {} : { collection: entry.collection }),
            ...(entry.cellCount === undefined ? {} : { cellCount: entry.cellCount }),
            ...(entry.mergedCount === undefined ? {} : { mergedCount: entry.mergedCount }),
            origin: entry.origin ?? "human",
          }));
          // seq 는 클라이언트 링버퍼에서 단조 증가한다. 병합 엔트리는 같은 seq 로 다시 오므로
          // 최신 값으로 교체한다(그러지 않으면 드래그 한 번이 index 를 같은 seq 로 도배한다).
          const replaced = new Set(summaries.map((row) => row.seq).filter((value) => value !== undefined));
          const next = [
            ...summaries.reverse(),
            // seq 없는 행(구버전 미러·손편집)은 대조 기준이 없으므로 지우지 않고 밀어낸다.
            ...index.filter((row) => row.seq === undefined || !replaced.has(row.seq)),
          ].slice(
            0,
            EDIT_ACTIVITY_INDEX_LIMIT,
          );
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
  }
  return {
    name: "rpgzzu-edit-activity-disk",
    configureServer(server) {
      attachEditMirror(server);
    },
    configurePreviewServer(server) {
      attachEditMirror(server);
    },
  };
}

// Same-origin bridge to the oh-my-pi companion router (provider auth + completions).
// Browser always calls /auth/* and /v1/chat/completions on the page origin — never
// 127.0.0.1:17832 — so Tailscale preview (`mdc-server:9888`) still reaches this process.
function codexOAuthPlugin(): Plugin {
  let adaptersPromise: Promise<OhMyPiAdapters> | null = null;
  function getAdapters() {
    if (!adaptersPromise) adaptersPromise = createOhMyPiAdapters();
    return adaptersPromise;
  }
  function errorStatus(error: unknown): number {
    if (error && typeof error === "object" && "status" in error) {
      const status = (error as { status: unknown }).status;
      if (typeof status === "number") return status;
    }
    return 500;
  }
  function attachCompanion(server: ViteDevServer | PreviewServer) {
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
        // 브라우저가 응답을 다 받기 전에 끊으면(Pi 에이전트 중단 등) 어댑터 fetch 까지 취소되도록 신호를 만든다.
        const disconnect = new AbortController();
        res.on("close", () => { if (!res.writableFinished) disconnect.abort(); });
        const result = await handleCompanionRequest(
          { method: req.method, url, headers: req.headers as Record<string, string>, body, signal: disconnect.signal },
          await getAdapters(),
        );
        writeCompanionResult(res, result);
      } catch (error) {
        res.statusCode = errorStatus(error);
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : "OAuth companion bridge failed" }));
      }
    });
    server.httpServer?.on("close", () => {
      adaptersPromise = null;
      stopOhMyPiWorker();
    });
  }
  return {
    name: "rpgzzu-codex-oauth",
    configureServer(server) {
      attachCompanion(server);
    },
    configurePreviewServer(server) {
      attachCompanion(server);
    },
  };
}

/**
 * 브라우저 QA 중 dev 서버를 얼릴지 여부.
 *
 * 병렬 에이전트가 `src/` 를 편집하면 HMR 이 QA 중인 페이지에 리로드를 밀어넣어
 * 편집기 부팅이 깨지고 `ERR_NETWORK_CHANGED` 가 쏟아진다(openwiki/testing.md).
 * Playwright 가 webServer 로 직접 띄운 서버에는 이 플래그가 걸려 파일 감시와 HMR 을
 * 모두 끈다 — 그 실행 동안 서버가 내주는 번들은 고정된다.
 *
 * 개발용 서버는 건드리지 않는다. `reuseExistingServer: true` 라서 이미 떠 있는 서버를
 * 재사용하면 이 플래그는 안 걸린다 — 그때는 소스가 조용할 때 증거를 잡는 수밖에 없다.
 */
const freezeDevServer = () => process.env.E2E_FREEZE_DEV_SERVER === "1";

export default defineConfig(({ mode }) => {
  const apitopiaKey = gatewayApiKey(mode);
  if (!apitopiaKey) {
    // 키가 없으면 프록시를 아예 등록하지 않는다 — 빈 Bearer 로 401 을 받고 원인을 못 찾는 대신
    // /api/ai 가 404 로 명확히 실패하고, 클라이언트의 "API 키 없음" 안내가 정상 동작한다.
    console.warn(
      "[rpg-zzu] APITOPIA_API_KEY 가 없어 /api/ai 프록시를 등록하지 않습니다. .env.local 에 키를 넣으세요."
    );
  }
  // 키가 있는 경로만 프록시를 등록한다(빈 Bearer 전송 금지). 접근은 localOnlyAiProxyPlugin 이 루프백으로 제한.
  const proxy: Record<string, ProxyOptions> = {};
  // Supabase(Kong) 는 평문 HTTP 라, dev 서버를 HTTPS 로 열면 브라우저가 mixed content 로 차단한다.
  // 같은 오리진의 /supabase 로 프록시해 두면 페이지 프로토콜과 무관하게 항상 붙는다(CORS 도 불필요).
  // 업스트림은 .env 의 절대 URL 을 그대로 쓴다 — node 스크립트들이 같은 값을 쓰므로 .env 는 절대 URL 로 유지한다.
  const supabaseKey = supabaseAnonKey(mode);
  const useSupabaseProxy = supabaseUseProxy(mode);
  if (useSupabaseProxy && !supabaseKey) {
    // 프록시 모드인데 서버 키가 없으면 클라이언트는 센티널만 보내고 PostgREST 는 401 을 준다.
    // "저장이 안 되는데 원인 모름"이 되지 않게 부팅에서 크게 알린다.
    console.warn(
      "[rpg-zzu] VITE_SUPABASE_USE_PROXY=1 인데 SUPABASE_ANON_KEY 가 없습니다 — /supabase 요청이 401 로 떨어집니다. .env.local 에 서버 전용 키를 넣으세요.",
    );
  }
  proxy[SUPABASE_PROXY_PATH] = {
    target: supabaseUpstreamUrl(mode),
    changeOrigin: true,
    rewrite: (path: string) => path.replace(new RegExp(`^${SUPABASE_PROXY_PATH}`), ""),
    // 키가 있으면 클라이언트가 보낸 자격증명을 서버 값으로 덮는다. headers 옵션 대신
    // proxyReq.setHeader 를 쓰는 이유: 들어온 헤더는 소문자로 정규화돼 있어서 `Authorization`
    // 을 새로 얹으면 `authorization` 과 중복 전송될 수 있다. setHeader 는 대소문자 무관하게 교체한다.
    ...(supabaseKey
      ? {
          configure: (proxyServer) => {
            proxyServer.on("proxyReq", (proxyReq) => {
              proxyReq.setHeader("apikey", supabaseKey);
              proxyReq.setHeader("authorization", `Bearer ${supabaseKey}`);
            });
          },
        }
      : {}),
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
  return {
  // 병렬 워크트리는 `node_modules` 를 메인 레포로 심볼릭 링크해 쓴다 — 즉 vite 의 최적화 캐시
  // (`node_modules/.vite`) 까지 공유된다. 여러 워크트리의 dev 서버가 동시에 돌면 서로의 캐시를
  // 재최적화하다 "Failed to scan for dependencies" 로 서버가 죽는다(실측: 액션 전투 QA 중 3회).
  // VITE_CACHE_DIR 을 주면 워크트리 전용 캐시를 써서 이 충돌을 없앤다.
  cacheDir: process.env.VITE_CACHE_DIR,
  plugins: [bgmInstallPlugin(), audioDeliveryPlugin(), devPlayerBundlesPlugin(), aiActivityDiskPlugin(), editActivityDiskPlugin(), codexOAuthPlugin(), localOnlyAiProxyPlugin()],
  // src/styles/index.css 는 @import 로 243개 파일을 한 모듈로 인라인한다. 소스맵이 없으면
  // DevTools 가 그 모든 규칙을 `index.css` 한 파일로 귀속시켜, 계산된 스타일에서 소유 파일을
  // 역추적할 수 없다. !important 1,051개와 "재배열 금지" 순서 계약 40여 개가 걸린 시트에서
  // 이건 디버깅 불가를 뜻한다. dev 전용이라 프로덕션 번들에는 영향이 없다.
  css: { devSourcemap: true },
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
      //
      // `../rpg-zzu/node_modules` 만으로는 부족하다: 그 상대경로는 워크트리가 원본의 **형제**일
      // 때만 맞는다(scripts/agent-worktree.mjs 배치). Claude Code 의 워크트리는
      // `<repo>/.claude/worktrees/<name>` 에 생기므로 `../rpg-zzu/...` 가 빗나가고, phaser.min.js
      // 가 403 으로 막혀 Phaser 가 뜨지 않는다 — 편집기 캔버스가 빈 DIV 로 남는 증상
      // (2026-08-28 실측: `403 /@fs/.../node_modules/phaser/dist/phaser.min.js`).
      // 그래서 배치를 가정하지 않고 **로컬 `./node_modules` 의 실경로**를 직접 넣는다.
      allow: (() => {
        const roots = [
          fileURLToPath(new URL("./", import.meta.url)),
          fileURLToPath(new URL("./node_modules", import.meta.url)),
          fileURLToPath(new URL("../rpg-zzu/node_modules", import.meta.url)),
        ];
        for (const root of [...roots]) {
          try {
            const real = realpathSync(root);
            if (real !== root) roots.push(real);
          } catch {
          }
        }
        // 위 루프는 `node_modules` **자체**가 링크일 때만 통한다. `.herdr/worktrees/<name>/worktree`
        // 배치에서는 node_modules 는 실디렉터리이고 그 **안의 패키지들**만 원본 저장소로 링크된다
        // (phaser, jimp, playwright…). 그러면 `@fs` 실경로가 여전히 allow 밖이라 phaser.min.js 가
        // 403 이고 편집기 캔버스가 빈 DIV 로 남는다. 그래서 링크된 패키지의 실경로도 넣는다.
        const localModules = fileURLToPath(new URL("./node_modules", import.meta.url));
        try {
          for (const entry of readdirSync(localModules, { withFileTypes: true })) {
            if (!entry.isSymbolicLink()) continue;
            try {
              roots.push(realpathSync(`${localModules}/${entry.name}`));
            } catch {
            }
          }
        } catch {
        }
        return [...new Set(roots)];
      })(),
    },
    // E2E 실행 중에는 HMR 도 파일 감시도 끈다. `watch: null` 이면 chokidar 자체가 안 뜨므로
    // 다른 에이전트가 `src/` 를 저장해도 모듈 무효화·리로드가 발생하지 않는다.
    hmr: freezeDevServer() ? false : undefined,
    watch: freezeDevServer()
      ? null
      : {
          ignored: ["**/.omo/**", "**/output/**", "**/tmp/**", "**/test-results/**"],
        },
    // 상대 baseUrl(/api/ai)을 쓰는 클라이언트는 Authorization 을 보내지 않고
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
