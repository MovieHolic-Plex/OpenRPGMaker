import type { IncomingMessage, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { contractPath } from "../../src/project/playerDeploymentPaths";
import { RUNTIME_ARCHIVE_FOLDER } from "./runtimeArchive";

export function runtimeArchiveMiddleware(root: string, prepareDefault?: () => Promise<string>) {
  return (request: IncomingMessage, response: ServerResponse, next: () => void): void => {
    if (!request.url?.startsWith("/runtime-archive/")) return next();
    const url = request.url;
    void (async () => {
      try {
        const file = contractPath(decodeURIComponent(url.split("?")[0].slice("/runtime-archive/".length)));
        if (file !== "default.json" && !/^[a-f0-9]{64}\/(?:runtime\.json|(?:web|standalone|public)\/.*)$/.test(file)) throw new Error("Invalid archive path");
        const target = file === "default.json" ? await prepareDefault?.() : undefined;
        // Return the target actually verified/prepared, not a second read of a
        // mutable pointer that another builder could replace after verification.
        const bytes = target === undefined ? await readFile(join(root, RUNTIME_ARCHIVE_FOLDER, file)) : JSON.stringify({ runtimeTarget: target });
        response.setHeader("Content-Type", file.endsWith(".json") ? "application/json" : "application/octet-stream");
        response.setHeader("Cache-Control", file === "default.json" ? "no-store" : "public, max-age=31536000, immutable");
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.end(bytes);
      } catch (error) {
        response.statusCode = error instanceof Error && "code" in error && error.code === "ENOENT" ? 404 : 500;
        response.setHeader("Cache-Control", "no-store");
        response.end("Runtime archive unavailable");
      }
    })();
  };
}
