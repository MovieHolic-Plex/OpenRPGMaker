import { readdirSync, statSync } from "node:fs";
import type { ServerResponse } from "node:http";
import { dirname, join, resolve } from "node:path";
import type { Connect, Plugin } from "vite";
import { CATALOG_RELATIVE_DIR, listInstalledCatalogFiles } from "./bgmCatalogDir";
import { installRelease, readTrustedManifest, type BgmManifest } from "./bgm-release.mjs";

export type BgmInstallOptions = {
  /** 테스트 주입용. 기본은 루프백 + RPG_ZZU_BGM_INSTALL_REMOTE opt-in. */
  readonly allowAddress?: (address: string | undefined) => boolean;
  /** 테스트 주입용. 기본은 bgm-release.mjs 의 installRelease. */
  readonly install?: (input: {
    readonly root: string;
    readonly manifest: BgmManifest;
    readonly signal: AbortSignal;
  }) => Promise<unknown>;
};

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

/**
 * 이 엔드포인트는 gh 를 실행하고 디스크에 1.3GB 를 쓴다. 네트워크에 열어 두지 않는 것이
 * 기본값이고, 원격 주소로 에디터를 여는 사람만 명시적으로 opt-in 한다.
 */
function defaultAllowAddress(address: string | undefined): boolean {
  if (process.env.RPG_ZZU_BGM_INSTALL_REMOTE === "1") return true;
  return address !== undefined && LOOPBACK.has(address);
}

function directorySize(directory: string): number {
  let entries;
  try { entries = readdirSync(directory, { withFileTypes: true }); }
  catch { return 0; }
  let total = 0;
  for (const entry of entries) {
    const full = join(directory, entry.name);
    // 설치 중에는 임시 파일이 사라질 수 있다 — 진행률 때문에 설치를 깨뜨리지 않는다.
    try {
      if (entry.isDirectory()) total += directorySize(full);
      else if (entry.isFile()) total += statSync(full).size;
    } catch { continue; }
  }
  return total;
}

/**
 * gh 를 stdio:'ignore' 로 띄우므로 다운로드 자체는 진행 정보를 내지 않는다.
 * installRelease 가 쓰는 스테이징 디렉터리 크기가 유일한 실제 진행률 신호다.
 */
function stagedBytes(parent: string): number {
  let entries;
  try { entries = readdirSync(parent, { withFileTypes: true }); }
  catch { return 0; }
  let total = 0;
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith(".bgm-stage-")) total += directorySize(join(parent, entry.name));
  }
  return total;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

export function bgmInstallPlugin(options: BgmInstallOptions = {}): Plugin {
  const allowAddress = options.allowAddress ?? defaultAllowAddress;
  const install = options.install ?? (input => installRelease(input));

  let projectRoot = process.cwd();
  let manifestPromise: Promise<BgmManifest> | null = null;
  let running: Promise<unknown> | null = null;
  let controller: AbortController | null = null;
  let lastError: string | null = null;

  const manifest = (): Promise<BgmManifest> =>
    (manifestPromise ??= readTrustedManifest(resolve(projectRoot, "assets/bgm-release-v1.json")));
  // installRelease 의 destination 과 같은 곳을 봐야 한다: <root>/public/assets/cc0/audio/catalog
  const catalogDir = (): string => resolve(projectRoot, "public", CATALOG_RELATIVE_DIR);

  const start = async (response: ServerResponse): Promise<void> => {
    if (running) { send(response, 409, { error: "BGM 설치가 이미 진행 중입니다." }); return; }
    const loaded = await manifest();
    if (listInstalledCatalogFiles(catalogDir()).length >= loaded.count) {
      send(response, 200, { started: false, complete: true });
      return;
    }
    const active = new AbortController();
    controller = active;
    lastError = null;
    const task = install({ root: projectRoot, manifest: loaded, signal: active.signal });
    running = task;
    void task.then(
      () => { lastError = null; },
      (error: unknown) => { lastError = active.signal.aborted ? null : message(error); },
    ).finally(() => { running = null; controller = null; });
    send(response, 202, { started: true });
  };

  const handler: Connect.NextHandleFunction = (request, response, next) => {
    let path: string;
    try { path = new URL(request.url ?? "/", "http://localhost").pathname; }
    catch { send(response, 400, { error: "잘못된 요청 경로입니다." }); return; }
    const method = request.method ?? "GET";
    const address = request.socket?.remoteAddress ?? undefined;

    void (async () => {
      // status 는 가드하지 않는다 — 막힌 클라이언트도 이유를 읽어야 배너를 그릴 수 있다.
      if (path === "/status" && (method === "GET" || method === "HEAD")) {
        const loaded = await manifest();
        send(response, 200, {
          expected: loaded.count,
          installed: listInstalledCatalogFiles(catalogDir()),
          installing: running !== null,
          stagedBytes: running === null ? 0 : stagedBytes(dirname(catalogDir())),
          archiveBytes: loaded.archive.bytes,
          remoteAllowed: allowAddress(address),
          error: lastError,
        });
        return;
      }
      if (path !== "/install") { next(); return; }
      if (!allowAddress(address)) {
        send(response, 403, {
          error: "원격 접속에서는 BGM 설치가 잠겨 있습니다. .env.local 에 RPG_ZZU_BGM_INSTALL_REMOTE=1 을 넣고 서버를 다시 시작하세요.",
        });
        return;
      }
      if (method === "POST") { await start(response); return; }
      if (method === "DELETE") {
        controller?.abort(new Error("BGM 설치를 취소했습니다."));
        send(response, 202, { cancelled: true });
        return;
      }
      send(response, 405, { error: `지원하지 않는 메서드입니다: ${method}` });
    })().catch((error: unknown) => {
      if (response.headersSent) { response.end(); return; }
      send(response, 500, { error: message(error) });
    });
  };

  return {
    name: "rpgzzu-bgm-install",
    configResolved(config) { projectRoot = config.root; },
    configureServer(server) { server.middlewares.use("/api/bgm", handler); },
    configurePreviewServer(server) { server.middlewares.use("/api/bgm", handler); },
  };
}
