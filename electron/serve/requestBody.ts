import type { IncomingMessage } from "node:http";
import { gunzip } from "node:zlib";

/** Separate wire and decoded limits, including conflict-resolution snapshots. */
export function readBridgeRequestBody(request: IncomingMessage, maxWireBytes = 128 * 1024 * 1024, maxDecodedBytes = 256 * 1024 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const encoding = (request.headers["content-encoding"] ?? "identity").trim().toLowerCase();
    if (encoding !== "identity" && encoding !== "gzip") {
      request.resume(); reject(new Error("unsupported request content-encoding")); return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    let failed = false;
    const fail = (error: Error): void => { if (failed) return; failed = true; chunks.length = 0; reject(error); };
    request.on("data", (chunk: Buffer) => {
      if (failed) return;
      size += chunk.length;
      if (size > maxWireBytes) { fail(new Error(`request exceeds ${maxWireBytes} wire bytes`)); request.resume(); return; }
      chunks.push(chunk);
    });
    request.on("aborted", () => fail(new Error("request aborted")));
    request.on("error", fail);
    request.on("end", () => {
      if (failed) return;
      const body = Buffer.concat(chunks); chunks.length = 0;
      if (encoding === "identity") {
        if (body.length > maxDecodedBytes) { fail(new Error(`request exceeds ${maxDecodedBytes} decoded bytes`)); return; }
        resolve(body.toString("utf8")); return;
      }
      gunzip(body, { maxOutputLength: maxDecodedBytes }, (error, decoded) => {
        if (error) { fail(error); return; }
        if (!failed) resolve(decoded.toString("utf8"));
      });
    });
  });
}
