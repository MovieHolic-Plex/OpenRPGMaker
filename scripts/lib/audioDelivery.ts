import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { ServerResponse } from "node:http";
import { resolve, relative, extname } from "node:path";
import { pipeline } from "node:stream/promises";
import type { Connect, Plugin } from "vite";
import { CATALOG_RELATIVE_DIR, listInstalledCatalogFiles } from "./bgmCatalogDir";

function missing(error: unknown): boolean {
  return error instanceof Error && "code" in error && (error.code === "ENOENT" || error.code === "ENOTDIR");
}

const MEDIA_PATTERN = /\.(?:mp3|wav|ogg|m4a|mid|midi|mp4|webm|ogv)$/i;
/** 설치 직후 재빌드 전까지 dist 에 없는 곡이 사는 곳. 폴백은 여기로만 한정한다. */
const CATALOG_URL_PREFIX = `/${CATALOG_RELATIVE_DIR}/`;

const MEDIA_TYPES: Readonly<Record<string, string>> = {
  ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg", ".m4a": "audio/mp4",
  ".mid": "audio/midi", ".midi": "audio/midi",
  ".mp4": "video/mp4", ".webm": "video/webm", ".ogv": "video/ogg",
};

/** `bytes=start-end` 한 구간만 받는다. 미디어 요소가 보내는 형태가 이것뿐이다. */
function parseRange(header: string | undefined, size: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header?.trim() ?? "");
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (rawStart === "" && rawEnd === "") return null;
  // 접미 범위(`-500`) = 마지막 500바이트.
  const start = rawStart === "" ? Math.max(0, size - Number(rawEnd)) : Number(rawStart);
  const end = rawStart === "" ? size - 1 : Math.min(rawEnd === "" ? size - 1 : Number(rawEnd), size - 1);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) return null;
  return { start, end };
}

/**
 * 폴백 경로는 Vite 의 기본 정적 미들웨어를 거치지 않으므로 Range 를 직접 지켜야 한다.
 * 안 그러면 오디오 요소의 탐색(seek)이 깨진다.
 */
async function serveFile(file: string, size: number, request: Connect.IncomingMessage, response: ServerResponse): Promise<void> {
  const range = parseRange(request.headers.range, size);
  response.setHeader("Content-Type", MEDIA_TYPES[extname(file).toLowerCase()] ?? "application/octet-stream");
  response.setHeader("Accept-Ranges", "bytes");
  response.statusCode = range ? 206 : 200;
  if (range) response.setHeader("Content-Range", `bytes ${range.start}-${range.end}/${size}`);
  response.setHeader("Content-Length", String(range ? range.end - range.start + 1 : size));
  if (request.method === "HEAD") { response.end(); return; }
  await pipeline(createReadStream(file, range ? { start: range.start, end: range.end } : {}), response);
}

/** Delivery facts only: the existing BGM registry remains the identity authority. */
export function audioDeliveryPlugin(): Plugin {
  let publicRoot = "";
  let previewRoot = "";
  /**
   * `root` 에 있으면 기본 정적 미들웨어에 넘긴다. 없고 카탈로그 경로면 `fallbackRoot` 에서
   * 직접 서빙한다 — preview 가 dist 를 보는 동안 설치는 public 으로 들어가기 때문이다.
   */
  const guard = (root: string, fallbackRoot: string | null): Connect.NextHandleFunction => (request, response, next) => {
    let path: string;
    try { path = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname); }
    catch { response.statusCode = 400; response.end(); return; }
    if (!path.startsWith("/assets/") || !MEDIA_PATTERN.test(path)) { next(); return; }
    const file = resolve(root, `.${path}`);
    if (relative(root, file).startsWith("..")) { response.statusCode = 400; response.end(); return; }
    const fallback = fallbackRoot !== null && path.startsWith(CATALOG_URL_PREFIX)
      ? resolve(fallbackRoot, `.${path}`)
      : null;
    if (fallback !== null && relative(fallbackRoot as string, fallback).startsWith("..")) {
      response.statusCode = 400; response.end(); return;
    }
    void (async () => {
      try {
        const info = await stat(file);
        if (info.isFile()) { next(); return; }
      } catch (error) { if (!missing(error)) { next(error); return; } }
      if (fallback !== null) {
        try {
          const info = await stat(fallback);
          if (info.isFile()) { await serveFile(fallback, info.size, request, response); return; }
        } catch (error) { if (!missing(error)) { next(error); return; } }
      }
      response.statusCode = 404;
      response.setHeader("Content-Type", "text/plain; charset=utf-8");
      response.end("Media not found. Install the catalog pack from the editor, or run npm run bgm:install.");
    })().catch(next);
  };
  return {
    name: "audio-delivery",
    config(config) {
      const root = resolve(config.root ?? process.cwd());
      const directory = resolve(root, typeof config.publicDir === "string" ? config.publicDir : "public", CATALOG_RELATIVE_DIR);
      const files = config.publicDir === false ? [] : listInstalledCatalogFiles(directory);
      return { define: { __OPRN_INSTALLED_BGM_FILES__: JSON.stringify(files) } };
    },
    configResolved(config) {
      publicRoot = config.publicDir;
      previewRoot = resolve(config.root, config.build.outDir);
    },
    // dev 는 public 을 직접 서빙하므로 폴백이 필요 없다.
    configureServer(server) { server.middlewares.use(guard(publicRoot, null)); },
    configurePreviewServer(server) { server.middlewares.use(guard(previewRoot, publicRoot)); },
  };
}
