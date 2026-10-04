import { sharedContentMiddleware } from './scripts/lib/sharedContentSqlite';
import { defineConfig, loadEnv, type Plugin, type PreviewServer, type ProxyOptions, type ViteDevServer } from "vite";
import { fileURLToPath, URL } from "node:url";
import {
  readFileSync,
  existsSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import { handleCompanionRequest, isCompanionPath } from "./scripts/lib/ohMyPiHttp.mjs";
import { createActivityMirrorMiddleware } from "./scripts/lib/activityMirrorMiddleware.mjs";
import { createOhMyPiAdapters, markOhMyPiWorkerStale, stopOhMyPiWorker } from "./scripts/lib/ohMyPiPiAi.mjs";
import type { OhMyPiAdapters } from "./scripts/lib/ohMyPiPiAi.mjs";
import { readRequestJson, writeCompanionResult } from "./scripts/lib/companionHttpUtil.mjs";
import { devPlayerBundlesPlugin } from "./scripts/lib/devPlayerBundles";
import { appVersionPlugin } from "./scripts/lib/appVersion.mjs";
import { whatsNewPlugin } from "./scripts/lib/whatsNew.mjs";
import { audioDeliveryPlugin } from "./scripts/lib/audioDelivery";
import { bgmInstallPlugin } from "./scripts/lib/bgmInstall";
import { applyLegacyEnvAliases } from "./scripts/lib/oprnEnv.mjs";
import { sharedCharacterGraphicsMiddleware } from "./scripts/lib/sharedCharacterGraphics";

applyLegacyEnvAliases();

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
    name: "oprn-local-only-ai-proxy",
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
function devCorsOrigin(req: { headers: { origin?: string | string[] } }): string | null {
  const origin = req.headers.origin;
  return typeof origin === "string" && DEV_ALLOWED_ORIGIN_PATTERN.test(origin) ? origin : null;
}

/**
 * 활동 미러 2종(AI 턴 로그·편집 행위 로그)을 dev·preview 서버에 달는다.
 *
 * 본체는 scripts/lib/activityMirror.mjs — 일렉트론 앱과 oprn-serve 도 같은 본체를 쓴다(I3, 2026-09-16).
 * 예전에는 이 로직이 여기 플러그인 안에만 있어서 앱·로컬 서버에서는 POST 가 404 로
 * 떨어졌고 클라이언트는 첫 실패에 미러를 스스로 끄어 로그가 조용히 0줄이 됐다.
 *
 * dev 와 preview 양쪽에 달린다 — configureServer 만 있던 동안 `vite preview`(9888)로 접속한
 * 에디터의 AI 활동 로그가 404 로 떨어졌다(2026-08-28 실측: 사용자가 실제로 친 지시가 유실).
 */
function activityMirrorPlugin(): Plugin {
  const middleware = createActivityMirrorMiddleware({
    baseDir: process.cwd(),
    corsOrigin: devCorsOrigin,
  });
  return {
    name: "oprn-activity-mirror",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
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
          res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Oprn-Provider");
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
    name: "oprn-codex-oauth",
    configureServer(server) {
      attachCompanion(server);
      // 워커는 모듈 그래프를 부팅 때 한 번 로드하는 오래 사는 Bun 자식이라, 코드를 고쳐도
      // 살아 있는 프로세스는 옛 판정·옛 병합을 계속 돈다. 실측(2026-09-14): 맵 묶음 병합 픽스가
      // 들어온 뒤에도 페이지를 새로 고친 편집기가 같은 `setSwitch: switchId가 존재하지 않습니다`
      // 를 재현했다 — 브라우저가 아니라 워커가 낡아 있었다. 그래서 워커의 모듈 그래프가 될 수 있는
      // 파일(src/**·scripts/**)이 바뀌면 «다음 요청 때 갈아 끼우기» 로 표시만 한다. 진행 중인
      // Pi 실행을 파일 저장 한 번으로 끊지 않으려고 여기서 죽이지 않는다.
      const staleWorkerCode = (file: string): void => {
        if (/[\\/](?:src|scripts)[\\/].*\.[cm]?[jt]sx?$/u.test(file)) markOhMyPiWorkerStale();
      };
      server.watcher.on("change", staleWorkerCode);
      server.watcher.on("add", staleWorkerCode);
      server.watcher.on("unlink", staleWorkerCode);
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
      "[oprn] APITOPIA_API_KEY 가 없어 /api/ai 프록시를 등록하지 않습니다. .env.local 에 키를 넣으세요."
    );
  }
  // 키가 있는 경로만 프록시를 등록한다(빈 Bearer 전송 금지). 접근은 localOnlyAiProxyPlugin 이 루프백으로 제한.
  const proxy: Record<string, ProxyOptions> = {};
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
  // VITE_CACHE_DIR 을 주면 워크트리 전용 캐시를 써서 이 충돌을 없앤다. `scripts/dev-server.mjs`
  // (npm run dev · dev:worktree · playwright webServer)는 공유 node_modules 를 보면 스스로
  // `<체크아웃>/.vite-cache/dev` 를 넣는다(scripts/lib/viteCacheDir.mjs). vite 를 직접 부르면 안 걸린다.
  cacheDir: process.env.VITE_CACHE_DIR,
  plugins: [{ name: "oprn-shared-content-sqlite", configureServer(server) { server.middlewares.use(sharedContentMiddleware); }, configurePreviewServer(server) { server.middlewares.use(sharedContentMiddleware); } }, { name: "oprn-shared-character-graphics", configureServer(server) { server.middlewares.use(sharedCharacterGraphicsMiddleware); }, configurePreviewServer(server) { server.middlewares.use(sharedCharacterGraphicsMiddleware); } }, bgmInstallPlugin(), audioDeliveryPlugin(), devPlayerBundlesPlugin(), activityMirrorPlugin(), codexOAuthPlugin(), localOnlyAiProxyPlugin(), appVersionPlugin(), whatsNewPlugin()],
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
        // 데스크톱 앱 첫 화면(app://oprn/start-screen.html). 편집기 번들을 싣지 않는 별도 엔트리다.
        startScreen: fileURLToPath(new URL("./start-screen.html", import.meta.url)),
      },
      output: {
        // 큰 정적 JSON(번들 타일셋·참고문서·장소 카탈로그·데모 픽스처 약 29MB)을 진입 청크에서 떼어
        // (phaser 는 phaser.min.js 자산으로 이미 따로 실린다.) 앱 릴리스마다 바뀌는 코드 청크와 따로 캐시되게 한다. 동작은 그대로다 — 정적 import 라서 부팅 순서는 같다.
        // 읽는 시점을 늦추는 지연 로드는 동기 소비자가 많고 JSON 해석이 합쳐 약 0.4초라 넣지 않았다(openwiki/runtime-project-schema.md 편집기 렉 F).
        manualChunks(id) {
          const file = id.split("?")[0]!.replace(/\\/g, "/");
          if (file.endsWith(".json") && (file.includes("/src/assets/") || file.includes("/src/project/defaults/"))) return "bundled-data";
          return undefined;
        },
      },
    },
    target: "es2022",
    sourcemap: false,
  },
  };
});
