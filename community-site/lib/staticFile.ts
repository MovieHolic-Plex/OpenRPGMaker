import { readFile } from "node:fs/promises";
import path from "node:path";

export const EDITOR_PUBLIC = path.join(process.cwd(), "..", "public");

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
};

export async function serveStaticFile(root: string, rel: string): Promise<Response | null> {
  if (rel.includes("..")) return null;
  const resolved = path.resolve(root, rel);
  if (!resolved.startsWith(path.resolve(root))) return null;
  try {
    const bytes = await readFile(resolved);
    const immutable = /-[0-9a-zA-Z_-]{8}\.[^.]+$/.test(path.basename(rel));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": CONTENT_TYPES[path.extname(rel).toLowerCase()] ?? "application/octet-stream",
        "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "public, max-age=300",
      },
    });
  } catch {
    return null;
  }
}
