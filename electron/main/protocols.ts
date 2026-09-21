import { existsSync, readFileSync } from "node:fs";
import { extname, normalize, resolve, sep } from "node:path";
import { protocol } from "electron";
import { ASSET_RESPONSE_CSP, assetCacheControl, safeAssetContentType } from "../shared/assetMime";
import { OPRN_APP_SCHEME, OPRN_ASSET_SCHEME } from "../shared/channels";
import { handleActivityMirror, isActivityMirrorPath } from "../../scripts/lib/activityMirror.mjs";
import type { SessionRegistry } from "./sessions";
import { sharedCharacterGraphicsResponse } from "../../scripts/lib/sharedCharacterGraphics";
import { SHARED_CHARACTER_GRAPHICS_ENDPOINT } from "../../src/project/sharedCharacterGraphicsSchema";

const MIME_BY_EXTENSION: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

const CONTENT_SECURITY_POLICY = [
  "default-src 'self' app:",
  "img-src 'self' app: oprn-asset: data: blob:",
  "media-src 'self' app: oprn-asset: data: blob:",
  "script-src 'self' app:",
  "style-src 'self' 'unsafe-inline' app:",
  "connect-src 'self' app: http://127.0.0.1:* ws://127.0.0.1:*",
].join("; ");

function fileResponse(target: string): Response {
  const contentType = MIME_BY_EXTENSION[extname(target)] ?? "application/octet-stream";
  return new Response(readFileSync(target), {
    headers: { "content-type": contentType, "content-security-policy": CONTENT_SECURITY_POLICY },
  });
}

export function registerAppProtocol(rendererDir: string, activityLogBaseDir: () => string): void {
  const root = resolve(rendererDir);
  protocol.handle(OPRN_APP_SCHEME, async (request) => {
    const url = new URL(request.url);
    if (url.pathname === SHARED_CHARACTER_GRAPHICS_ENDPOINT) {
      if (request.method === "POST" && (request.headers.get("x-oprn-shared-catalog") !== "1" || Number(request.headers.get("content-length") ?? 0) > 2 * 1024 * 1024)) return new Response(null, { status: 403 });
      try {
        const text = request.method === "POST" ? await request.text() : "";
        if (new TextEncoder().encode(text).length > 2 * 1024 * 1024) return new Response(null, { status: 413 });
        const result = await sharedCharacterGraphicsResponse(request.method, text ? JSON.parse(text) : undefined);
        return Response.json(result.body, { status: result.status, headers: { "cache-control": "no-store" } });
      } catch { return Response.json({ error: "공용 자료 요청을 읽지 못했습니다." }, { status: 400 }); }
    }
    // 활동 미러 2종은 페이지가 **상대 경로**로 부른다(/__oprn/ai-activity). app:// 에서는
    // 이 프로토콜 핸들러가 그 요청을 받는다 — 예전에는 받는 쪽이 아예 없어서 앱의 편집·AI
    // 로그가 404 로 조용히 사라졌다(I3).
    if (isActivityMirrorPath(url.pathname)) {
      const result = handleActivityMirror({
        method: request.method,
        url: url.pathname + url.search,
        bodyText: request.method === "POST" ? await request.text() : "",
        baseDir: activityLogBaseDir(),
      });
      if (result) {
        // 204·304 는 본문을 가질 수 없다 — 빈 문자열을 넘기면 Response 생성자가 TypeError 를
        // 던지고, 프로토콜 핸들러 밖에서는 `Failed to fetch` 로만 보인다(2026-09-16 실측).
        return new Response(result.body.length > 0 ? result.body : null, {
          status: result.status,
          headers: result.contentType ? { "content-type": result.contentType } : {},
        });
      }
    }
    const relative = url.pathname === "/" || url.pathname === "" ? "index.html" : url.pathname.replace(/^\//, "");
    if (relative.split("/").some((part) => part.startsWith("."))) {
      return new Response("forbidden", { status: 403 });
    }
    const target = resolve(root, normalize(relative));
    if (target !== resolve(root, "index.html") && !target.startsWith(root + sep)) {
      return new Response("forbidden", { status: 403 });
    }
    if (!existsSync(target)) return new Response("not found", { status: 404 });
    return fileResponse(target);
  });
}

export function registerAssetProtocol(sessions: SessionRegistry): void {
  protocol.handle(OPRN_ASSET_SCHEME, async (request) => {
    const url = new URL(request.url);
    const session = sessions.findByProjectId(url.hostname);
    if (!session) return new Response("unknown project", { status: 404 });
    const sha256 = url.pathname.replace(/^\//, "");
    const row = session.store.listAssets().find((asset) => asset.sha256 === sha256);
    if (!row) return new Response("unknown asset", { status: 404 });
    const bytes = await session.store.assetBytes(sha256);
    return new Response(bytes, {
      headers: {
        "content-type": safeAssetContentType(row.mime),
        "cache-control": assetCacheControl(row.mime),
        "content-security-policy": ASSET_RESPONSE_CSP,
        "x-content-type-options": "nosniff",
      },
    });
  });
}
