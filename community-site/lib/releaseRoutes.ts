import type { RetainedRelease } from "./releaseArchive";
import { ReleaseBusyError } from "./releaseStore";
import { getDict } from "./i18n";
import { resolvePlayerLanguage } from "./playerBootConfig";

type ReleaseRoutesOptions = {
  readonly loadListing: (slug: string) => Promise<{ readonly release_id: string | null } | null>;
  readonly loadRelease: (slug: string, releaseId: string) => Promise<RetainedRelease | null>;
};
type PlayParams = { readonly slug: string; readonly path?: readonly string[] };
export function releasePlayPath(slug: string, releaseId: string): string {
  return `/play/${encodeURIComponent(slug)}/releases/${releaseId}/`;
}
export function releaseDownloadPath(slug: string, releaseId: string): string {
  return `/api/games/${encodeURIComponent(slug)}/releases/${releaseId}/download`;
}

export function createReleasePlayHandler(options: ReleaseRoutesOptions) {
  return async (request: Request, params: PlayParams): Promise<Response> => {
    try {
      const segments = params.path ?? [];
      if (segments.some(segment => !segment || segment === "." || segment === ".." || /[\\/\x00-\x1f\x7f%?#]/u.test(segment))) return failure(400);
      if (segments.length === 0) {
        const listing = await options.loadListing(params.slug);
        if (!listing) return failure(404);
        if (!listing.release_id) {
          return new Response(getDict(resolvePlayerLanguage(request)).game.playbackUnavailable, {
            status: 503, headers: { ...safeHeaders, "Content-Type": "text/plain; charset=utf-8" },
          });
        }
        return redirect(`${releasePlayPath(params.slug, listing.release_id)}player.html`);
      }
      if (segments[0] !== "releases" || !/^[a-f0-9]{64}$/.test(segments[1] ?? "")) return failure(404);
      const releaseId = segments[1];
      const release = await options.loadRelease(params.slug, releaseId);
      if (!release) return failure(404);
      if (segments.length === 2) return redirect(`${releasePlayPath(params.slug, releaseId)}player.html`);
      const name = segments.slice(2).join("/");
      const bytes = release.entries.get(name);
      if (!bytes) return failure(404);
      // Next's internal request URL may use localhost behind a public Host.
      const internal = new URL(request.url);
      const authority = request.headers.get("host") ?? internal.host;
      if (!/^[a-zA-Z0-9.:[\]_-]+$/.test(authority)) return failure(400);
      const scope = new URL(releasePlayPath(params.slug, releaseId), `${internal.protocol}//${authority}`).href;
      return new Response(new Uint8Array(bytes), { headers: {
        "Content-Type": contentType(name), "Content-Length": String(bytes.length),
        "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Security-Policy": name.toLowerCase().endsWith(".svg") ? "sandbox; default-src 'none'; style-src 'unsafe-inline'" :
          `default-src 'none'; script-src ${scope} 'wasm-unsafe-eval'; style-src ${scope} 'unsafe-inline'; img-src ${scope} data: blob:; media-src ${scope} data: blob:; font-src ${scope} data:; connect-src ${scope}; worker-src blob:; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'`,
      } });
    } catch (error) { return failure(error instanceof ReleaseBusyError ? 503 : 500); }
  };
}

export function createReleaseDownloadHandler(options: Pick<ReleaseRoutesOptions, "loadRelease">) {
  return async (_request: Request, params: { readonly slug: string; readonly releaseId: string }): Promise<Response> => {
    if (!/^[a-f0-9]{64}$/.test(params.releaseId)) return failure(404);
    try {
      const release = await options.loadRelease(params.slug, params.releaseId);
      if (!release) return failure(404);
      return new Response(new Uint8Array(release.bytes), { headers: {
        "Content-Type": "application/zip", "Content-Length": String(release.bytes.length),
        "Content-Disposition": `attachment; filename="game-release.zip"; filename*=UTF-8''${encodeURIComponent(params.slug)}-${params.releaseId}.zip`,
        "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=31536000, immutable",
      } });
    } catch (error) { return failure(error instanceof ReleaseBusyError ? 503 : 500); }
  };
}

const safeHeaders = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
function failure(status: number): Response {
  return Response.json({ error: status === 404 ? "not-found" : status === 400 ? "invalid-path" : "release-unavailable" }, { status, headers: safeHeaders });
}
function redirect(location: string): Response {
  return new Response(null, { status: 307, headers: { ...safeHeaders, Location: location } });
}
function contentType(name: string): string {
  const types: Readonly<Record<string, string>> = {
    html: "text/html; charset=utf-8", js: "text/javascript; charset=utf-8", mjs: "text/javascript; charset=utf-8",
    css: "text/css; charset=utf-8", json: "application/json; charset=utf-8", wasm: "application/wasm",
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
    mp3: "audio/mpeg", ogg: "audio/ogg", wav: "audio/wav", mp4: "video/mp4", webm: "video/webm", ogv: "video/ogg",
    woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf",
  };
  return types[name.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";
}
