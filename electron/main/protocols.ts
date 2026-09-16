import { existsSync, readFileSync } from "node:fs";
import { extname, normalize, resolve, sep } from "node:path";
import { protocol } from "electron";
import { OPRN_APP_SCHEME, OPRN_ASSET_SCHEME } from "../shared/channels";
import type { SessionRegistry } from "./sessions";

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

export function registerAppProtocol(rendererDir: string): void {
  const root = resolve(rendererDir);
  protocol.handle(OPRN_APP_SCHEME, (request) => {
    const url = new URL(request.url);
    const relative = url.pathname === "/" || url.pathname === "" ? "index.html" : url.pathname.replace(/^\//, "");
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
      headers: { "content-type": row.mime, "cache-control": "public, max-age=31536000, immutable" },
    });
  });
}
