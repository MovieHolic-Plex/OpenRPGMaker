import type { ServerResponse } from "node:http";
import { gzip } from "node:zlib";

function acceptsGzip(header: string | undefined): boolean {
  const entries = (header ?? "").split(",").map(value => value.trim().toLowerCase());
  const explicit = entries.find(value => value.split(";")[0]?.trim() === "gzip");
  const entry = explicit ?? entries.find(value => value.split(";")[0]?.trim() === "*");
  if (!entry) return false;
  const quality = entry.match(/;\s*q\s*=\s*([\d.]+)/)?.[1];
  return quality === undefined || Number(quality) > 0;
}

/** Compress text asynchronously so a large download does not block other host sessions. */
export function sendHttpBody(
  response: ServerResponse,
  status: number,
  body: string | Buffer,
  headers: Record<string, string>,
): Promise<void> {
  const bytes = typeof body === "string" ? Buffer.from(body) : body;
  const text = /^(text\/|application\/(json|javascript|manifest\+json)|image\/svg\+xml)/.test(headers["content-type"] ?? "");
  const compressible = text && bytes.length >= 1024;
  const finish = (payload: Buffer, compressed: boolean): void => {
    if (response.destroyed) return;
    response.writeHead(status, {
      ...headers,
      ...(compressible ? { vary: "Accept-Encoding" } : {}),
      ...(compressed ? { "content-encoding": "gzip" } : {}),
      "content-length": String(payload.length),
    });
    response.end(response.req?.method === "HEAD" ? undefined : payload);
  };
  if (!compressible || !acceptsGzip(response.req?.headers["accept-encoding"])) {
    finish(bytes, false);
    return Promise.resolve();
  }
  return new Promise(resolve => {
    gzip(bytes, { level: 6 }, (error, compressed) => {
      // Compression is optional; an error must not prevent an otherwise valid read.
      finish(error ? bytes : compressed, !error);
      resolve();
    });
  });
}
