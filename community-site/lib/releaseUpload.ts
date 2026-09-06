import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { isRecord } from "../../src/project/playerDeploymentPaths";
import { isLicense } from "./kinds";
import { decodeDataUrl, slugify, sniffImageMime } from "./validate";
import { insertReleaseListing } from "./releaseStore";
import { loadOperatorRuntime, MAX_RELEASE_BYTES, ReleaseUploadError, validateReleaseArchive } from "./releaseArchive";

const MAX_BODY_BYTES = Math.ceil(MAX_RELEASE_BYTES / 3) * 4 + 4 * 1024 * 1024;

export async function readBoundedJson(request: Request, limit = MAX_BODY_BYTES): Promise<unknown> {
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > limit)) throw new ReleaseUploadError("too-large");
  if (!request.body) throw new ReleaseUploadError("invalid-release");
  const reader = request.body.getReader();
  let bytes = Buffer.alloc(Math.min(limit, 64 * 1024));
  let size = 0;
  let expired = false;
  const timeout = setTimeout(() => { expired = true; void reader.cancel("upload-timeout"); }, 30_000);
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (expired) throw new ReleaseUploadError("invalid-release");
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel("upload-too-large");
        throw new ReleaseUploadError("too-large");
      }
      if (size > bytes.length) {
        const grown = Buffer.alloc(Math.min(limit, Math.max(size, bytes.length * 2)));
        bytes.copy(grown, 0, 0, size - value.byteLength);
        bytes = grown;
      }
      bytes.set(value, size - value.byteLength);
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, size)));
  } finally { clearTimeout(timeout); reader.releaseLock(); }
}

export function createReleaseUploadHandler(options: { readonly pool: Pool; readonly loadRuntime?: typeof loadOperatorRuntime }) {
  let active = 0;
  return async (request: Request): Promise<Response> => {
    if (active >= 2) return fail(503, "Upload service busy. Try again.");
    active++;
    try {
      let body: unknown;
      try { body = await readBoundedJson(request); }
      catch (error) { return fail(error instanceof ReleaseUploadError && error.code === "too-large" ? 413 : 400, "Invalid or oversized request body."); }
      if (!isRecord(body)) return fail(400, "Invalid request body.");
      if (typeof body.website === "string" && body.website) return Response.json({ slug: "ok" }, { status: 201 });
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title || title.length > 80) return fail(400, "A title of at most 80 characters is required.");
      if (!isLicense(body.license)) return fail(400, "Choose a license.");
      if (typeof body.packageBase64 !== "string" || !body.packageBase64
        || body.packageBase64.length > Math.ceil(MAX_RELEASE_BYTES / 3) * 4) return fail(413, "Release ZIP too large or missing (96 MB max).");
      const bytes = Buffer.from(body.packageBase64, "base64");
      if (bytes.toString("base64") !== body.packageBase64) return fail(400, "Invalid base64 payload.");
      let release;
      try { release = await validateReleaseArchive(bytes, options.loadRuntime); }
      catch (error) {
        if (error instanceof ReleaseUploadError && error.code === "too-large") return fail(413, "Release ZIP too large (96 MB archive, 64 MB per file).");
        if (error instanceof ReleaseUploadError && error.code === "runtime-unavailable") return fail(422, "This runtime is not retained by the site operator.");
        return fail(422, "Upload an editor-produced web release ZIP. Legacy .oprn source packages are download-only, not playable releases.");
      }
      let coverDataUrl: string | null = null;
      if (typeof body.coverDataUrl === "string" && body.coverDataUrl) {
        const cover = decodeDataUrl(body.coverDataUrl);
        if (!cover || cover.bytes.length > 2 * 1024 * 1024 || sniffImageMime(cover.bytes) !== cover.mime) return fail(400, "Invalid cover image (2 MB max).");
        coverDataUrl = body.coverDataUrl;
      }
      const slug = `${slugify(title)}-${randomUUID()}`;
      await insertReleaseListing(options.pool, {
        slug, title, license: body.license, coverDataUrl,
        description: typeof body.description === "string" ? body.description.slice(0, 2000) : "",
        author: typeof body.author === "string" && body.author.trim() ? body.author.trim().slice(0, 40) : "anonymous",
        tags: Array.isArray(body.tags) ? body.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 12).map(tag => tag.slice(0, 80)) : [],
      }, release);
      return Response.json({ slug, releaseId: release.manifest.releaseId }, { status: 201 });
    } catch { return fail(500, "Could not save the release. Try again."); }
    finally { active--; }
  };
}

function fail(status: number, error: string): Response {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}
